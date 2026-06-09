#!/usr/bin/env python3
"""Recrop Operating System Concepts figure assets from the source PDF."""

from __future__ import annotations

import argparse
import collections
import json
import math
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF = Path("/Users/survivor/Downloads/Abraham-Silberschatz-Operating-System-Concepts-10th-2018.pdf")
DEFAULT_JSON = ROOT / "learning-material/operating_systems_textbook_clean.min.json"
DEFAULT_PUBLIC = ROOT / "apps/web/public"
DEFAULT_CONTACTS = Path("/private/tmp/os-figure-contact-sheets")
DEFAULT_PDFTOPPM = Path("/Users/survivor/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/pdftoppm")


def parse_chapters(value: str) -> set[int]:
    chapters: set[int] = set()
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start, end = part.split("-", 1)
            chapters.update(range(int(start), int(end) + 1))
        else:
            chapters.add(int(part))
    return chapters


class FigureCropper:
    def __init__(self, pdf_path: Path, pdftoppm: Path, dpi: int) -> None:
        self.pdf_path = pdf_path
        self.pdftoppm = pdftoppm
        self.dpi = dpi
        self.reader = PdfReader(str(pdf_path))
        self.page_img_cache: collections.OrderedDict[int, Image.Image] = collections.OrderedDict()
        self.page_text_cache: dict[int, list[dict[str, float | str]]] = {}
        self.page_draw_cache: dict[int, list[tuple[float, float, float, float]]] = {}

    @staticmethod
    def _num(arg) -> float:
        return float(arg.as_numeric() if hasattr(arg, "as_numeric") else arg)

    @staticmethod
    def _transform(matrix, x: float, y: float) -> tuple[float, float]:
        a, b, c, d, e, f = matrix
        return a * x + c * y + e, b * x + d * y + f

    @staticmethod
    def _union(boxes: list[tuple[float, float, float, float]]) -> tuple[float, float, float, float]:
        return (
            min(box[0] for box in boxes),
            min(box[1] for box in boxes),
            max(box[2] for box in boxes),
            max(box[3] for box in boxes),
        )

    def page_box(self, page_num: int) -> tuple[float, float, float, float]:
        media = self.reader.pages[page_num - 1].mediabox
        return float(media.left), float(media.bottom), float(media.right), float(media.top)

    def text_items(self, page_num: int) -> list[dict[str, float | str]]:
        if page_num in self.page_text_cache:
            return self.page_text_cache[page_num]

        items: list[dict[str, float | str]] = []

        def visit(text, cm, tm, font_dict, font_size):
            normalized = " ".join(text.replace("\n", " ").split())
            if not normalized:
                return
            x = float(tm[4])
            y = float(tm[5])
            if abs(x) < 0.01 and abs(y) < 0.01:
                return
            font = str((font_dict or {}).get("/BaseFont", ""))
            items.append({"text": normalized, "x": x, "y": y, "font": font})

        self.reader.pages[page_num - 1].extract_text(visitor_text=visit)
        self.page_text_cache[page_num] = items
        return items

    def caption_y(self, page_num: int, label: str) -> float:
        exact = [item for item in self.text_items(page_num) if item["text"] == label]
        if exact:
            return float(min(exact, key=lambda item: float(item["y"]))["y"])
        candidates = [item for item in self.text_items(page_num) if str(item["text"]).startswith(label)]
        if candidates:
            return float(min(candidates, key=lambda item: float(item["y"]))["y"])
        raise RuntimeError(f"caption not found: {label} page {page_num}")

    def drawing_boxes(self, page_num: int) -> list[tuple[float, float, float, float]]:
        if page_num in self.page_draw_cache:
            return self.page_draw_cache[page_num]

        left, bottom, right, top = self.page_box(page_num)
        boxes: list[tuple[float, float, float, float]] = []

        def op_before(op, args, cm, tm):
            op_name = op.decode() if isinstance(op, bytes) else op
            points: list[tuple[float, float]] = []
            if op_name == "re" and len(args) >= 4:
                x, y, width, height = map(self._num, args[:4])
                points = [(x, y), (x + width, y), (x, y + height), (x + width, y + height)]
            elif op_name in ("m", "l") and len(args) >= 2:
                x, y = map(self._num, args[:2])
                points = [(x, y)]
            elif op_name in ("c", "v", "y") and len(args) >= 4:
                values = list(map(self._num, args))
                points = list(zip(values[0::2], values[1::2]))
            elif op_name == "Do":
                points = [(0, 0), (1, 0), (0, 1), (1, 1)]

            if not points:
                return

            transformed = [self._transform(cm, x, y) for x, y in points]
            xs = [point[0] for point in transformed]
            ys = [point[1] for point in transformed]
            x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
            if x1 - x0 <= 0.2 or y1 - y0 <= 0.2:
                return
            if (x1 - x0) > (right - left) * 0.92 and (y1 - y0) > (top - bottom) * 0.92:
                return
            boxes.append((x0, y0, x1, y1))

        self.reader.pages[page_num - 1].extract_text(visitor_operand_before=op_before)

        seen: set[tuple[float, float, float, float]] = set()
        unique: list[tuple[float, float, float, float]] = []
        for box in boxes:
            key = tuple(round(value, 1) for value in box)
            if key not in seen:
                seen.add(key)
                unique.append(box)
        self.page_draw_cache[page_num] = unique
        return unique

    def render_page(self, page_num: int) -> Image.Image:
        if page_num in self.page_img_cache:
            image = self.page_img_cache.pop(page_num)
            self.page_img_cache[page_num] = image
            return image

        with tempfile.TemporaryDirectory() as tmp_dir:
            prefix = Path(tmp_dir) / "page"
            subprocess.run(
                [
                    str(self.pdftoppm),
                    "-f",
                    str(page_num),
                    "-l",
                    str(page_num),
                    "-r",
                    str(self.dpi),
                    "-png",
                    "-singlefile",
                    str(self.pdf_path),
                    str(prefix),
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            image = Image.open(str(prefix) + ".png").convert("RGB")

        self.page_img_cache[page_num] = image
        while len(self.page_img_cache) > 10:
            self.page_img_cache.popitem(last=False)
        return image

    def select_raw_draw_bbox(self, page_num: int, cap_y: float) -> tuple[float, float, float, float] | None:
        boxes: list[tuple[float, float, float, float]] = []
        for box in self.drawing_boxes(page_num):
            x0, y0, x1, y1 = box
            width = x1 - x0
            height = y1 - y0
            area = width * height
            if y0 <= cap_y + 2:
                continue
            if area < 8 and max(width, height) < 12:
                continue
            boxes.append(box)

        if not boxes:
            return None

        boxes.sort(key=lambda box: box[1])
        group = [boxes[0]]
        current_ymax = boxes[0][3]
        for box in boxes[1:]:
            if box[1] - current_ymax <= 95:
                group.append(box)
                current_ymax = max(current_ymax, box[3])
            else:
                break

        bbox = self._union(group)
        width = bbox[2] - bbox[0]
        height = bbox[3] - bbox[1]
        if width * height < 80 or height < 6 or width < 10:
            return None
        return bbox

    def select_draw_bbox(self, page_num: int, cap_y: float) -> tuple[float, float, float, float] | None:
        bbox = self.select_raw_draw_bbox(page_num, cap_y)
        if bbox is None:
            return None
        return self.expand_draw_bbox_with_labels(page_num, bbox, cap_y)

    @staticmethod
    def is_code_font(font: str) -> bool:
        return any(tag in font for tag in ["CMTT", "CMSY", "STIXMath", "Courier", "CMR"])

    @staticmethod
    def is_figure_label(text: str, font: str) -> bool:
        if text.startswith("Figure "):
            return False
        if not any(char.isalnum() for char in text):
            return False
        subcaption = len(text) > 3 and text[0] == "(" and text[2] == ")" and text[1].isalnum()
        if subcaption:
            return len(text) <= 120
        if any(tag in font for tag in ["CMTT", "CMSY", "STIXMath", "Courier", "CMR"]):
            return False
        if "Palatino" in font or "NimbusRomNo9L" in font:
            return False
        if len(text) > 58:
            return False
        if len(text.split()) > 6:
            return False
        if any(mark in text for mark in [".", ";", ":", ","]):
            return False
        return True

    @staticmethod
    def text_bbox(item: dict[str, float | str]) -> tuple[float, float, float, float]:
        text = str(item["text"])
        x = float(item["x"])
        y = float(item["y"])
        width = max(8.0, min(360.0, len(text) * 5.6))
        return x - 3, y - 6, x + width + 3, y + 9

    def expand_draw_bbox_with_labels(
        self, page_num: int, bbox: tuple[float, float, float, float], cap_y: float
    ) -> tuple[float, float, float, float]:
        left, bottom, right, top = page_box = self.page_box(page_num)
        del bottom, page_box
        expanded = [bbox[0], bbox[1], bbox[2], bbox[3]]

        for item in self.text_items(page_num):
            text = str(item["text"])
            font = str(item["font"])
            y = float(item["y"])
            if y <= cap_y + 2:
                continue
            if y > top - 34:
                continue
            if not self.is_figure_label(text, font):
                continue

            tx0, ty0, tx1, ty1 = self.text_bbox(item)
            if tx1 < left or tx0 > right:
                continue

            vertical_overlap = ty1 >= bbox[1] - 24 and ty0 <= bbox[3] + 24
            horizontal_overlap = tx1 >= bbox[0] - 6 and tx0 <= bbox[2] + 6
            horizontal_gap = max(bbox[0] - tx1, tx0 - bbox[2], 0)
            vertical_gap = max(bbox[1] - ty1, ty0 - bbox[3], 0)

            near_side_label = vertical_overlap and horizontal_gap <= 95
            near_top_bottom_label = horizontal_overlap and vertical_gap <= 48
            if not (near_side_label or near_top_bottom_label):
                continue

            expanded[0] = min(expanded[0], tx0)
            expanded[1] = min(expanded[1], ty0)
            expanded[2] = max(expanded[2], tx1)
            expanded[3] = max(expanded[3], ty1)

        return tuple(expanded)

    def has_prose_overlap(self, page_num: int, bbox: tuple[float, float, float, float], cap_y: float) -> bool:
        _left, _bottom, _right, top = self.page_box(page_num)
        for item in self.text_items(page_num):
            text = str(item["text"])
            font = str(item["font"])
            y = float(item["y"])
            if y <= cap_y + 2 or y > top - 34:
                continue
            if "Palatino" not in font:
                continue
            if len(text) <= 10:
                continue
            if len(text) <= 48 and len(text.split()) <= 5:
                continue
            tx0, ty0, tx1, ty1 = self.text_bbox(item)
            horizontal_overlap = tx1 >= bbox[0] - 6 and tx0 <= bbox[2] + 6
            vertical_overlap = ty1 >= bbox[1] - 4 and ty0 <= bbox[3] + 4
            if horizontal_overlap and vertical_overlap:
                return True
        return False

    def select_code_bbox(self, page_num: int, cap_y: float) -> tuple[float, float, float, float] | None:
        left, bottom, right, top = self.page_box(page_num)
        items = sorted(
            [
                item
                for item in self.text_items(page_num)
                if float(item["y"]) > cap_y + 8 and self.is_code_font(str(item["font"]))
            ],
            key=lambda item: float(item["y"]),
        )
        if not items:
            return None

        group = [items[0]]
        current_y = float(items[0]["y"])
        for item in items[1:]:
            y = float(item["y"])
            if y - current_y <= 46:
                group.append(item)
                current_y = y
            else:
                break

        if len(group) < 2:
            return None

        return (
            left + 54,
            max(bottom, min(float(item["y"]) for item in group) - 8),
            right - 36,
            min(top, max(float(item["y"]) for item in group) + 7),
        )

    def raster_fallback_bbox(self, page_num: int, cap_y: float) -> tuple[float, float, float, float] | None:
        image = self.render_page(page_num)
        left, bottom, _right, top = self.page_box(page_num)
        scale = image.height / (top - bottom)
        cap_px = int((top - cap_y) * scale)
        bottom_limit = max(0, cap_px - int(8 * scale))
        arr = np.array(image)
        mask = np.any(arr < 248, axis=2)
        height, width = mask.shape
        margin = int(35 * scale)
        active = mask[:bottom_limit, margin : width - margin].sum(axis=1) > max(5, int(width * 0.002))
        # Running heads sit above the figure area and can otherwise merge with
        # top-of-page charts that need raster fallback.
        active[: int(58 * scale)] = False
        rows = np.flatnonzero(active)
        if len(rows) == 0:
            return None

        near = rows[rows >= max(0, bottom_limit - int(58 * scale))]
        if len(near) == 0:
            near = rows

        last = int(near[-1])
        top_row = last
        bottom_row = last
        gap = 0
        max_gap = int(24 * scale)
        for y in range(last - 1, -1, -1):
            if active[y]:
                top_row = y
                gap = 0
            else:
                gap += 1
                if gap > max_gap:
                    break

        submask = mask[top_row : bottom_row + 1, :]
        cols = np.flatnonzero(submask.sum(axis=0) > max(2, int((bottom_row - top_row + 1) * 0.006)))
        if len(cols) == 0:
            return None
        return (left + cols[0] / scale, top - bottom_row / scale, left + cols[-1] / scale, top - top_row / scale)

    def should_prefer_raster_bbox(
        self,
        page_num: int,
        draw_bbox: tuple[float, float, float, float],
        raster_bbox: tuple[float, float, float, float],
        cap_y: float,
    ) -> bool:
        left, _bottom, right, _top = self.page_box(page_num)
        draw_width = draw_bbox[2] - draw_bbox[0]
        draw_height = draw_bbox[3] - draw_bbox[1]
        raster_width = raster_bbox[2] - raster_bbox[0]
        raster_height = raster_bbox[3] - raster_bbox[1]
        draw_area = draw_width * draw_height
        raster_area = raster_width * raster_height
        if raster_bbox[1] <= cap_y + 4:
            return False
        if raster_height > 240 or raster_width > (right - left) * 0.82:
            return False
        if raster_area < draw_area * 2.1:
            return False
        return raster_width - draw_width > 55 or raster_height - draw_height > 35

    def crop_from_bbox(self, page_num: int, bbox: tuple[float, float, float, float], kind: str) -> Image.Image:
        image = self.render_page(page_num)
        left, bottom, right, top = self.page_box(page_num)
        scale = image.height / (top - bottom)
        x0, y0, x1, y1 = bbox
        if kind == "draw":
            pad_x, pad_top, pad_bottom = 10, 4, 7
        elif kind == "code":
            pad_x, pad_top, pad_bottom = 0, 3, 6
        else:
            pad_x, pad_top, pad_bottom = 6, 5, 5

        x0 = max(left, x0 - pad_x)
        x1 = min(right, x1 + pad_x)
        y0 = max(bottom, y0 - pad_bottom)
        y1 = min(top, y1 + pad_top)
        px0 = max(0, int((x0 - left) * scale))
        px1 = min(image.width, int(math.ceil((x1 - left) * scale)))
        py0 = max(0, int((top - y1) * scale))
        py1 = min(image.height, int(math.ceil((top - y0) * scale)))

        crop = image.crop((px0, py0, px1, py1))
        arr = np.array(crop)
        mask = np.any(arr < 248, axis=2)
        if mask.any():
            rows = np.flatnonzero(mask.sum(axis=1) > 2)
            cols = np.flatnonzero(mask.sum(axis=0) > 2)
            if len(rows) and len(cols):
                pad = 8 if kind != "code" else 9
                crop = crop.crop(
                    (
                        max(0, int(cols[0]) - pad),
                        max(0, int(rows[0]) - pad),
                        min(crop.width, int(cols[-1]) + pad + 1),
                        min(crop.height, int(rows[-1]) + pad + 1),
                    )
                )
        return crop

    def crop_figure(self, figure: dict[str, str | int]) -> tuple[Image.Image, str]:
        cap_y = self.caption_y(int(figure["page"]), str(figure["caption"]))
        raw_draw_bbox = self.select_raw_draw_bbox(int(figure["page"]), cap_y)
        bbox = None
        kind = "draw"
        if raw_draw_bbox is not None and self.has_prose_overlap(int(figure["page"]), raw_draw_bbox, cap_y):
            raster_bbox = self.raster_fallback_bbox(int(figure["page"]), cap_y)
            if raster_bbox is not None:
                bbox = raster_bbox
                kind = "raster"
        elif raw_draw_bbox is not None:
            bbox = self.expand_draw_bbox_with_labels(int(figure["page"]), raw_draw_bbox, cap_y)
            raster_bbox = self.raster_fallback_bbox(int(figure["page"]), cap_y)
            if raster_bbox is not None and self.should_prefer_raster_bbox(
                int(figure["page"]), bbox, raster_bbox, cap_y
            ):
                bbox = raster_bbox
                kind = "raster"
        if bbox is None:
            bbox = self.select_code_bbox(int(figure["page"]), cap_y)
            kind = "code"
        if bbox is None:
            bbox = self.raster_fallback_bbox(int(figure["page"]), cap_y)
            kind = "raster"
        if bbox is None:
            raise RuntimeError("no crop bbox")
        return self.crop_from_bbox(int(figure["page"]), bbox, kind), kind


def make_contact_sheet(chapter: int, items: list[tuple[str, Path, tuple[int, int], str]], contact_dir: Path) -> Path | None:
    if not items:
        return None
    width, height = 520, 360
    cols = 4
    rows = math.ceil(len(items) / cols)
    sheet = Image.new("RGB", (cols * width, rows * height), "white")
    draw = ImageDraw.Draw(sheet)
    for index, (name, path, size, kind) in enumerate(items):
        image = Image.open(path).convert("RGB")
        image.thumbnail((width - 20, height - 52), Image.LANCZOS)
        x = (index % cols) * width + 10
        y = (index // cols) * height + 30
        sheet.paste(image, (x, y))
        draw.text(
            ((index % cols) * width + 8, (index // cols) * height + 8),
            f"{name} {kind} {size[0]}x{size[1]}",
            fill="black",
        )
    contact_dir.mkdir(parents=True, exist_ok=True)
    output = contact_dir / f"os-ch{chapter:02d}-contact.jpg"
    sheet.save(output, quality=90)
    return output


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--chapters", default="3-21")
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON)
    parser.add_argument("--target-root", type=Path, default=DEFAULT_PUBLIC)
    parser.add_argument("--contact-dir", type=Path, default=DEFAULT_CONTACTS)
    parser.add_argument("--pdftoppm", type=Path, default=DEFAULT_PDFTOPPM)
    parser.add_argument("--dpi", type=int, default=250)
    parser.add_argument("--quality", type=int, default=94)
    args = parser.parse_args()

    chapter_filter = parse_chapters(args.chapters)
    data = json.loads(args.json.read_text())
    cropper = FigureCropper(args.pdf, args.pdftoppm, args.dpi)
    method_counts: collections.Counter[str] = collections.Counter()
    failures: list[tuple[str, int, str, str]] = []
    written = 0

    for topic in data["subjects"][0]["topics"]:
        chapter = int(topic["topicId"].split("-")[-1])
        if chapter not in chapter_filter:
            continue
        chapter_items: list[tuple[str, Path, tuple[int, int], str]] = []
        for figure in topic.get("figures", []):
            try:
                crop, kind = cropper.crop_figure(figure)
                target = args.target_root / str(figure["src"]).lstrip("/")
                target.parent.mkdir(parents=True, exist_ok=True)
                crop.save(target, quality=args.quality, optimize=True)
                chapter_items.append((target.name, target, crop.size, kind))
                method_counts[kind] += 1
                written += 1
            except Exception as exc:  # noqa: BLE001 - batch report should continue.
                failures.append((str(figure.get("caption")), int(figure.get("page")), str(figure.get("src")), str(exc)))
        contact = make_contact_sheet(chapter, chapter_items, args.contact_dir)
        print(f"chapter {chapter:02d}: {len(chapter_items)} figures, contact={contact}", flush=True)

    print(f"written {written}", flush=True)
    print(f"methods {dict(method_counts)}", flush=True)
    print(f"failures {len(failures)}", flush=True)
    for failure in failures:
        print(f"FAIL {failure}", flush=True)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
