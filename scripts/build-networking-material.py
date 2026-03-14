#!/usr/bin/env python3
"""Build Forouzan Data Communications and Networking material from the PDF."""

from __future__ import annotations

import argparse
import collections
import json
import math
import re
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
from PIL import Image, ImageDraw
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF = Path(
    "/Users/survivor/Downloads/(McGraw-Hill Forouzan Networking) Behrouz A. Forouzan - "
    "Data Communications and Networking -McGraw-Hill Higher Education (2007).pdf"
)
DEFAULT_JSON = ROOT / "learning-material/computer_networks_textbook_clean.min.json"
DEFAULT_PUBLIC = ROOT / "apps/web/public"
DEFAULT_DIMENSIONS = ROOT / "apps/web/src/lib/learning/os-figure-dimensions.json"
DEFAULT_CONTACTS = Path("/private/tmp/networking-figure-contact-sheets")
DEFAULT_PDFTOPPM = (
    Path("/Users/survivor/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/pdftoppm")
)


@dataclass(frozen=True)
class ChapterSpec:
    number: int
    title: str
    printed_start: int
    pdf_start: int
    pdf_end: int


PRINTED_TO_PDF_OFFSET = 37
CHAPTER_PRINTED_STARTS = [
    (1, "Introduction", 3),
    (2, "Network Models", 27),
    (3, "Data and Signals", 57),
    (4, "Digital Transmission", 101),
    (5, "Analog Transmission", 141),
    (6, "Bandwidth Utilization: Multiplexing and Spreading", 161),
    (7, "Transmission Media", 191),
    (8, "Switching", 213),
    (9, "Using Telephone and Cable Networks for Data Transmission", 241),
    (10, "Error Detection and Correction", 267),
    (11, "Data Link Control", 307),
    (12, "Multiple Access", 363),
    (13, "Wired LANs: Ethernet", 395),
    (14, "Wireless LANs", 421),
    (15, "Connecting LANs, Backbone Networks, and Virtual LANs", 445),
    (16, "Wireless WANs: Cellular Telephone and Satellite Networks", 467),
    (17, "SONET/SDH", 491),
    (18, "Virtual-Circuit Networks: Frame Relay and ATM", 517),
    (19, "Network Layer: Logical Addressing", 549),
    (20, "Network Layer: Internet Protocol", 579),
    (21, "Network Layer: Address Mapping, Error Reporting, and Multicasting", 611),
    (22, "Network Layer: Delivery, Forwarding, and Routing", 647),
    (23, "Process-to-Process Delivery: UDP, TCP, and SCTP", 703),
    (24, "Congestion Control and Quality of Service", 761),
    (25, "Domain Name System", 797),
    (26, "Remote Logging, Electronic Mail, and File Transfer", 817),
    (27, "WWW and HTTP", 851),
    (28, "Network Management: SNMP", 873),
    (29, "Multimedia", 901),
    (30, "Cryptography", 931),
    (31, "Network Security", 961),
    (32, "Security in the Internet: IPSec, SSL/TLS, PGP, VPN, and Firewalls", 995),
]


def make_chapters() -> tuple[ChapterSpec, ...]:
    chapters: list[ChapterSpec] = []
    for index, (number, title, printed_start) in enumerate(CHAPTER_PRINTED_STARTS):
        pdf_start = printed_start + PRINTED_TO_PDF_OFFSET
        if index + 1 < len(CHAPTER_PRINTED_STARTS):
            pdf_end = CHAPTER_PRINTED_STARTS[index + 1][2] + PRINTED_TO_PDF_OFFSET - 1
        else:
            pdf_end = 1029 + PRINTED_TO_PDF_OFFSET - 1
        chapters.append(ChapterSpec(number, title, printed_start, pdf_start, pdf_end))
    return tuple(chapters)


CHAPTERS = make_chapters()
SECTION_RE = re.compile(r"^(\d+\.\d+(?:\.\d+)*)\s+(.+)$")
CAPTION_RE = re.compile(r"^Figure\s+(\d+)\.(\d+)\b\s*(.*)$", re.IGNORECASE)
CAPTION_LABEL_RE = re.compile(r"^Figure\s+(\d+)\.(\d+)$", re.IGNORECASE)
RECOMMENDED_RE = re.compile(r"^\d+\.\d+\s+RECOMMENDED\s+READING\b", re.IGNORECASE)
RUNNING_HEADER_RE = re.compile(r"^(?:SECTION\s+\d+\.\d+|CHAPTER\s+\d+)\b", re.IGNORECASE)
PART_HEADER_RE = re.compile(r"^PART\s+\d+\b", re.IGNORECASE)
CHAPTER_LINE_RE = re.compile(r"^CHAPTER\s*\d+\b|^CHAPTER[Il1]\b", re.IGNORECASE)


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


