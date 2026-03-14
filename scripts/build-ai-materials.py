#!/usr/bin/env python3
"""Build AI learning material from the supplied textbook PDFs."""

from __future__ import annotations

import argparse
import collections
import json
import math
import os
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
from PIL import Image, ImageDraw
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_JSON = ROOT / "learning-material/ai_textbook_curriculum_clean.min.json"
DEFAULT_PUBLIC = ROOT / "apps/web/public"
DEFAULT_DIMENSIONS = ROOT / "apps/web/src/lib/learning/os-figure-dimensions.json"
DEFAULT_CONTACTS = Path("/private/tmp/ai-figure-contact-sheets")
DEFAULT_PDFTOPPM = Path("/Users/survivor/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/pdftoppm")
DEFAULT_OCR_SWIFT = ROOT / "scripts/vision-ocr.swift"


@dataclass(frozen=True)
class TopicSpec:
    title: str
    page_start: int
    page_end: int
    chapter_label: str | None = None
    direct_pages: bool = False


@dataclass(frozen=True)
class SubjectSpec:
    subject_id: str
    title: str
    order: int
    source_file: Path
    overview: str
    mode: str


SUBJECTS = (
    SubjectSpec(
        subject_id="machine-learning-tom-mitchell",
        title="Machine Learning",
        order=1,
        source_file=Path("/Users/survivor/Downloads/MachineLearningTomMitchell.pdf"),
        overview="Tom Mitchell's machine learning foundations, algorithms, theory, and classical learning paradigms.",
        mode="mitchell",
    ),
    SubjectSpec(
        subject_id="mathematics-for-machine-learning",
        title="Mathematics for Machine Learning",
        order=2,
        source_file=Path("/Users/survivor/Downloads/mml-book.pdf"),
        overview="Linear algebra, geometry, calculus, probability, optimization, and mathematical ML models.",
        mode="mml",
    ),
    SubjectSpec(
        subject_id="deep-learning-goodfellow",
        title="Deep Learning",
        order=3,
        source_file=Path("/Users/survivor/Downloads/DeepLearning.pdf"),
        overview="Goodfellow, Bengio, and Courville deep learning foundations. The supplied PDF is image-only, so its text is generated from local OCR instead of page screenshots.",
        mode="deep-learning-pages",
    ),
    SubjectSpec(
        subject_id="natural-language-processing-with-python",
        title="Natural Language Processing with Python",
        order=4,
        source_file=Path("/Users/survivor/Downloads/NLTK.pdf"),
        overview="NLTK-based NLP foundations, corpora, tagging, classification, parsing, semantics, and linguistic data management.",
        mode="nltk",
    ),
    SubjectSpec(
        subject_id="natural-language-processing-with-transformers",
        title="Natural Language Processing with Transformers",
        order=5,
        source_file=Path("/Users/survivor/Downloads/oreilly_chapter_excerpt_nlpt.pdf"),
        overview="Transformer architecture, question answering, scaling, and multimodal transformer directions.",
        mode="transformers",
    ),
    SubjectSpec(
        subject_id="computer-vision-algorithms-and-applications",
        title="Computer Vision Algorithms and Applications",
        order=6,
        source_file=Path("/Users/survivor/Downloads/Computer Vision Algorithms and Applications.pdf"),
        overview="Computer vision algorithms from image formation and filtering through recognition, geometry, reconstruction, and rendering.",
        mode="cv",
    ),
    SubjectSpec(
        subject_id="mlops-practitioners-guide",
        title="MLOps",
        order=7,
        source_file=Path("/Users/survivor/Downloads/practitioners_guide_to_mlops_whitepaper.pdf"),
        overview="Google Cloud's practitioner-oriented MLOps framework, lifecycle, capabilities, and operating processes.",
        mode="mlops",
    ),
)


MITCHELL_TOPICS = (
    TopicSpec("Introduction", 13, 36, "1"),
    TopicSpec("Concept Learning and the General-to-Specific Ordering", 37, 64, "2"),
    TopicSpec("Decision Tree Learning", 65, 108, "3"),
    TopicSpec("Artificial Neural Networks", 109, 139, "4"),
    TopicSpec("Evaluating Hypotheses", 140, 165, "5"),
    TopicSpec("Bayesian Learning", 166, 214, "6"),
    TopicSpec("Computational Learning Theory", 215, 242, "7"),
    TopicSpec("Instance-Based Learning", 243, 260, "8"),
    TopicSpec("Genetic Algorithms", 261, 285, "9"),
    TopicSpec("Learning Sets of Rules", 286, 336, "10"),
    TopicSpec("Analytical Learning", 337, 346, "11"),
    TopicSpec("Combining Inductive and Analytical Learning", 347, 382, "12"),
    TopicSpec("Reinforcement Learning", 383, 420, "13"),
)


DEEP_LEARNING_TOPICS = (
    TopicSpec("Introduction", 18, 35, "1", True),
    TopicSpec("Linear Algebra", 38, 53, "2", True),
    TopicSpec("Probability and Information Theory", 54, 71, "3", True),
    TopicSpec("Numerical Computation", 72, 84, "4", True),
    TopicSpec("Machine Learning Basics", 85, 85, "5", True),
)


MLOPS_TOPIC = TopicSpec("MLOps Practitioner Guide", 3, 37, None)