def collapse_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def compact_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def normalize_line(value: str) -> str:
    text = collapse_spaces(value)
    text = (
        text.replace("\u00ad", "")
        .replace("ﬁ", "fi")
        .replace("ﬂ", "fl")
        .replace("©", "(c)")
        .replace("®", "(R)")
        .replace("™", "(TM)")
        .replace("–", "-")
        .replace("—", "-")
        .replace("“", '"')
        .replace("”", '"')
        .replace("’", "'")
        .replace("‘", "'")
    )
    text = re.sub(r"\bO(?=s\b|S\b)", "0", text)
    text = re.sub(r"\bIs\b", "1s", text) if " bit" in text else text
    replacements = {
        "Nenvork": "Network",
        "Netvvork": "Network",
        "netvvork": "network",
        "La.ver": "Layer",
        "Fonvarding": "Forwarding",
        "fonvarding": "forwarding",
        "UDp": "UDP",
        "ql'Sen'ice": "of Service",
        "C}1Jtography": "Cryptography",
        "Cf}1Jtog raphy": "Cryptography",
        "Securit}": "Security",
        "lERMS": "TERMS",
        "KEYTERMS": "KEY TERMS",
        "RECOlVIMENDED": "RECOMMENDED",
        "RECOMMENDEO": "RECOMMENDED",
        "LANs": "LANs",
        "WANs": "WANs",
        "TCPflP": "TCP/IP",
        "TCPllP": "TCP/IP",
        "SONETISDH": "SONET/SDH",
        "SSLlTLS": "SSL/TLS",
        "lP": "IP",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    text = re.sub(r"([(])\s+", r"\1", text)
    text = re.sub(r"\s+([)])", r"\1", text)
    text = re.sub(r"([.!?])(?=[A-Z])", r"\1 ", text)
    text = re.sub(r"([,;:])(?=[A-Za-z])", r"\1 ", text)
    return collapse_spaces(text)


def normalize_heading(clean: str) -> str:
    match = SECTION_RE.match(clean)
    if not match:
        return f"## {clean}"
    number, title = match.groups()
    level = "###" if number.count(".") >= 2 else "##"
    return f"{level} {number} {title.title() if title.isupper() else title}"


def is_chapter_title_fragment(clean: str, chapter: ChapterSpec) -> bool:
    if not clean or len(clean) > 95:
        return False
    if CHAPTER_LINE_RE.match(clean):
        return True
    if clean in {str(chapter.number), chapter.title}:
        return True
    clean_key = compact_key(clean).replace(str(chapter.number), "")
    title_key = compact_key(chapter.title)
    return bool(clean_key and (clean_key in title_key or title_key in clean_key))


def is_running_header(clean: str, chapter: ChapterSpec, first_nonblank: bool) -> bool:
    if not clean:
        return False
    if clean.isdigit():
        return True
    if RUNNING_HEADER_RE.match(clean):
        return True
    if first_nonblank and re.match(rf"^\d+\s+CHAPTER\s+{chapter.number}\b", clean, re.IGNORECASE):
        return True
    if PART_HEADER_RE.match(clean):
        return True
    if re.match(r"^(?:SECTION\s+\d+\.\d+\s+.+|.+\s+\d+)$", clean) and first_nonblank:
        return True
    return False


def is_recommended_reading(clean: str) -> bool:
    return bool(RECOMMENDED_RE.match(clean) or re.match(r"^RECOMMENDED\s+READING\b", clean, re.IGNORECASE))


def looks_like_prose_start(clean: str, next_clean: str | None) -> bool:
    if not clean:
        return False
    if SECTION_RE.match(clean) or is_recommended_reading(clean):
        return True
    words = clean.split()
    if len(words) >= 8 and clean.endswith((".", ":", ";", "?", "!")):
        return True
    if len(words) <= 5 and next_clean:
        next_words = next_clean.split()
        if len(next_words) >= 8 and next_clean.endswith((".", ":", ";", "?", "!")):
            return True
    return False


def looks_like_figure_visual_line(clean: str) -> bool:
    if not clean:
        return True
    if CAPTION_RE.match(clean) or SECTION_RE.match(clean) or is_recommended_reading(clean):
        return False
    if len(clean) <= 2:
        return True
    if re.search(r"[~|_]{2,}|[<>]{2,}|[{}]", clean):
        return True
    if len(clean.split()) <= 12 and not clean.endswith((".", "?", "!", ":")):
        return True
    if sum(ch.isdigit() for ch in clean) >= 3 and len(clean.split()) <= 18:
        return True
    return False


def remove_figure_text_blocks(lines: list[str], chapter: ChapterSpec) -> list[str]:
    remove: set[int] = set()
    for index, line in enumerate(lines):
        match = CAPTION_RE.match(line)
        if not match or int(match.group(1)) != chapter.number:
            continue
        remove.add(index)
        cursor = index + 1
        while cursor < len(lines):
            clean = lines[cursor]
            next_clean = lines[cursor + 1] if cursor + 1 < len(lines) else None
            if looks_like_prose_start(clean, next_clean):
                break
            if not looks_like_figure_visual_line(clean):
                break
            remove.add(cursor)
            cursor += 1
    return [line for index, line in enumerate(lines) if index not in remove]


def clean_page_lines(reader: PdfReader, page_num: int, chapter: ChapterSpec) -> list[str]:
    text = reader.pages[page_num - 1].extract_text() or ""
    lines: list[str] = []
    first_nonblank_seen = False
    for raw_line in text.splitlines():
        clean = normalize_line(raw_line)
        if not clean:
            lines.append("")
            continue
        first_nonblank = not first_nonblank_seen
        first_nonblank_seen = True
        if is_running_header(clean, chapter, first_nonblank):
            continue
        if page_num == chapter.pdf_start and is_chapter_title_fragment(clean, chapter):
            continue
        lines.append(clean)
    return remove_figure_text_blocks(lines, chapter)


def join_prose(lines: list[str]) -> str:
    result = ""
    for line in lines:
        clean = normalize_line(line)
        if not clean:
            continue
        if not result:
            result = clean
            continue
        if result.endswith("-") and clean and clean[0].islower():
            result = result[:-1] + clean
        else:
            result += " " + clean
    return normalize_line(result)


def looks_like_code_or_formula(clean: str) -> bool:
    if not clean:
        return False
    if clean.startswith(("C =", "SNR", "dB", "Nyquist", "N =", "B =", "T =", "Delay =", "Latency =")):
        return True
    if any(symbol in clean for symbol in ["→", "=>", "≤", "≥", "×", "log2", "log", "Δ"]):
        return len(clean.split()) <= 18
    if re.match(r"^[A-Z][A-Za-z0-9_ -]*\s*=\s*.+$", clean) and len(clean.split()) <= 18:
        return True
    return False


def normalize_formula(lines: Iterable[str]) -> str:
    content = [normalize_line(line) for line in lines if normalize_line(line)]
    return "```text\n" + "\n".join(content) + "\n```" if content else ""


class FigureIndex:
    def __init__(self, reader: PdfReader) -> None:
        self.reader = reader
        self._text_cache: dict[int, str] = {}
        self._text_items_cache: dict[int, list[dict[str, float | str]]] = {}
        self._caption_cache: dict[int, list[dict[str, float | int | str]]] = {}

    def page_text(self, page_num: int) -> str:
        if page_num not in self._text_cache:
            self._text_cache[page_num] = self.reader.pages[page_num - 1].extract_text() or ""
        return self._text_cache[page_num]

    def text_items(self, page_num: int) -> list[dict[str, float | str]]:
        if page_num in self._text_items_cache:
            return self._text_items_cache[page_num]
        items: list[dict[str, float | str]] = []

        def visit(text, cm, tm, font_dict, font_size):
            clean = normalize_line(text.replace("\n", " "))
            if not clean:
                return
            items.append(
                {
                    "text": clean,
                    "x": float(tm[4]),
                    "y": float(tm[5]),
                    "font": str((font_dict or {}).get("/BaseFont", "")),
                }
            )

        self.reader.pages[page_num - 1].extract_text(visitor_text=visit)
        self._text_items_cache[page_num] = items
        return items

    def captions_on_page(self, page_num: int) -> list[dict[str, float | int | str]]:
        if page_num in self._caption_cache:
            return self._caption_cache[page_num]
        plain_captions: dict[str, str] = {}
        for line in self.page_text(page_num).splitlines():
            clean = normalize_line(line)
            match = CAPTION_RE.match(clean)
            if match:
                label = f"Figure {int(match.group(1))}.{int(match.group(2))}"
                plain_captions.setdefault(label, clean)
        items: list[dict[str, float | int | str]] = []

        for text_item in self.text_items(page_num):
            clean = str(text_item["text"])
            match = CAPTION_LABEL_RE.match(clean)
            if not match:
                continue
            if float(text_item["x"]) > 220:
                continue
            label = f"Figure {int(match.group(1))}.{int(match.group(2))}"
            if label not in plain_captions:
                continue
            items.append(
                {
                    "chapter": int(match.group(1)),
                    "figure": int(match.group(2)),
                    "label": label,
                    "caption": plain_captions[label],
                    "page": page_num,
                    "x": float(text_item["x"]),
                    "y": float(text_item["y"]),
                }
            )
        seen: set[tuple[int, int, int]] = set()
        unique: list[dict[str, float | int | str]] = []
        for item in sorted(items, key=lambda entry: (int(entry["chapter"]), int(entry["figure"]), -float(entry["y"]))):
            key = (int(item["chapter"]), int(item["figure"]), round(float(item["y"])))
            if key in seen:
                continue
            seen.add(key)
            unique.append(item)
        self._caption_cache[page_num] = unique
        return unique

    def chapter_figures(self, chapter: ChapterSpec, stop_page: int) -> list[dict[str, float | int | str]]:
        figures: list[dict[str, float | int | str]] = []
        for page_num in range(chapter.pdf_start, min(chapter.pdf_end, stop_page) + 1):
            for item in self.captions_on_page(page_num):
                if int(item["chapter"]) == chapter.number:
                    figures.append(item)
        figures.sort(key=lambda item: (int(item["figure"]), int(item["page"]), -float(item["y"])))
        return figures

    def prose_boundary_y(self, page_num: int, cap_y: float, next_cap_y: float | None) -> float | None:
        lower_limit = next_cap_y + 8 if next_cap_y is not None and next_cap_y < cap_y else 0
        grouped_lines: dict[int, list[dict[str, float | str]]] = collections.defaultdict(list)
        for item in self.text_items(page_num):
            y = float(item["y"])
            if y >= cap_y - 70 or y <= lower_limit:
                continue
            grouped_lines[round(y)].append(item)

        candidates: list[float] = []
        for group in grouped_lines.values():
            group.sort(key=lambda item: float(item["x"]))
            text = normalize_line(" ".join(str(item["text"]) for item in group))
            if not text:
                continue
            min_x = min(float(item["x"]) for item in group)
            y = max(float(item["y"]) for item in group)
            if min_x > 190:
                continue
            if CAPTION_RE.match(text) or text.startswith("Figure "):
                continue
            if SECTION_RE.match(text) or re.match(r"^Example\s+\d+\.\d+\b", text, re.IGNORECASE):
                candidates.append(y)
                continue
            if y >= cap_y - 95:
                continue
            words = text.split()
            if len(words) >= 7:
                candidates.append(y)
                continue
            if 2 <= len(words) <= 7 and min_x < 155 and text[0].isupper() and not any(ch.isdigit() for ch in text):
                candidates.append(y)
        return max(candidates) if candidates else None


class FigureCropper:
    def __init__(self, pdf_path: Path, reader: PdfReader, pdftoppm: Path, dpi: int) -> None:
        self.pdf_path = pdf_path
        self.reader = reader
        self.pdftoppm = pdftoppm
        self.dpi = dpi
        self.image_cache: collections.OrderedDict[int, Image.Image] = collections.OrderedDict()
        self.draw_cache: dict[int, list[tuple[float, float, float, float]]] = {}

    @staticmethod
    def _num(value) -> float:
        return float(value.as_numeric() if hasattr(value, "as_numeric") else value)

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

    def render_page(self, page_num: int) -> Image.Image:
        if page_num in self.image_cache:
            image = self.image_cache.pop(page_num)
            self.image_cache[page_num] = image
            return image
        with tempfile.TemporaryDirectory() as tmp_dir:
            prefix = Path(tmp_dir) / "page"
            cache_root = Path("/private/tmp/codex-poppler-cache")
            cache_root.mkdir(parents=True, exist_ok=True)
            env = {
                "HOME": "/private/tmp",
                "XDG_CACHE_HOME": str(cache_root),
            }
            subprocess.run(
                [
                    str(self.pdftoppm),
                    "-f",
                    str(page_num),
                    "-l",
                    str(page_num),
                    "-r",
                    str(self.dpi),
                    "-jpeg",
                    "-singlefile",
                    str(self.pdf_path),
                    str(prefix),
                ],
                check=True,
                env=env,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            image = Image.open(str(prefix) + ".jpg").convert("RGB")
        self.image_cache[page_num] = image
        while len(self.image_cache) > 8:
            self.image_cache.popitem(last=False)
        return image

    def drawing_boxes(self, page_num: int) -> list[tuple[float, float, float, float]]:
        if page_num in self.draw_cache:
            return self.draw_cache[page_num]
        left, bottom, right, top = self.page_box(page_num)
        boxes: list[tuple[float, float, float, float]] = []

        def op_before(op, args, cm, tm):
            op_name = op.decode() if isinstance(op, bytes) else op
            points: list[tuple[float, float]] = []
            if op_name == "re" and len(args) >= 4:
                x, y, width, height = map(self._num, args[:4])
                points = [(x, y), (x + width, y), (x, y + height), (x + width, y + height)]
            elif op_name in {"m", "l"} and len(args) >= 2:
                x, y = map(self._num, args[:2])
                points = [(x, y)]
            elif op_name in {"c", "v", "y"} and len(args) >= 4:
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
            if (x1 - x0) > (right - left) * 0.94 and (y1 - y0) > (top - bottom) * 0.94:
                return
            boxes.append((x0, y0, x1, y1))

        self.reader.pages[page_num - 1].extract_text(visitor_operand_before=op_before)
        seen: set[tuple[float, float, float, float]] = set()
        unique: list[tuple[float, float, float, float]] = []
        for box in boxes:
            key = tuple(round(value, 1) for value in box)
            if key in seen:
                continue
            seen.add(key)
            unique.append(box)
        self.draw_cache[page_num] = unique
        return unique

    def select_draw_bbox(
        self, page_num: int, cap_y: float, next_cap_y: float | None
    ) -> tuple[float, float, float, float] | None:
        left, bottom, right, top = self.page_box(page_num)
        lower_bound = bottom + 28
        if next_cap_y is not None and next_cap_y < cap_y:
            lower_bound = max(lower_bound, next_cap_y + 10)
        candidates: list[tuple[float, float, float, float]] = []
        for box in self.drawing_boxes(page_num):
            x0, y0, x1, y1 = box
            width = x1 - x0
            height = y1 - y0
            if y1 >= cap_y - 4 or y0 <= lower_bound:
                continue
            if max(width, height) < 8:
                continue
            candidates.append(box)
        if not candidates:
            return None
        candidates.sort(key=lambda box: box[3], reverse=True)
        group = [candidates[0]]
        current_bottom = candidates[0][1]
        for box in candidates[1:]:
            gap = current_bottom - box[3]
            if gap <= 58:
                group.append(box)
                current_bottom = min(current_bottom, box[1])
                continue
            break
        bbox = self._union(group)
        if bbox[2] - bbox[0] < 18 or bbox[3] - bbox[1] < 8:
            return None
        return bbox

    def crop_from_bbox(self, page_num: int, bbox: tuple[float, float, float, float]) -> Image.Image:
        image = self.render_page(page_num)
        left, bottom, right, top = self.page_box(page_num)
        scale = image.height / (top - bottom)
        x0, y0, x1, y1 = bbox
        x0 = max(left, x0 - 7)
        x1 = min(right, x1 + 7)
        y0 = max(bottom, y0 - 5)
        y1 = min(top, y1 + 5)
        px0 = max(0, int((x0 - left) * scale))
        px1 = min(image.width, int(math.ceil((x1 - left) * scale)))
        py0 = max(0, int((top - y1) * scale))
        py1 = min(image.height, int(math.ceil((top - y0) * scale)))
        return self.trim(image.crop((px0, py0, px1, py1)))

    def raster_below_caption(
        self, page_num: int, cap_y: float, next_cap_y: float | None, prose_y: float | None
    ) -> Image.Image:
        image = self.render_page(page_num)
        left, bottom, right, top = self.page_box(page_num)
        del left, right
        scale = image.height / (top - bottom)
        start = min(image.height - 1, int((top - (cap_y - 18)) * scale))
        lower_pdf = bottom + 28
        if next_cap_y is not None and next_cap_y < cap_y:
            lower_pdf = max(lower_pdf, next_cap_y + 12)
        if prose_y is not None and prose_y < cap_y:
            lower_pdf = max(lower_pdf, prose_y + 9)
        end = min(image.height, int((top - lower_pdf) * scale))
        arr = np.array(image)
        mask = np.any(arr < 247, axis=2)
        height, width = mask.shape
        margin = int(34 * scale)
        active = mask[start:end, margin : width - margin].sum(axis=1) > max(5, int(width * 0.0025))
        rows = np.flatnonzero(active)
        if len(rows) == 0:
            raise RuntimeError(f"no visible figure content below caption on page {page_num}")
        first = int(rows[0]) + start
        top_row = first
        bottom_row = first
        row_dark = mask[:, margin : width - margin].sum(axis=1)
        long_rule_rows = np.flatnonzero(
            (row_dark[start:end] > max(30, int((width - 2 * margin) * 0.38)))
        ) + start
        usable_rule_rows = long_rule_rows[long_rule_rows > first + max(18, int(18 * scale))]
        if len(usable_rule_rows):
            groups: list[tuple[int, int]] = []
            group_start = int(usable_rule_rows[0])
            previous = int(usable_rule_rows[0])
            for row in usable_rule_rows[1:]:
                row = int(row)
                if row - previous <= 3:
                    previous = row
                    continue
                groups.append((group_start, previous))
                group_start = previous = row
            groups.append((group_start, previous))
            # A bottom separator is the strongest clue for this textbook layout.
            # Use the last separator before the next caption or page bottom.
            chosen = groups[-1]
            bottom_row = min(end - 1, chosen[1] + int(3 * scale))
            submask = mask[top_row : bottom_row + 1, :]
            cols = np.flatnonzero(submask.sum(axis=0) > max(2, int((bottom_row - top_row + 1) * 0.004)))
            if len(cols):
                crop = image.crop(
                    (
                        max(0, int(cols[0]) - 10),
                        max(0, top_row - 8),
                        min(width, int(cols[-1]) + 11),
                        min(height, bottom_row + 9),
                    )
                )
                return self.trim(crop)

        gap = 0
        max_gap = max(20, int(38 * scale))
        for row in range(first + 1, end):
            if mask[row, margin : width - margin].sum() > max(5, int(width * 0.0025)):
                bottom_row = row
                gap = 0
            else:
                gap += 1
                if gap > max_gap:
                    break
        submask = mask[top_row : bottom_row + 1, :]
        cols = np.flatnonzero(submask.sum(axis=0) > max(2, int((bottom_row - top_row + 1) * 0.004)))
        if len(cols) == 0:
            raise RuntimeError(f"no visible figure columns on page {page_num}")
        crop = image.crop(
            (
                max(0, int(cols[0]) - 10),
                max(0, top_row - 8),
                min(width, int(cols[-1]) + 11),
                min(height, bottom_row + 9),
            )
        )
        return self.trim(crop)

    def crop_figure(self, page_num: int, cap_y: float, next_cap_y: float | None, prose_y: float | None) -> Image.Image:
        try:
            return self.raster_below_caption(page_num, cap_y, next_cap_y, prose_y)
        except RuntimeError:
            if prose_y is not None:
                return self.raster_below_caption(page_num, cap_y, next_cap_y, None)
            raise

    @staticmethod
    def trim(image: Image.Image) -> Image.Image:
        arr = np.array(image)
        mask = np.any(arr < 248, axis=2)
        if not mask.any():
            return image
        rows = np.flatnonzero(mask.sum(axis=1) > 2)
        cols = np.flatnonzero(mask.sum(axis=0) > 2)
        if len(rows) == 0 or len(cols) == 0:
            return image
        pad = 8
        return image.crop(
            (
                max(0, int(cols[0]) - pad),
                max(0, int(rows[0]) - pad),
                min(image.width, int(cols[-1]) + pad + 1),
                min(image.height, int(rows[-1]) + pad + 1),
            )
        )


def extract_chapter_text(reader: PdfReader, chapter: ChapterSpec) -> tuple[list[str], list[int], int]:
    paragraphs: list[str] = [f"# CHAPTER {chapter.number}: {chapter.title}"]
    paragraph_pages: list[int] = [chapter.pdf_start]
    prose_buffer: list[str] = []
    formula_buffer: list[str] = []
    buffer_page = chapter.pdf_start
    stopped_page = chapter.pdf_end

    def flush_prose() -> None:
        nonlocal prose_buffer, buffer_page
        text = join_prose(prose_buffer)
        if text:
            paragraphs.append(text)
            paragraph_pages.append(buffer_page)
        prose_buffer = []

    def flush_formula() -> None:
        nonlocal formula_buffer, buffer_page
        text = normalize_formula(formula_buffer)
        if text:
            paragraphs.append(text)
            paragraph_pages.append(buffer_page)
        formula_buffer = []

    for page_num in range(chapter.pdf_start, chapter.pdf_end + 1):
        for clean in clean_page_lines(reader, page_num, chapter):
            if not clean:
                flush_prose()
                flush_formula()
                continue
            if is_recommended_reading(clean):
                flush_prose()
                flush_formula()
                stopped_page = page_num
                return paragraphs, paragraph_pages, stopped_page
            if SECTION_RE.match(clean):
                flush_prose()
                flush_formula()
                paragraphs.append(normalize_heading(clean))
                paragraph_pages.append(page_num)
                continue
            if looks_like_code_or_formula(clean):
                flush_prose()
                if not formula_buffer:
                    buffer_page = page_num
                formula_buffer.append(clean)
                continue
            if formula_buffer:
                flush_formula()
            if not prose_buffer:
                buffer_page = page_num
            prose_buffer.append(clean)
            if len(join_prose(prose_buffer)) >= 850 and re.search(r"[.!?]$", clean):
                flush_prose()

    flush_prose()
    flush_formula()
    return paragraphs, paragraph_pages, stopped_page


def focus_keywords(chapter: ChapterSpec, paragraphs: list[str]) -> list[str]:
    keywords = [chapter.title]
    for paragraph in paragraphs:
        if paragraph.startswith("## "):
            title = re.sub(r"^#+\s+\d+(?:\.\d+)*\s*", "", paragraph).strip()
            if title:
                keywords.append(title)
        if len(keywords) >= 8:
            break
    seen: set[str] = set()
    result: list[str] = []
    for keyword in keywords:
        key = keyword.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(keyword)
    return result


def save_contact_sheet(chapter: int, items: list[tuple[str, Path, tuple[int, int]]], contact_dir: Path) -> Path | None:
    if not items:
        return None
    cell_w, cell_h = 430, 300
    cols = 4
    rows = math.ceil(len(items) / cols)
    sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), "white")
    draw = ImageDraw.Draw(sheet)
    for index, (name, path, size) in enumerate(items):
        image = Image.open(path).convert("RGB")
        image.thumbnail((cell_w - 20, cell_h - 46), Image.LANCZOS)
        x = (index % cols) * cell_w + 10
        y = (index // cols) * cell_h + 28
        sheet.paste(image, (x, y))
        draw.text(
            ((index % cols) * cell_w + 8, (index // cols) * cell_h + 8),
            f"{name} {size[0]}x{size[1]}",
            fill="black",
        )
    contact_dir.mkdir(parents=True, exist_ok=True)
    target = contact_dir / f"networking-ch{chapter:02d}-contact.jpg"
    sheet.save(target, quality=88, optimize=True)
    return target


def next_caption_y(page_captions: list[dict[str, float | int | str]], figure: dict[str, float | int | str]) -> float | None:
    lower = [
        float(item["y"])
        for item in page_captions
        if int(item["page"]) == int(figure["page"]) and float(item["y"]) < float(figure["y"]) - 2
    ]
    return max(lower) if lower else None


def build_material(args: argparse.Namespace) -> dict:
    reader = PdfReader(str(args.pdf))
    figure_index = FigureIndex(reader)
    cropper = FigureCropper(args.pdf, reader, args.pdftoppm, args.dpi)
    figure_root = args.target_root / "learning/networking-book/figures"
    figure_root.mkdir(parents=True, exist_ok=True)
    if args.clean:
        for stale in figure_root.glob("networking-figure-*.jpg"):
            stale.unlink()
    topics: list[dict] = []
    dimensions: dict[str, dict[str, int]] = {}
    failures: list[str] = []

    for chapter in CHAPTERS:
        if chapter.number not in args.chapter_filter:
            continue
        paragraphs, paragraph_pages, stopped_page = extract_chapter_text(reader, chapter)
        figures: list[dict] = []
        contact_items: list[tuple[str, Path, tuple[int, int]]] = []
        chapter_figures = figure_index.chapter_figures(chapter, stopped_page)
        page_caption_map: dict[int, list[dict[str, float | int | str]]] = {}
        for figure in chapter_figures:
            page_caption_map.setdefault(int(figure["page"]), []).append(figure)
        for page_items in page_caption_map.values():
            page_items.sort(key=lambda item: float(item["y"]), reverse=True)

        for figure in chapter_figures:
            figure_number = int(figure["figure"])
            file_name = f"networking-figure-{chapter.number:02d}-{figure_number:03d}.jpg"
            public_src = f"/learning/networking-book/figures/{file_name}"
            target = figure_root / file_name
            next_y = next_caption_y(page_caption_map.get(int(figure["page"]), []), figure)
            try:
                crop = cropper.crop_figure(
                    int(figure["page"]),
                    float(figure["y"]),
                    next_y,
                    figure_index.prose_boundary_y(int(figure["page"]), float(figure["y"]), next_y),
                )
                if crop.width > args.max_width:
                    new_height = max(1, round(crop.height * (args.max_width / crop.width)))
                    crop = crop.resize((args.max_width, new_height), Image.LANCZOS)
                crop.save(target, quality=args.quality, optimize=True, progressive=True)
                width, height = crop.size
                dimensions[public_src] = {"width": width, "height": height}
                contact_items.append((target.name, target, crop.size))
            except Exception as exc:  # noqa: BLE001
                failures.append(f"{figure['label']} page {figure['page']}: {exc}")
                continue
            figures.append(
                {
                    "id": f"NET-CH{chapter.number:02d}-FIG-{figure_number:03d}",
                    "src": public_src,
                    "caption": str(figure["caption"]),
                    "page": int(figure["page"]),
                    "width": width,
                    "height": height,
                }
            )

        contact = save_contact_sheet(chapter.number, contact_items, args.contact_dir)
        avg_len = round(sum(len(paragraph) for paragraph in paragraphs) / max(1, len(paragraphs)))
        print(
            f"chapter {chapter.number:02d}: paragraphs={len(paragraphs)} avg_len={avg_len} "
            f"figures={len(figures)} stop={stopped_page} contact={contact}",
            flush=True,
        )
        topics.append(
            {
                "topicId": f"NET-CH-{chapter.number:02d}",
                "title": f"Chapter {chapter.number}: {chapter.title}",
                "difficulty": "Medium",
                "focusKeywords": focus_keywords(chapter, paragraphs),
                "readingParagraphs": paragraphs,
                "paragraphPages": paragraph_pages,
                "pageStart": chapter.pdf_start,
                "pageEnd": stopped_page,
                "figures": figures,
            }
        )

    if failures:
        for failure in failures:
            print(f"FIGURE_CROP_FAILURE {failure}", flush=True)
        raise RuntimeError(f"{len(failures)} figure crops failed")

    material = {
        "metadata": {
            "title": "Data Communications and Networking Textbook (PDF + Figures, Clean Minified)",
            "version": "1.0.0",
            "createdDate": "2026-06-07",
            "format": "minified-json-primary",
            "audience": "Learners studying computer networks chapter-by-chapter from textbook content",
            "trackId": "computer-science",
            "sourceFile": args.pdf.name,
            "notes": [
                "Chapter text was extracted from the source PDF and cleaned for readable study material.",
                "Each chapter ends before its Recommended Reading section.",
                "Figure images are cropped from textbook figure captions and compressed to keep project size manageable.",
            ],
        },
        "globalStudyPlan": [
            "Read the chapters in layer order, from data communication basics through security.",
            "Use the figures to anchor network models, signal transformations, addressing, routing, transport behavior, and application protocols.",
        ],
        "referenceCatalog": [],
        "subjects": [
            {
                "subjectId": "computer-networks-textbook",
                "order": 7,
                "title": "Computer Networks",
                "overview": "Forouzan Data Communications and Networking chapters with textbook-aligned headings and compressed figure crops.",
                "topicCount": len(topics),
                "topics": topics,
                "defaultReferenceIds": [],
            }
        ],
    }
    args.json.parent.mkdir(parents=True, exist_ok=True)
    args.json.write_text(json.dumps(material, separators=(",", ":")) + "\n")

    if args.dimensions.exists():
        dimension_data = json.loads(args.dimensions.read_text())
    else:
        dimension_data = {}
    dimension_data = {
        src: size for src, size in dimension_data.items() if not src.startswith("/learning/networking-book/figures/")
    }
    dimension_data.update(dimensions)
    args.dimensions.write_text(json.dumps(dimension_data, separators=(",", ":")) + "\n")
    print(f"wrote {args.json}", flush=True)
    print(f"updated dimensions with {len(dimensions)} networking figures", flush=True)
    return material


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON)
    parser.add_argument("--target-root", type=Path, default=DEFAULT_PUBLIC)
    parser.add_argument("--dimensions", type=Path, default=DEFAULT_DIMENSIONS)
    parser.add_argument("--contact-dir", type=Path, default=DEFAULT_CONTACTS)
    parser.add_argument("--pdftoppm", type=Path, default=DEFAULT_PDFTOPPM)
    parser.add_argument("--chapters", default="1-32")
    parser.add_argument("--dpi", type=int, default=155)
    parser.add_argument("--quality", type=int, default=58)
    parser.add_argument("--max-width", type=int, default=1300)
    parser.add_argument("--no-clean", action="store_false", dest="clean")
    parser.set_defaults(clean=True)
    args = parser.parse_args()
    args.chapter_filter = parse_chapters(args.chapters)
    build_material(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