FIGURE_LABEL_PATTERN = r"(?:[A-Z]\.\d+|\d+(?:[.\-]\d+)*)(?:[A-Za-z])?"
CAPTION_START_RE = re.compile(rf"^(?:Figure|FIGURE)\s+({FIGURE_LABEL_PATTERN})\b\.?", re.IGNORECASE)
INLINE_CAPTION_VERBS = {
    "depicts",
    "illustrates",
    "lists",
    "presents",
    "provides",
    "shows",
    "summarizes",
}
SUMMARY_HEADING_RE = re.compile(
    r"^(?:\d+(?:\.\d+)*\s+)?(?:chapter\s+)?summary(?:\s+and\s+.*)?$",
    re.IGNORECASE,
)
SECTION_HEADING_RE = re.compile(r"^\d+(?:\.\d+)+\s+\S")
CHAPTER_HEADING_RE = re.compile(r"^Chapter\s+\d+\b", re.IGNORECASE)
NUMBERED_CHAPTER_RE = re.compile(r"^(\d+)\s+(.+)$")
NOISE_RE = re.compile(
    r"(?:copyright|all rights reserved|isbn|printed in|downloaded from|draft\s+\(\d{4}|"
    r"computer vision:\s+algorithms and applications|feedback:\s+https?://|this page intentionally)",
    re.IGNORECASE,
)
MATH_LINE_RE = re.compile(r"(?:[=<>]|\\sum|\\prod|\\frac|\\partial|\\nabla|arg\s*max|arg\s*min)")


def normalize_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def normalize_text(value: str) -> str:
    text = value.replace("\u00a0", " ").replace("\u00ad", "")
    replacements = {
        "\ufb00": "ff",
        "\ufb01": "fi",
        "\ufb02": "fl",
        "\ufb03": "ffi",
        "\ufb04": "ffl",
        "\u2010": "-",
        "\u2011": "-",
        "\u2012": "-",
        "\u2013": "-",
        "\u2014": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    text = re.sub(r"/uni[0-9A-Fa-f]{4}", "-", text)
    text = re.sub(r"([A-Za-z])-\s+([a-z])", r"\1\2", text)
    text = re.sub(r"([.!?])(?=[A-Z])", r"\1 ", text)
    text = re.sub(r"([a-z])([A-Z][a-z])", r"\1 \2", text)
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    return normalize_spaces(text)


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def flatten_outline(reader: PdfReader) -> list[tuple[int, str, int]]:
    entries: list[tuple[int, str, int]] = []

    def walk(items: Iterable, depth: int = 0) -> None:
        for item in items or []:
            if isinstance(item, list):
                walk(item, depth + 1)
                continue
            try:
                page = reader.get_destination_page_number(item) + 1
            except Exception:
                continue
            entries.append((depth, normalize_text(getattr(item, "title", str(item))), page))

    try:
        walk(reader.outline)
    except Exception:
        return []
    return entries


def is_caption_line(line: str) -> bool:
    match = CAPTION_START_RE.match(line)
    if not match:
        return False
    tail = line[match.end() :].strip()
    if not tail:
        return True
    if tail.startswith(")"):
        return False
    first_word = tail.split(" ", 1)[0].strip(".,;:").lower()
    if first_word in INLINE_CAPTION_VERBS:
        return False
    return True


def figure_label_from_line(line: str) -> str | None:
    match = CAPTION_START_RE.match(line)
    if not match:
        return None
    return f"Figure {match.group(1)}"


def looks_like_visual_line(line: str) -> bool:
    clean = normalize_text(line)
    if not clean:
        return True
    if is_caption_line(clean):
        return True
    words = clean.split()
    if len(words) <= 5:
        return True
    symbol_count = sum(1 for ch in clean if not ch.isalnum() and not ch.isspace())
    if symbol_count >= max(3, len(clean) // 8):
        return True
    if clean.isupper() and len(words) <= 12:
        return True
    return False


def caption_skip_indices(lines: list[str]) -> set[int]:
    skip: set[int] = set()
    for index, raw in enumerate(lines):
        clean = normalize_text(raw)
        if not is_caption_line(clean):
            continue
        skip.add(index)
        cursor = index - 1
        while cursor >= 0 and looks_like_visual_line(lines[cursor]):
            skip.add(cursor)
            cursor -= 1
        cursor = index + 1
        while cursor < len(lines):
            nxt = normalize_text(lines[cursor])
            if not nxt:
                break
            if SECTION_HEADING_RE.match(nxt) or CHAPTER_HEADING_RE.match(nxt) or is_caption_line(nxt):
                break
            skip.add(cursor)
            if re.search(r"[.!?]\s*$", nxt) and len(skip) > 1:
                break
            cursor += 1
    return skip


def is_noise_line(line: str, topic: TopicSpec) -> bool:
    clean = normalize_text(line)
    if not clean or clean.isdigit():
        return True
    if NOISE_RE.search(clean):
        return True
    if re.fullmatch(r"\d+\s*\|\s*.+", clean):
        return True
    if re.search(r"\|\s*\d+\s*$", clean):
        return True
    if re.fullmatch(r"\d{1,4}\s+[A-Z][A-Za-z ,&:/-]{3,}", clean) and topic.title.lower() in clean.lower():
        return True
    if re.fullmatch(r"CHAPTER\s+\d+\s+[A-Z0-9 ,:/-]+\s+\d+", clean, flags=re.IGNORECASE):
        return True
    return False


def is_heading(line: str) -> bool:
    clean = normalize_text(line)
    if CHAPTER_HEADING_RE.match(clean) or SECTION_HEADING_RE.match(clean):
        return True
    if len(clean) > 90 or len(clean) < 3:
        return False
    if clean.endswith((".", ",", ";", ":")):
        return False
    if re.search(r"[=<>]", clean):
        return False
    words = clean.split()
    if len(words) > 10:
        return False
    starts_upper = sum(1 for word in words if word[:1].isupper())
    return starts_upper >= max(1, math.ceil(len(words) * 0.55))


def normalize_heading(line: str, topic: TopicSpec) -> str:
    clean = normalize_text(line)
    if CHAPTER_HEADING_RE.match(clean):
        return f"# {clean}"
    if SECTION_HEADING_RE.match(clean):
        return f"## {clean}"
    if clean.lower() == topic.title.lower():
        return f"# {clean}"
    return f"## {clean}"


def looks_like_code(line: str) -> bool:
    clean = line.rstrip()
    stripped = clean.strip()
    if stripped.startswith((">>>", "...", "$ ", "% ", "In [", "Out[")):
        return True
    if stripped.startswith(("File \"", "Traceback ", "SyntaxError", "NameError", "TypeError", "ValueError")):
        return True
    if re.match(r"^(def|class|for|while|if|elif|else:|import|from|print|return|try:|except)\b", stripped):
        return True
    if re.match(r"^[A-Z][A-Z0-9_-]{3,}\s*\(", stripped):
        return True
    return False


def looks_like_formula(line: str) -> bool:
    clean = normalize_text(line)
    if len(clean) > 180:
        return False
    if MATH_LINE_RE.search(clean):
        letters = sum(1 for ch in clean if ch.isalpha())
        return letters < max(20, len(clean) * 0.7)
    return False


def join_prose(lines: list[str]) -> str:
    result = ""
    for raw in lines:
        clean = normalize_text(raw)
        if not clean:
            continue
        if not result:
            result = clean
            continue
        if result.endswith("-") and clean[:1].islower():
            result = result[:-1] + clean
        else:
            result += " " + clean
    return normalize_text(result)


def extract_topic_text(reader: PdfReader, topic: TopicSpec, skip_summaries: bool = True) -> tuple[list[str], list[int]]:
    title = f"Chapter {topic.chapter_label}: {topic.title}" if topic.chapter_label else topic.title
    paragraphs: list[str] = [f"# {title}"]
    pages: list[int] = [topic.page_start]
    prose_buffer: list[str] = []
    code_buffer: list[str] = []
    formula_buffer: list[str] = []
    buffer_page = topic.page_start
    in_summary = False

    def flush_prose() -> None:
        nonlocal prose_buffer, buffer_page
        text = join_prose(prose_buffer)
        if text:
            paragraphs.append(text)
            pages.append(buffer_page)
        prose_buffer = []

    def flush_code() -> None:
        nonlocal code_buffer, buffer_page
        if code_buffer:
            language = "python" if any(">>>" in line or line.strip().startswith(("def ", "import ", "from ")) for line in code_buffer) else "text"
            paragraphs.append(f"```{language}\n" + "\n".join(line.rstrip() for line in code_buffer).strip() + "\n```")
            pages.append(buffer_page)
        code_buffer = []

    def flush_formula() -> None:
        nonlocal formula_buffer, buffer_page
        if formula_buffer:
            paragraphs.append("```text\n" + "\n".join(normalize_text(line) for line in formula_buffer).strip() + "\n```")
            pages.append(buffer_page)
        formula_buffer = []

    for page_num in range(topic.page_start, min(topic.page_end, len(reader.pages)) + 1):
        raw_text = reader.pages[page_num - 1].extract_text() or ""
        raw_lines = raw_text.splitlines()
        skip_indices = caption_skip_indices(raw_lines)
        for index, raw_line in enumerate(raw_lines):
            clean = normalize_text(raw_line)
            if index in skip_indices or is_noise_line(clean, topic):
                continue
            if skip_summaries and SUMMARY_HEADING_RE.match(clean):
                flush_prose()
                flush_code()
                flush_formula()
                in_summary = True
                continue
            if in_summary:
                if is_heading(clean) and not SUMMARY_HEADING_RE.match(clean):
                    in_summary = False
                else:
                    continue
            if is_caption_line(clean):
                continue
            if is_heading(clean):
                flush_prose()
                flush_code()
                flush_formula()
                heading = normalize_heading(clean, topic)
                if paragraphs[-1] != heading:
                    paragraphs.append(heading)
                    pages.append(page_num)
                continue
            if looks_like_code(raw_line):
                flush_prose()
                flush_formula()
                if not code_buffer:
                    buffer_page = page_num
                code_buffer.append(raw_line.rstrip())
                continue
            if looks_like_formula(clean):
                flush_prose()
                flush_code()
                if not formula_buffer:
                    buffer_page = page_num
                formula_buffer.append(clean)
                continue
            flush_code()
            flush_formula()
            if not prose_buffer:
                buffer_page = page_num
            prose_buffer.append(clean)
            if len(join_prose(prose_buffer)) >= 1050 and re.search(r"[.!?]\s*$", clean):
                flush_prose()

    flush_prose()
    flush_code()
    flush_formula()
    return paragraphs, pages


class CaptionIndex:
    def __init__(self, reader: PdfReader) -> None:
        self.reader = reader
        self._caption_cache: dict[int, list[dict[str, float | int | str]]] = {}
        self._text_cache: dict[int, list[str]] = {}

    @staticmethod
    def _transform(matrix, x: float, y: float) -> tuple[float, float]:
        a, b, c, d, e, f = matrix
        return a * x + c * y + e, b * x + d * y + f

    def page_lines(self, page_num: int) -> list[str]:
        if page_num not in self._text_cache:
            text = self.reader.pages[page_num - 1].extract_text() or ""
            self._text_cache[page_num] = [normalize_text(line) for line in text.splitlines()]
        return self._text_cache[page_num]

    def caption_text(self, page_num: int, label: str) -> str:
        lines = self.page_lines(page_num)
        best = label
        for index, line in enumerate(lines):
            if figure_label_from_line(line) != label or not is_caption_line(line):
                continue
            parts = [line]
            cursor = index + 1
            while cursor < len(lines) and len(parts) < 5:
                nxt = lines[cursor]
                if not nxt or is_caption_line(nxt) or SECTION_HEADING_RE.match(nxt):
                    break
                parts.append(nxt)
                if re.search(r"[.!?]\s*$", nxt):
                    break
                cursor += 1
            best = normalize_text(" ".join(parts))
            break
        return best

    def captions_on_page(self, page_num: int) -> list[dict[str, float | int | str]]:
        if page_num in self._caption_cache:
            return self._caption_cache[page_num]
        fragments: list[dict[str, float | str]] = []

        def visit(text, cm, tm, font_dict, font_size):
            clean = normalize_text(text.replace("\n", " "))
            if not clean:
                return
            raw_x, raw_y = float(tm[4]), float(tm[5])
            transformed_x, transformed_y = self._transform(cm, raw_x, raw_y)
            x = raw_x if abs(raw_x) >= 0.01 else transformed_x
            y = raw_y if abs(raw_y) >= 0.01 else transformed_y
            fragments.append(
                {
                    "text": clean,
                    "x": float(x),
                    "y": float(y),
                    "font": str((font_dict or {}).get("/BaseFont", "")),
                }
            )

        self.reader.pages[page_num - 1].extract_text(visitor_text=visit)

        grouped: dict[int, list[dict[str, float | str]]] = collections.defaultdict(list)
        for fragment in fragments:
            grouped[round(float(fragment["y"]) / 2) * 2].append(fragment)

        items: list[dict[str, float | int | str]] = []
        for group in grouped.values():
            group.sort(key=lambda item: float(item["x"]))
            clean = normalize_text(" ".join(str(item["text"]) for item in group))
            if not is_caption_line(clean):
                continue
            label = figure_label_from_line(clean)
            if not label:
                continue
            items.append(
                {
                    "label": label,
                    "labelSlug": slugify(label),
                    "page": page_num,
                    "x": min(float(item["x"]) for item in group),
                    "y": max(float(item["y"]) for item in group),
                    "caption": self.caption_text(page_num, label),
                    "font": str(group[0].get("font", "")),
                }
            )
        seen: set[tuple[str, int]] = set()
        unique: list[dict[str, float | int | str]] = []
        for item in sorted(items, key=lambda entry: (str(entry["label"]), -float(entry["y"]))):
            key = (str(item["label"]), round(float(item["y"])))
            if key in seen:
                continue
            seen.add(key)
            unique.append(item)
        self._caption_cache[page_num] = unique
        return unique

    def captions_for_topic(self, topic: TopicSpec) -> list[dict[str, float | int | str]]:
        captions: list[dict[str, float | int | str]] = []
        for page_num in range(topic.page_start, min(topic.page_end, len(self.reader.pages)) + 1):
            captions.extend(self.captions_on_page(page_num))
        captions.sort(key=lambda item: (int(item["page"]), -float(item["y"]), str(item["label"])))
        return captions


class PageRenderer:
    def __init__(self, pdf_path: Path, reader: PdfReader, pdftoppm: Path, dpi: int) -> None:
        self.pdf_path = pdf_path
        self.reader = reader
        self.pdftoppm = pdftoppm
        self.dpi = dpi
        self.cache: collections.OrderedDict[int, Image.Image] = collections.OrderedDict()
        self.draw_cache: dict[int, list[tuple[float, float, float, float]]] = {}

    @staticmethod
    def _num(value) -> float:
        return float(value.as_numeric() if hasattr(value, "as_numeric") else value)

    @staticmethod
    def _transform(matrix, x: float, y: float) -> tuple[float, float]:
        a, b, c, d, e, f = matrix
        return a * x + c * y + e, b * x + d * y + f

    def page_box(self, page_num: int) -> tuple[float, float, float, float]:
        media = self.reader.pages[page_num - 1].mediabox
        return float(media.left), float(media.bottom), float(media.right), float(media.top)

    def render_page(self, page_num: int) -> Image.Image:
        if page_num in self.cache:
            image = self.cache.pop(page_num)
            self.cache[page_num] = image
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
                    "-jpeg",
                    "-singlefile",
                    str(self.pdf_path),
                    str(prefix),
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            image = Image.open(str(prefix) + ".jpg").convert("RGB")
        self.cache[page_num] = image
        while len(self.cache) > 10:
            self.cache.popitem(last=False)
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
            if x1 - x0 <= 2 or y1 - y0 <= 2:
                return
            if (x1 - x0) > (right - left) * 0.96 and (y1 - y0) > (top - bottom) * 0.96:
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

    def crop_from_pdf_box(self, page_num: int, box: tuple[float, float, float, float]) -> Image.Image:
        image = self.render_page(page_num)
        left, bottom, right, top = self.page_box(page_num)
        scale = image.height / (top - bottom)
        x0, y0, x1, y1 = box
        x0 = max(left, x0 - 8)
        x1 = min(right, x1 + 8)
        y0 = max(bottom, y0 - 8)
        y1 = min(top, y1 + 8)
        if x1 <= x0 or y1 <= y0:
            raise RuntimeError("invalid pdf crop box")
        px0 = max(0, int((x0 - left) * scale))
        px1 = min(image.width, int(math.ceil((x1 - left) * scale)))
        py0 = max(0, int((top - y1) * scale))
        py1 = min(image.height, int(math.ceil((top - y0) * scale)))
        if px1 <= px0 or py1 <= py0:
            raise RuntimeError("invalid raster crop box")
        return self.trim(image.crop((px0, py0, px1, py1)))

    def select_visual_box(self, page_num: int, cap_y: float) -> tuple[float, float, float, float] | None:
        left, bottom, right, top = self.page_box(page_num)
        page_height = top - bottom
        page_area = (right - left) * page_height
        candidates: list[tuple[float, tuple[float, float, float, float]]] = []
        for box in self.drawing_boxes(page_num):
            x0, y0, x1, y1 = box
            width = x1 - x0
            height = y1 - y0
            area = width * height
            if area < 240 or area > page_area * 0.82:
                continue
            distance: float | None = None
            if y0 >= cap_y - 2:
                distance = max(0.0, y0 - cap_y)
            elif y1 <= cap_y + 2:
                distance = max(0.0, cap_y - y1)
            elif y0 <= cap_y <= y1:
                distance = 0.0
            if distance is None or distance > page_height * 0.38:
                continue
            if width < 24 or height < 12:
                continue
            score = math.log(area) - (distance / max(1, page_height)) * 3
            if width > (right - left) * 0.35:
                score += 0.8
            candidates.append((score, box))
        if not candidates:
            return None
        candidates.sort(key=lambda item: item[0], reverse=True)
        return candidates[0][1]

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

    @staticmethod
    def row_groups(rows: np.ndarray, max_gap: int) -> list[tuple[int, int]]:
        if len(rows) == 0:
            return []
        groups: list[tuple[int, int]] = []
        start = previous = int(rows[0])
        for value in rows[1:]:
            current = int(value)
            if current - previous <= max_gap:
                previous = current
                continue
            groups.append((start, previous))
            start = previous = current
        groups.append((start, previous))
        return groups

    def crop_region(self, image: Image.Image, y0: int, y1: int) -> Image.Image | None:
        if y1 <= y0:
            return None
        arr = np.array(image)
        mask = np.any(arr < 247, axis=2)
        height, width = mask.shape
        y0 = max(0, min(height - 1, y0))
        y1 = max(y0 + 1, min(height, y1))
        submask = mask[y0:y1, :]
        cols = np.flatnonzero(submask.sum(axis=0) > max(2, int((y1 - y0) * 0.004)))
        if len(cols) == 0:
            return None
        x0 = max(0, int(cols[0]) - 10)
        x1 = min(width, int(cols[-1]) + 11)
        return self.cleanup_raster_crop(self.trim(image.crop((x0, max(0, y0 - 8), x1, min(height, y1 + 9)))))

    def cleanup_raster_crop(self, image: Image.Image) -> Image.Image:
        arr = np.array(image)
        mask = np.any(arr < 247, axis=2)
        if not mask.any():
            return image
        width = image.width
        row_dark = mask.sum(axis=1)
        active = row_dark > max(5, int(width * 0.003))
        rows = np.flatnonzero(active)
        groups = self.row_groups(rows, max_gap=16)
        if len(groups) < 2:
            return image

        top = 0
        bottom = image.height
        first_start, first_end = groups[0]
        second_start, _second_end = groups[1]
        if first_start <= 12 and first_end - first_start <= 34 and second_start - first_end >= 22:
            top = min(image.height - 1, second_start - 8)

        if len(groups) >= 3:
            last_start, last_end = groups[-1]
            prev_start, prev_end = groups[-2]
            last_height = last_end - last_start + 1
            last_density = float(row_dark[last_start : last_end + 1].mean())
            if (
                last_start - prev_end >= 28
                and last_height >= 42
                and last_density > width * 0.13
                and last_start > image.height * 0.62
                and prev_start > image.height * 0.45
            ):
                bottom = max(top + 1, min(image.height, prev_end + 12))

        if top == 0 and bottom == image.height:
            return image
        return self.trim(image.crop((0, top, image.width, bottom)))

    def crop_near_caption(self, page_num: int, cap_y: float) -> Image.Image:
        visual_box = self.select_visual_box(page_num, cap_y)
        if visual_box is not None:
            try:
                return self.crop_from_pdf_box(page_num, visual_box)
            except Exception:
                pass

        image = self.render_page(page_num)
        _left, bottom, _right, top = self.page_box(page_num)
        scale = image.height / (top - bottom)
        cap_px = int((top - cap_y) * scale)
        arr = np.array(image)
        mask = np.any(arr < 247, axis=2)
        height, width = mask.shape
        margin = max(18, int(20 * scale))
        row_dark = mask[:, margin : width - margin].sum(axis=1)
        active = row_dark > max(5, int(width * 0.003))
        active[: max(10, int(20 * scale))] = False
        active[height - max(10, int(20 * scale)) :] = False

        candidates: list[tuple[float, Image.Image]] = []
        orientations = ("above", "below") if cap_y < (top - bottom) * 0.55 else ("below", "above")
        for orientation in orientations:
            if orientation == "above":
                rows = np.flatnonzero(active[: max(0, cap_px - int(4 * scale))])
                groups = self.row_groups(rows, max(10, int(16 * scale)))
                if groups:
                    start, end = groups[-1]
                    while len(groups) >= 2 and start - groups[-2][1] <= max(24, int(34 * scale)):
                        previous = groups.pop(-2)
                        start = min(start, previous[0])
                    crop = self.crop_region(image, start, end)
                    if crop is not None:
                        candidates.append((self.crop_score(crop, image, preferred=True), crop))
            else:
                start_px = max(0, cap_px - int(20 * scale))
                rows = np.flatnonzero(active[start_px:]) + start_px
                groups = self.row_groups(rows, max(10, int(16 * scale)))
                for start, end in groups[:3]:
                    if end - start < max(16, int(16 * scale)):
                        continue
                    crop = self.crop_region(image, start, end)
                    if crop is not None:
                        candidates.append((self.crop_score(crop, image, preferred=True), crop))
                        break

        if candidates:
            candidates.sort(key=lambda item: item[0], reverse=True)
            return candidates[0][1]

        page_crop = image.crop((int(width * 0.08), int(height * 0.08), int(width * 0.92), int(height * 0.92)))
        return self.cleanup_raster_crop(self.trim(page_crop))

    @staticmethod
    def crop_score(crop: Image.Image, page: Image.Image, preferred: bool = False) -> float:
        area = crop.width * crop.height
        page_area = page.width * page.height
        if crop.width < 60 or crop.height < 35:
            return -1
        score = math.log(max(1, area))
        if area > page_area * 0.72:
            score -= 6
        if crop.width > crop.height:
            score += 0.5
        if preferred:
            score += 1
        return score


def save_image(image: Image.Image, target: Path, quality: int, max_width: int) -> tuple[int, int]:
    if image.width > max_width:
        new_height = max(1, round(image.height * (max_width / image.width)))
        image = image.resize((max_width, new_height), Image.LANCZOS)
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, quality=quality, optimize=True, progressive=True)
    return image.size


def save_contact_sheet(subject_slug: str, items: list[tuple[str, Path, tuple[int, int]]], contact_dir: Path) -> Path | None:
    if not items:
        return None
    cell_w, cell_h = 360, 260
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
    target = contact_dir / f"{subject_slug}-contact.jpg"
    sheet.save(target, quality=86, optimize=True)
    return target


def outline_topics(reader: PdfReader, mode: str) -> tuple[TopicSpec, ...]:
    outline = flatten_outline(reader)
    selected: list[tuple[int, str, int]] = []
    if mode == "mml":
        selected = [
            (depth, title, page)
            for depth, title, page in outline
            if depth == 1 and re.match(r"^\d+\s+", title)
        ]
    elif mode in {"nltk", "transformers"}:
        selected = [
            (depth, title, page)
            for depth, title, page in outline
            if depth == 0 and title.lower().startswith("chapter")
        ]
    elif mode == "cv":
        blocked = {"Preface", "Contents", "References", "Index", "Supplementary material"}
        selected = [
            (depth, title, page)
            for depth, title, page in outline
            if depth == 0 and title not in blocked and 27 <= page < 999
        ]

    topics: list[TopicSpec] = []
    for index, (_depth, title, start) in enumerate(selected):
        next_start = selected[index + 1][2] if index + 1 < len(selected) else len(reader.pages) + 1
        boundary_pages = [
            page
            for depth, _boundary_title, page in outline
            if page > start and depth <= _depth
        ]
        if boundary_pages:
            next_start = min(next_start, min(boundary_pages))
        end = max(start, next_start - 1)
        chapter_label: str | None = None
        topic_title = title
        chapter_match = re.match(r"^Chapter\s+(\d+)\.?\s*(.+)$", title, re.IGNORECASE)
        if chapter_match:
            chapter_label = chapter_match.group(1)
            topic_title = chapter_match.group(2).strip()
        elif mode == "mml":
            numbered = NUMBERED_CHAPTER_RE.match(title)
            if numbered:
                chapter_label = numbered.group(1)
                topic_title = numbered.group(2).strip()
        elif mode == "cv":
            chapter_label = str(index + 1)
        topics.append(TopicSpec(topic_title, start, min(end, len(reader.pages)), chapter_label))
    return tuple(topics)


def topics_for_subject(subject: SubjectSpec, reader: PdfReader) -> tuple[TopicSpec, ...]:
    if subject.mode == "mitchell":
        return MITCHELL_TOPICS
    if subject.mode == "deep-learning-pages":
        return DEEP_LEARNING_TOPICS
    if subject.mode == "mlops":
        return (MLOPS_TOPIC,)
    return outline_topics(reader, subject.mode)


def focus_keywords(topic: TopicSpec, paragraphs: list[str]) -> list[str]:
    keywords = [topic.title]
    for paragraph in paragraphs:
        if paragraph.startswith("## "):
            clean = re.sub(r"^#+\s+\d+(?:\.\d+)*\s*", "", paragraph).strip()
            if clean:
                keywords.append(clean)
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
    return result[:8]


def run_vision_ocr(image_paths: list[Path], ocr_script: Path) -> dict[int, list[dict[str, float | str]]]:
    if not image_paths:
        return {}
    env = os.environ.copy()
    env["CLANG_MODULE_CACHE_PATH"] = "/private/tmp/clang-module-cache"
    result = subprocess.run(
        ["swift", str(ocr_script), *[str(path) for path in image_paths]],
        check=True,
        capture_output=True,
        env=env,
        text=True,
    )
    payload = json.loads(result.stdout)
    failures = payload.get("failures", {})
    if failures:
        raise RuntimeError(f"Vision OCR failed for {len(failures)} page images: {failures}")

    by_page: dict[int, list[dict[str, float | str]]] = {}
    for path, lines in payload.get("pages", {}).items():
        match = re.search(r"page-(\d+)\.jpg$", str(path))
        if not match:
            continue
        page_num = int(match.group(1))
        if not isinstance(lines, list):
            continue
        cleaned_lines: list[dict[str, float | str]] = []
        for line in lines:
            if not isinstance(line, dict):
                continue
            text = normalize_text(str(line.get("text", "")))
            if not text:
                continue
            cleaned_lines.append(
                {
                    "confidence": float(line.get("confidence", 0)),
                    "height": float(line.get("height", 0)),
                    "text": text,
                    "width": float(line.get("width", 0)),
                    "x": float(line.get("x", 0)),
                    "y": float(line.get("y", 0)),
                }
            )
        by_page[page_num] = sorted(cleaned_lines, key=lambda item: (-float(item["y"]), float(item["x"])))
    return by_page


def is_ocr_noise_line(line: str) -> bool:
    clean = normalize_text(line)
    if not clean:
        return True
    if re.fullmatch(r"\d{1,4}", clean):
        return True
    if clean.lower() in {"deep learning", "copyrighted material"}:
        return True
    if re.fullmatch(r"chapter\s+\d+", clean, flags=re.IGNORECASE):
        return True
    if clean.lower().startswith("part i"):
        return True
    return False


def build_ocr_paragraphs(topic: TopicSpec, ocr_by_page: dict[int, list[dict[str, float | str]]]) -> tuple[list[str], list[int]]:
    title = f"Chapter {topic.chapter_label}: {topic.title}" if topic.chapter_label else topic.title
    paragraphs: list[str] = [f"# {title}"]
    paragraph_pages: list[int] = [topic.page_start]
    prose_buffer: list[str] = []
    formula_buffer: list[str] = []
    buffer_page = topic.page_start
    in_summary = False

    def flush_prose() -> None:
        nonlocal prose_buffer, buffer_page
        text = join_prose(prose_buffer)
        if text:
            paragraphs.append(text)
            paragraph_pages.append(buffer_page)
        prose_buffer = []

    def flush_formula() -> None:
        nonlocal formula_buffer, buffer_page
        if formula_buffer:
            paragraphs.append("```text\n" + "\n".join(normalize_text(line) for line in formula_buffer).strip() + "\n```")
            paragraph_pages.append(buffer_page)
        formula_buffer = []

    for page_num in range(topic.page_start, topic.page_end + 1):
        for entry in ocr_by_page.get(page_num, []):
            clean = normalize_text(str(entry["text"]))
            if is_ocr_noise_line(clean):
                continue
            if SUMMARY_HEADING_RE.match(clean):
                flush_prose()
                flush_formula()
                in_summary = True
                continue
            if in_summary:
                if is_heading(clean) and not SUMMARY_HEADING_RE.match(clean):
                    in_summary = False
                else:
                    continue
            if is_heading(clean):
                flush_prose()
                flush_formula()
                heading = normalize_heading(clean, topic)
                if paragraphs[-1] != heading:
                    paragraphs.append(heading)
                    paragraph_pages.append(page_num)
                continue
            if looks_like_formula(clean):
                flush_prose()
                if not formula_buffer:
                    buffer_page = page_num
                formula_buffer.append(clean)
                continue
            flush_formula()
            if not prose_buffer:
                buffer_page = page_num
            prose_buffer.append(clean)
            if len(join_prose(prose_buffer)) >= 950 and re.search(r"[.!?]\s*$", clean):
                flush_prose()

    flush_prose()
    flush_formula()
    return paragraphs, paragraph_pages


def render_ocr_images(topic_specs: tuple[TopicSpec, ...], renderer: PageRenderer, target_dir: Path) -> list[Path]:
    image_paths: list[Path] = []
    seen_pages = sorted({page for topic in topic_specs for page in range(topic.page_start, topic.page_end + 1)})
    target_dir.mkdir(parents=True, exist_ok=True)
    for page_num in seen_pages:
        image = renderer.render_page(page_num)
        target = target_dir / f"page-{page_num:03d}.jpg"
        image.save(target, quality=96, optimize=True)
        image_paths.append(target)
    return image_paths


def build_deep_learning_ocr_topic(
    subject: SubjectSpec,
    topic: TopicSpec,
    index: int,
    ocr_by_page: dict[int, list[dict[str, float | str]]],
) -> tuple[dict, dict[str, dict[str, int]], list[tuple[str, Path, tuple[int, int]]]]:
    title = f"Chapter {topic.chapter_label}: {topic.title}" if topic.chapter_label else topic.title
    paragraphs, paragraph_pages = build_ocr_paragraphs(topic, ocr_by_page)
    topic_json = {
        "topicId": f"AI-{subject.order:02d}-{slugify(subject.subject_id)}-{index + 1:02d}",
        "title": title,
        "difficulty": "Hard",
        "focusKeywords": focus_keywords(topic, paragraphs),
        "readingParagraphs": paragraphs,
        "paragraphPages": paragraph_pages,
        "pageStart": topic.page_start,
        "pageEnd": topic.page_end,
        "figures": [],
    }
    return topic_json, {}, []


def build_text_topic(
    subject: SubjectSpec,
    topic: TopicSpec,
    index: int,
    reader: PdfReader,
    caption_index: CaptionIndex,
    renderer: PageRenderer,
    figure_root: Path,
    quality: int,
    max_width: int,
) -> tuple[dict, dict[str, dict[str, int]], list[tuple[str, Path, tuple[int, int]]], list[str]]:
    paragraphs, paragraph_pages = extract_topic_text(reader, topic, skip_summaries=subject.mode != "mlops")
    figures: list[dict] = []
    dimensions: dict[str, dict[str, int]] = {}
    contact_items: list[tuple[str, Path, tuple[int, int]]] = []
    failures: list[str] = []
    seen_labels: set[tuple[str, int]] = set()
    for caption in caption_index.captions_for_topic(topic):
        label = str(caption["label"])
        page_num = int(caption["page"])
        key = (label, page_num)
        if key in seen_labels:
            continue
        seen_labels.add(key)
        file_name = f"{slugify(subject.subject_id)}-{slugify(label)}-p{page_num:04d}.jpg"
        public_src = f"/learning/ai-textbooks/{subject.subject_id}/figures/{file_name}"
        target = figure_root / subject.subject_id / "figures" / file_name
        try:
            crop = renderer.crop_near_caption(page_num, float(caption["y"]))
            width, height = save_image(crop, target, quality, max_width)
        except Exception as exc:  # noqa: BLE001 - batch reports all crop misses.
            failures.append(f"{subject.title} {label} page {page_num}: {exc}")
            continue
        dimensions[public_src] = {"width": width, "height": height}
        contact_items.append((target.name, target, (width, height)))
        figures.append(
            {
                "id": f"AI-{subject.order:02d}-{slugify(label)}-P{page_num:04d}",
                "src": public_src,
                "caption": str(caption["caption"]),
                "page": page_num,
                "width": width,
                "height": height,
            }
        )

    title = f"Chapter {topic.chapter_label}: {topic.title}" if topic.chapter_label else topic.title
    topic_json = {
        "topicId": f"AI-{subject.order:02d}-{slugify(subject.subject_id)}-{index + 1:02d}",
        "title": title,
        "difficulty": "Hard" if subject.mode in {"mml", "cv"} else "Medium",
        "focusKeywords": focus_keywords(topic, paragraphs),
        "readingParagraphs": paragraphs,
        "paragraphPages": paragraph_pages,
        "pageStart": topic.page_start,
        "pageEnd": topic.page_end,
        "figures": figures,
    }
    return topic_json, dimensions, contact_items, failures


def build_material(args: argparse.Namespace) -> dict:
    figure_root = args.target_root / "learning/ai-textbooks"
    if args.clean and figure_root.exists():
        shutil.rmtree(figure_root)
    figure_root.mkdir(parents=True, exist_ok=True)
    all_dimensions: dict[str, dict[str, int]] = {}
    subjects: list[dict] = []
    all_failures: list[str] = []

    for subject in SUBJECTS:
        reader = PdfReader(str(subject.source_file))
        renderer = PageRenderer(subject.source_file, reader, args.pdftoppm, args.dpi)
        caption_index = CaptionIndex(reader)
        topics: list[dict] = []
        subject_contact_items: list[tuple[str, Path, tuple[int, int]]] = []
        specs = topics_for_subject(subject, reader)
        deep_learning_ocr: dict[int, list[dict[str, float | str]]] = {}
        if subject.mode == "deep-learning-pages":
            ocr_renderer = PageRenderer(subject.source_file, reader, args.pdftoppm, args.ocr_dpi)
            with tempfile.TemporaryDirectory() as tmp_dir:
                ocr_images = render_ocr_images(specs, ocr_renderer, Path(tmp_dir))
                deep_learning_ocr = run_vision_ocr(ocr_images, args.ocr_script)
        for index, topic in enumerate(specs):
            if subject.mode == "deep-learning-pages":
                topic_json, dimensions, contact_items = build_deep_learning_ocr_topic(
                    subject,
                    topic,
                    index,
                    deep_learning_ocr,
                )
                failures: list[str] = []
            else:
                topic_json, dimensions, contact_items, failures = build_text_topic(
                    subject,
                    topic,
                    index,
                    reader,
                    caption_index,
                    renderer,
                    figure_root,
                    args.quality,
                    args.max_width,
                )
            topics.append(topic_json)
            all_dimensions.update(dimensions)
            subject_contact_items.extend(contact_items)
            all_failures.extend(failures)
            avg_len = round(
                sum(len(paragraph) for paragraph in topic_json["readingParagraphs"])
                / max(1, len(topic_json["readingParagraphs"]))
            )
            print(
                f"{subject.order}. {subject.title} topic {index + 1:02d}: "
                f"paragraphs={len(topic_json['readingParagraphs'])} avg_len={avg_len} "
                f"figures={len(topic_json['figures'])} pages={topic.page_start}-{topic.page_end}",
                flush=True,
            )
        contact = save_contact_sheet(slugify(subject.subject_id), subject_contact_items, args.contact_dir)
        print(
            f"{subject.order}. {subject.title}: topics={len(topics)} figures={len(subject_contact_items)} contact={contact}",
            flush=True,
        )
        subjects.append(
            {
                "subjectId": subject.subject_id,
                "order": subject.order,
                "title": subject.title,
                "overview": subject.overview,
                "topicCount": len(topics),
                "topics": topics,
                "defaultReferenceIds": [],
            }
        )

    if all_failures:
        for failure in all_failures:
            print(f"FIGURE_CROP_FAILURE {failure}", flush=True)
        print(f"continued with {len(all_failures)} figure crop failures", flush=True)

    material = {
        "metadata": {
            "title": "AI Textbook Materials (PDF Text + Figures, Clean Minified)",
            "version": "2.0.0",
            "createdDate": "2026-06-07",
            "format": "minified-json-primary",
            "trackId": "ai",
            "sourceFiles": [subject.source_file.name for subject in SUBJECTS],
            "notes": [
                "Subjects are ordered exactly as requested by the user.",
                "Text-bearing PDFs are extracted by chapter or source section with chapter-end summaries omitted.",
                "Figures are generated from detected textbook figure captions and compressed for the web app.",
                "DeepLearning.pdf has no extractable text layer, so its topic text is generated from local OCR and page screenshots are not published.",
                "MLOps is represented as one direct whitepaper topic rather than chapter cards.",
            ],
        },
        "globalStudyPlan": [
            "Move in order from classical machine learning to mathematical foundations, deep learning, NLP, transformers, computer vision, and MLOps.",
            "Use each chapter's extracted figures alongside the source text so diagrams, code, formulas, and workflows stay connected.",
        ],
        "referenceCatalog": [],
        "subjects": subjects,
    }

    args.json.parent.mkdir(parents=True, exist_ok=True)
    args.json.write_text(json.dumps(material, ensure_ascii=False, separators=(",", ":")) + "\n")

    if args.dimensions.exists():
        dimension_data = json.loads(args.dimensions.read_text())
    else:
        dimension_data = {}
    dimension_data = {
        src: size for src, size in dimension_data.items() if not src.startswith("/learning/ai-textbooks/")
    }
    dimension_data.update(all_dimensions)
    args.dimensions.write_text(json.dumps(dimension_data, separators=(",", ":")) + "\n")
    print(f"wrote {args.json}", flush=True)
    print(f"updated dimensions with {len(all_dimensions)} AI images", flush=True)
    return material


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON)
    parser.add_argument("--target-root", type=Path, default=DEFAULT_PUBLIC)
    parser.add_argument("--dimensions", type=Path, default=DEFAULT_DIMENSIONS)
    parser.add_argument("--contact-dir", type=Path, default=DEFAULT_CONTACTS)
    parser.add_argument("--pdftoppm", type=Path, default=DEFAULT_PDFTOPPM)
    parser.add_argument("--ocr-script", type=Path, default=DEFAULT_OCR_SWIFT)
    parser.add_argument("--dpi", type=int, default=135)
    parser.add_argument("--ocr-dpi", type=int, default=180)
    parser.add_argument("--quality", type=int, default=54)
    parser.add_argument("--max-width", type=int, default=1050)
    parser.add_argument("--no-clean", action="store_false", dest="clean")
    parser.set_defaults(clean=True)
    args = parser.parse_args()
    build_material(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
