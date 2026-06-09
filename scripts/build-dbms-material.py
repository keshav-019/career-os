#!/usr/bin/env python3
"""Build Database System Concepts chapter material and figure crops from the PDF."""

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
    "/Users/survivor/Downloads/"
    "Abraham-Silberschatz-Henry-F.-Korth-S.-Sudarshan-Database-System-Concepts-"
    "McGraw-Hill-Education-2019.pdf"
)
DEFAULT_JSON = ROOT / "learning-material/database_systems_textbook_clean.min.json"
DEFAULT_PUBLIC = ROOT / "apps/web/public"
DEFAULT_DIMENSIONS = ROOT / "apps/web/src/lib/learning/os-figure-dimensions.json"
DEFAULT_CONTACTS = Path("/private/tmp/dbms-figure-contact-sheets")
DEFAULT_PDFTOPPM = (
    Path("/Users/survivor/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/pdftoppm")
)


@dataclass(frozen=True)
class ChapterSpec:
    number: int
    title: str
    page_start: int
    page_end: int


CHAPTERS: tuple[ChapterSpec, ...] = (
    ChapterSpec(1, "Introduction", 30, 65),
    ChapterSpec(2, "Introduction to the Relational Model", 66, 93),
    ChapterSpec(3, "Introduction to SQL", 94, 153),
    ChapterSpec(4, "Intermediate SQL", 154, 211),
    ChapterSpec(5, "Advanced SQL", 212, 269),
    ChapterSpec(6, "Database Design Using the E-R Model", 270, 331),
    ChapterSpec(7, "Relational Database Design", 332, 393),
    ChapterSpec(8, "Complex Data Types", 394, 431),
    ChapterSpec(9, "Application Development", 432, 495),
    ChapterSpec(10, "Big Data", 496, 547),
    ChapterSpec(11, "Data Analytics", 548, 587),
    ChapterSpec(12, "Physical Storage Systems", 588, 615),
    ChapterSpec(13, "Data Storage Structures", 616, 651),
    ChapterSpec(14, "Indexing", 652, 717),
    ChapterSpec(15, "Query Processing", 718, 771),
    ChapterSpec(16, "Query Optimization", 772, 827),
    ChapterSpec(17, "Transactions", 828, 863),
    ChapterSpec(18, "Concurrency Control", 864, 935),
    ChapterSpec(19, "Recovery System", 936, 989),
    ChapterSpec(20, "Database-System Architectures", 990, 1031),
    ChapterSpec(21, "Parallel and Distributed Storage", 1032, 1067),
    ChapterSpec(22, "Parallel and Distributed Query Processing", 1068, 1126),
    ChapterSpec(23, "Parallel and Distributed Transaction Processing", 1127, 1203),
    ChapterSpec(24, "Advanced Indexing Techniques", 1204, 1238),
    ChapterSpec(25, "Advanced Application Development", 1239, 1280),
    ChapterSpec(26, "Blockchain Databases", 1281, 1315),
)


SECTION_RE = re.compile(r"^(\d+\.\d+(?:\.\d+)*)\s+(.+)$")
CAPTION_LABEL_RE = re.compile(r"^Figure\s+(\d+)\.(\d+)$")
CAPTION_LINE_RE = re.compile(r"^Figure\s+(\d+)\.(\d+)\b\s*(.*)$")
RUNNING_SECTION_RE = re.compile(r"^\d+\.\d+(?:\.\d+)?\s+.+\s+\d+$")
PAGE_HEADER_RE = re.compile(r"^\d+\s+Chapter\s+\d+\b", re.IGNORECASE)
SQL_START_RE = re.compile(
    r"^(alter|begin|case|class|commit|connect|create|delete|drop|else|end|except|"
    r"for|from|grant|if|import|insert|interface|join|public|return|revoke|rollback|"
    r"select|try|union|update|values|where|while|with)\b",
    re.IGNORECASE,
)
PROSE_FIGURE_VERBS = {
    "shows",
    "show",
    "presents",
    "present",
    "illustrates",
    "illustrate",
    "depicts",
    "depict",
    "contains",
    "contain",
    "lists",
    "list",
    "gives",
    "give",
    "outlines",
    "outline",
    "summarizes",
    "summarize",
    "is",
    "are",
    "has",
    "have",
    "was",
    "were",
}


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


def normalize_figure_spacing(value: str) -> str:
    text = value
    text = re.sub(r"\bF\s*i\s*g\s*u\s*r\s*e\b", "Figure", text, flags=re.IGNORECASE)
    text = re.sub(r"\bFig\s*u\s*r\s*e\b", "Figure", text, flags=re.IGNORECASE)
    text = re.sub(r"Figure\s+(\d+)\s*\.\s*(\d+)", r"Figure \1.\2", text, flags=re.IGNORECASE)
    return text


def repair_joined_sentences(value: str) -> str:
    text = value
    replacements = {
        "i st h e": "is the",
        "i sa": "is a",
        "i n": "in",
        "a n d": "and",
        "t h e": "the",
        "t h a t": "that",
        "t o": "to",
        "o f": "of",
        "w i t h": "with",
        "w h e r e": "where",
        "r e l a t i o n": "relation",
        "a t t r i b u t e": "attribute",
        "d a t a": "data",
        "s y s t e m": "system",
        "e n t i t y": "entity",
        "v a l u e": "value",
        "q u e r y": "query",
    }
    for source, target in replacements.items():
        text = re.sub(source, target, text, flags=re.IGNORECASE)

    compact_replacements = {
        "supportthenotionofastructuredtype": "support the notion of a structured type",
        "Wemaydescribethetypeofarecordabstractly": "We may describe the type of a record abstractly",
        "fundstransfermustbeatomic": "funds transfer must be atomic",
        "Itisdiﬃcult": "It is difficult",
        "Itisdifficult": "It is difficult",
        "whereeach": "where each",
        "where r is": "where r is",
        "where r": "where r",
        "thecreate": "the create",
        "theSQL": "the SQL",
        "otherSQL": "other SQL",
        "databaseapplication": "database application",
        "databaseapplications": "database applications",
        "datab ases": "databases",
        "datab ase": "database",
        "datab ased": "database",
    }
    for source, target in compact_replacements.items():
        text = text.replace(source, target)

    text = re.sub(r"([.!?])(?=[A-Z])", r"\1 ", text)
    text = re.sub(r"([,;:])(?=[A-Za-z])", r"\1 ", text)
    text = re.sub(r"\b([a-z])([A-Z][a-z])", r"\1 \2", text)
    return text


def normalize_line(value: str) -> str:
    text = collapse_spaces(value)
    text = normalize_figure_spacing(text)
    text = (
        text.replace("ﬁ", "fi")
        .replace("ﬂ", "fl")
        .replace("–", "-")
        .replace("—", "-")
        .replace("“", '"')
        .replace("”", '"')
        .replace("’", "'")
        .replace("‘", "'")
        .replace("©", "(c)")
    )
    text = repair_joined_sentences(text)
    underscore_terms = [
        "dept name",
        "course id",
        "sec id",
        "tot cred",
        "time slot id",
        "prereq id",
        "course name",
        "instructor id",
        "student id",
        "section id",
        "classroom id",
        "account number",
        "branch name",
        "loan number",
        "customer id",
        "employee name",
        "manager name",
        "project id",
        "session id",
        "user id",
        "node id",
        "block id",
        "record id",
        "transaction id",
        "hash value",
        "time stamp",
        "start time",
        "end time",
    ]
    for term in underscore_terms:
        text = re.sub(rf"\b{re.escape(term)}\b", term.replace(" ", "_"), text, flags=re.IGNORECASE)
    text = re.sub(r"\bSQL\b", "SQL", text, flags=re.IGNORECASE)
    text = re.sub(r"\bDBMS\b", "DBMS", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    text = re.sub(r"([(])\s+", r"\1", text)
    text = re.sub(r"\s+([)])", r"\1", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def is_running_header(line: str, chapter: ChapterSpec, is_first_nonblank: bool) -> bool:
    clean = normalize_line(line)
    if not clean:
        return False
    if re.fullmatch(r"\d+", clean):
        return True
    if clean in {"PART 1", "PART 2", "PART 3", "PART 4", "PART 5", "PART 6"}:
        return True
    if is_first_nonblank and PAGE_HEADER_RE.match(clean):
        return True
    if is_first_nonblank and RUNNING_SECTION_RE.match(clean):
        return True
    if clean == "Credits":
        return False
    return False


def is_chapter_title_fragment(clean: str, chapter: ChapterSpec) -> bool:
    if not clean or len(clean) > 90:
        return False
    if clean.upper() in {"CHAPTER", str(chapter.number)}:
        return True
    clean_key = compact_key(clean).replace(str(chapter.number), "")
    title_key = compact_key(chapter.title)
    if not clean_key:
        return True
    return clean_key in title_key or title_key in clean_key


def is_heading(clean: str) -> bool:
    if SECTION_RE.match(clean):
        return True
    return clean in {"Review Terms", "Further Reading"}


def normalize_heading(clean: str) -> str:
    if clean == "Review Terms":
        return "## Review Terms"
    if clean == "Further Reading":
        return "## Further Reading"
    match = SECTION_RE.match(clean)
    if not match:
        return f"## {clean}"
    number, title = match.groups()
    level = "###" if number.count(".") >= 2 else "##"
    return f"{level} {number} {title.strip()}"


def is_summary_heading(clean: str, chapter: ChapterSpec) -> bool:
    return clean == "Summary" or bool(re.match(rf"^{chapter.number}\.\d+\s+Summary\b", clean))


def is_practice_or_exercises_heading(clean: str) -> bool:
    return bool(re.match(r"^(?:Practice\s+Exercises|Exercises)\b", clean, re.IGNORECASE))


def is_further_reading_heading(clean: str) -> bool:
    return bool(re.match(r"^Further\s+Reading\b", clean, re.IGNORECASE))


def is_review_terms_heading(clean: str) -> bool:
    return bool(re.match(r"^Review\s+Terms\b", clean, re.IGNORECASE))


def is_credits_heading(clean: str) -> bool:
    return clean == "Credits" or clean.startswith("Credits ")


def looks_like_caption_line(clean: str, labels_on_page: set[str]) -> str | None:
    match = CAPTION_LINE_RE.match(clean)
    if not match:
        return None
    label = f"Figure {match.group(1)}.{match.group(2)}"
    if label not in labels_on_page:
        return None
    first_word = (match.group(3).strip().split(" ") or [""])[0].lower().strip(".,;:")
    if first_word in PROSE_FIGURE_VERBS:
        return None
    return label


def looks_like_figure_visual_line(clean: str) -> bool:
    if not clean:
        return True
    if is_heading(clean) or SECTION_RE.match(clean):
        return False
    if clean.startswith(("•", "-", "Summary", "Review Terms", "Practice Exercises", "Exercises")):
        return False
    if CAPTION_LINE_RE.match(clean):
        return True
    words = clean.split()
    if len(clean) <= 5:
        return True
    if len(words) <= 12 and not clean.endswith((".", "?", "!", ":")):
        return True
    if len(words) <= 16 and sum(char.isdigit() for char in clean) >= 2:
        return True
    if re.search(r"[│┌┐└┘├┤┬┴─]", clean):
        return True
    if clean.count("|") >= 1 or clean.count("_") >= 2:
        return True
    if SQL_START_RE.match(clean) and (clean.endswith(";") or "(" in clean or ")" in clean):
        return True
    return False


def strip_page_lines(raw_text: str, chapter: ChapterSpec) -> list[str]:
    lines: list[str] = []
    first_nonblank_seen = False
    for raw_line in raw_text.splitlines():
        if not raw_line.strip():
            lines.append("")
            continue
        is_first_nonblank = not first_nonblank_seen
        first_nonblank_seen = True
        if is_running_header(raw_line, chapter, is_first_nonblank):
            continue
        clean = normalize_line(raw_line)
        if not clean:
            continue
        if re.match(r"^(?:Review Terms|Practice Exercises|Exercises|Further Reading)\s+\d+$", clean):
            continue
        if is_chapter_title_fragment(clean, chapter):
            continue
        lines.append(clean)
    return lines


def remove_figure_text_blocks(lines: list[str], labels_on_page: set[str]) -> list[str]:
    if not labels_on_page:
        return lines
    remove: set[int] = set()
    for index, line in enumerate(lines):
        label = looks_like_caption_line(line, labels_on_page)
        if label is None:
            continue
        remove.add(index)
        cursor = index - 1
        while cursor >= 0:
            candidate = lines[cursor]
            if not looks_like_figure_visual_line(candidate):
                break
            remove.add(cursor)
            cursor -= 1
        cursor = index + 1
        while cursor < len(lines) and lines[cursor] and not lines[index].endswith("."):
            if SECTION_RE.match(lines[cursor]):
                break
            remove.add(cursor)
            if lines[cursor].endswith("."):
                break
            cursor += 1
    return [line for index, line in enumerate(lines) if index not in remove]


def detect_language(lines: Iterable[str]) -> str:
    sample = "\n".join(lines).lower()
    if any(keyword in sample for keyword in ["select ", "create table", "insert ", "where ", "from "]):
        return "sql"
    if any(keyword in sample for keyword in ["public class", "preparedstatement", "resultset", "import java"]):
        return "java"
    if any(keyword in sample for keyword in ["def ", "import ", "print("]):
        return "python"
    return "text"


def looks_like_code(line: str) -> bool:
    clean = normalize_line(line)
    if not clean:
        return False
    lower = clean.lower()
    if lower.startswith(("where ", "from ")) and clean.endswith("."):
        return False
    if clean in {"{", "}", "};", "...", "…", ");"}:
        return True
    if SQL_START_RE.match(clean) and (
        clean.endswith(";")
        or clean.endswith(",")
        or "(" in clean
        or ")" in clean
        or lower.startswith(("select", "create", "insert", "delete", "update", "with", "grant", "revoke"))
    ):
        return True
    if re.match(r"^[A-Za-z_][\w_]*\s*[:=]", clean):
        return True
    if re.match(r"^⟨.+⟩", clean):
        return True
    if any(token in clean for token in ["PreparedStatement", "ResultSet", "SQLException", "Connection", "DriverManager"]):
        return True
    if clean.endswith(";") and len(clean.split()) <= 12:
        return True
    if clean.startswith(("(A", "(dept", "(course", "(ID", "(select", "(create")):
        return True
    return False


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


def normalize_code(lines: list[str]) -> str:
    normalized = [normalize_line(line) for line in lines if normalize_line(line)]
    if not normalized:
        return ""
    language = detect_language(normalized)
    return f"```{language}\n" + "\n".join(normalized) + "\n```"


class FigureIndex:
    def __init__(self, reader: PdfReader) -> None:
        self.reader = reader
        self._by_page: dict[int, list[dict[str, float | int | str]]] = {}
        self._plain_cache: dict[int, str] = {}

    @staticmethod
    def _transform(matrix, x: float, y: float) -> tuple[float, float]:
        a, b, c, d, e, f = matrix
        return a * x + c * y + e, b * x + d * y + f

    def plain_text(self, page_num: int) -> str:
        if page_num not in self._plain_cache:
            self._plain_cache[page_num] = self.reader.pages[page_num - 1].extract_text() or ""
        return self._plain_cache[page_num]

    def figures_on_page(self, page_num: int) -> list[dict[str, float | int | str]]:
        if page_num in self._by_page:
            return self._by_page[page_num]

        items: list[dict[str, float | int | str]] = []

        def visit(text, cm, tm, font_dict, font_size):
            normalized = normalize_line(text.replace("\n", " "))
            match = CAPTION_LABEL_RE.match(normalized)
            if not match:
                return
            font = str((font_dict or {}).get("/BaseFont", ""))
            if "Bold" not in font and "MHEupperelemsans" not in font:
                return
            raw_x, raw_y = float(tm[4]), float(tm[5])
            transformed_x, transformed_y = self._transform(cm, raw_x, raw_y)
            if abs(raw_x) >= 0.01 or abs(raw_y) >= 0.01:
                x, y = raw_x, raw_y
            else:
                x, y = transformed_x, transformed_y
            items.append(
                {
                    "chapter": int(match.group(1)),
                    "figure": int(match.group(2)),
                    "label": f"Figure {match.group(1)}.{match.group(2)}",
                    "page": page_num,
                    "x": float(x),
                    "y": float(y),
                    "drawY": float(transformed_y),
                    "rasterY": float(y),
                    "font": font,
                }
            )

        self.reader.pages[page_num - 1].extract_text(visitor_text=visit)

        seen: set[tuple[int, int, int]] = set()
        unique: list[dict[str, float | int | str]] = []
        for item in sorted(items, key=lambda entry: (int(entry["chapter"]), int(entry["figure"]), -float(entry["y"]))):
            key = (int(item["chapter"]), int(item["figure"]), round(float(item["y"])))
            if key in seen:
                continue
            seen.add(key)
            unique.append(item)
        self._by_page[page_num] = unique
        return unique

    def labels_on_page(self, page_num: int) -> set[str]:
        return {str(item["label"]) for item in self.figures_on_page(page_num)}

    def caption_text(self, page_num: int, label: str) -> str:
        lines = [normalize_line(line) for line in self.plain_text(page_num).splitlines()]
        best = label
        for index, line in enumerate(lines):
            match = CAPTION_LINE_RE.match(line)
            if not match:
                continue
            current_label = f"Figure {match.group(1)}.{match.group(2)}"
            if current_label != label:
                continue
            remainder = match.group(3).strip()
            first_word = (remainder.split(" ") or [""])[0].lower().strip(".,;:")
            if first_word in PROSE_FIGURE_VERBS:
                continue
            parts = [line]
            cursor = index + 1
            while cursor < len(lines) and parts and not parts[-1].endswith(".") and len(parts) < 3:
                nxt = lines[cursor]
                if not nxt or SECTION_RE.match(nxt) or CAPTION_LINE_RE.match(nxt):
                    break
                parts.append(nxt)
                cursor += 1
            best = normalize_line(" ".join(parts))
            break
        return best

    def chapter_figures(self, chapter: ChapterSpec) -> list[dict[str, float | int | str]]:
        result: list[dict[str, float | int | str]] = []
        for page_num in range(chapter.page_start, chapter.page_end + 1):
            for item in self.figures_on_page(page_num):
                if int(item["chapter"]) != chapter.number:
                    continue
                result.append({**item, "caption": self.caption_text(page_num, str(item["label"]))})
        result.sort(key=lambda entry: (int(entry["figure"]), int(entry["page"]), -float(entry["y"])))
        return result


class RasterCropper:
    def __init__(self, pdf_path: Path, reader: PdfReader, pdftoppm: Path, dpi: int) -> None:
        self.pdf_path = pdf_path
        self.reader = reader
        self.pdftoppm = pdftoppm
        self.dpi = dpi
        self.page_img_cache: collections.OrderedDict[int, Image.Image] = collections.OrderedDict()
        self.page_draw_cache: dict[int, list[tuple[float, float, float, float]]] = {}

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

        self.page_img_cache[page_num] = image
        while len(self.page_img_cache) > 8:
            self.page_img_cache.popitem(last=False)
        return image

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
        self.page_draw_cache[page_num] = unique
        return unique

    def select_draw_bbox(self, page_num: int, cap_y: float) -> tuple[float, float, float, float] | None:
        candidates: list[tuple[float, float, float, float]] = []
        for box in self.drawing_boxes(page_num):
            x0, y0, x1, y1 = box
            width = x1 - x0
            height = y1 - y0
            if y0 <= cap_y + 2:
                continue
            if max(width, height) < 8:
                continue
            candidates.append(box)
        if not candidates:
            return None

        candidates.sort(key=lambda box: box[1])
        left, _bottom, right, _top = self.page_box(page_num)
        long_rules = [
            box
            for box in candidates
            if (box[2] - box[0]) > (right - left) * 0.45 and (box[3] - box[1]) < 2
        ]
        if len(long_rules) >= 2:
            lower_rule, upper_rule = sorted(long_rules, key=lambda box: box[1])[:2]
            if upper_rule[1] - lower_rule[1] > 42:
                return (
                    min(lower_rule[0], upper_rule[0]),
                    lower_rule[1],
                    max(lower_rule[2], upper_rule[2]),
                    upper_rule[3],
                )

        group = [candidates[0]]
        current_top = candidates[0][3]
        for box in candidates[1:]:
            gap = box[1] - current_top
            if gap <= 32:
                group.append(box)
                current_top = max(current_top, box[3])
                continue
            break
        bbox = self._union(group)
        width = bbox[2] - bbox[0]
        height = bbox[3] - bbox[1]
        if width < 16 or height < 8 or width * height < 80:
            return None
        return bbox

    def crop_from_pdf_bbox(self, page_num: int, bbox: tuple[float, float, float, float]) -> Image.Image:
        image = self.render_page(page_num)
        left, bottom, right, top = self.page_box(page_num)
        del right
        scale = image.height / (top - bottom)
        x0, y0, x1, y1 = bbox
        x0 = max(left, x0 - 8)
        x1 = min(float(self.reader.pages[page_num - 1].mediabox.right), x1 + 8)
        y0 = max(bottom, y0 - 1)
        y1 = min(top, y1 + 5)
        px0 = max(0, int((x0 - left) * scale))
        px1 = min(image.width, int(math.ceil((x1 - left) * scale)))
        py0 = max(0, int((top - y1) * scale))
        py1 = min(image.height, int(math.ceil((top - y0) * scale)))
        return self.trim(image.crop((px0, py0, px1, py1)))

    def crop_raster_near_caption(self, page_num: int, cap_y: float) -> Image.Image:
        image = self.render_page(page_num)
        left, bottom, right, top = self.page_box(page_num)
        del left, right
        scale = image.height / (top - bottom)
        cap_px = int((top - cap_y) * scale)
        bottom_limit = max(0, cap_px - int(7 * scale))
        arr = np.array(image)
        mask = np.any(arr < 247, axis=2)
        height, width = mask.shape
        margin = int(32 * scale)
        content = mask[:bottom_limit, margin : width - margin]
        active = content.sum(axis=1) > max(5, int(width * 0.0025))
        active[: int(48 * scale)] = False
        rows = np.flatnonzero(active)
        if len(rows) == 0:
            raise RuntimeError(f"no visible figure content above caption on page {page_num}")

        last = int(rows[-1])
        top_row = last
        bottom_row = last
        gap = 0
        max_gap = max(14, int(20 * scale))
        for row in range(last - 1, -1, -1):
            if active[row]:
                top_row = row
                gap = 0
            else:
                gap += 1
                if gap > max_gap:
                    break

        # Sparse diagrams can have large whitespace between components. If the
        # nearest component is tiny, merge one more nearby component above it.
        if bottom_row - top_row < int(45 * scale):
            row = max(0, top_row - max_gap * 2)
            nearby = rows[(rows >= row) & (rows < top_row)]
            if len(nearby):
                top_row = int(nearby[0])

        top_row = max(0, top_row - int(4 * scale))
        bottom_row = min(height - 1, bottom_row + int(3 * scale))
        submask = mask[top_row : bottom_row + 1, :]
        col_threshold = max(2, int((bottom_row - top_row + 1) * 0.004))
        cols = np.flatnonzero(submask.sum(axis=0) > col_threshold)
        if len(cols) == 0:
            raise RuntimeError(f"no figure columns on page {page_num}")

        x0 = max(0, int(cols[0]) - 10)
        x1 = min(width, int(cols[-1]) + 11)
        y0 = max(0, top_row - 8)
        y1 = min(height, bottom_row + 9)
        crop = image.crop((x0, y0, x1, y1))
        return self.trim(crop)

    def crop_figure(self, page_num: int, raster_cap_y: float, draw_cap_y: float) -> Image.Image:
        bbox = self.select_draw_bbox(page_num, draw_cap_y)
        if bbox is not None:
            return self.crop_from_pdf_bbox(page_num, bbox)
        return self.crop_raster_near_caption(page_num, raster_cap_y)

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


def extract_chapter_text(reader: PdfReader, figure_index: FigureIndex, chapter: ChapterSpec) -> tuple[list[str], list[int]]:
    paragraphs: list[str] = [f"# CHAPTER {chapter.number}: {chapter.title}"]
    paragraph_pages: list[int] = [chapter.page_start]
    prose_buffer: list[str] = []
    code_buffer: list[str] = []
    buffer_page = chapter.page_start
    mode = "body"

    def flush_prose() -> None:
        nonlocal prose_buffer, buffer_page
        text = join_prose(prose_buffer)
        if text:
            paragraphs.append(text)
            paragraph_pages.append(buffer_page)
        prose_buffer = []

    def flush_code() -> None:
        nonlocal code_buffer, buffer_page
        text = normalize_code(code_buffer)
        if text:
            paragraphs.append(text)
            paragraph_pages.append(buffer_page)
        code_buffer = []

    def append_heading(clean: str, page_num: int) -> None:
        flush_prose()
        flush_code()
        paragraphs.append(normalize_heading(clean))
        paragraph_pages.append(page_num)

    for page_num in range(chapter.page_start, chapter.page_end + 1):
        raw_text = figure_index.plain_text(page_num)
        lines = strip_page_lines(raw_text, chapter)
        lines = remove_figure_text_blocks(lines, figure_index.labels_on_page(page_num))
        for clean in lines:
            if not clean:
                flush_prose()
                flush_code()
                continue
            if is_credits_heading(clean):
                flush_prose()
                flush_code()
                return paragraphs, paragraph_pages
            if is_further_reading_heading(clean):
                if mode in {"summary", "exercises"}:
                    mode = "further"
                    append_heading("Further Reading", page_num)
                elif mode == "further":
                    continue
                else:
                    if not prose_buffer:
                        buffer_page = page_num
                    prose_buffer.append(clean)
                continue
            if is_review_terms_heading(clean):
                mode = "body"
                append_heading("Review Terms", page_num)
                continue
            if is_summary_heading(clean, chapter):
                flush_prose()
                flush_code()
                mode = "summary"
                continue
            if is_practice_or_exercises_heading(clean):
                flush_prose()
                flush_code()
                mode = "exercises"
                continue
            if mode in {"summary", "exercises"}:
                continue
            if SECTION_RE.match(clean):
                append_heading(clean, page_num)
                continue
            if looks_like_code(clean):
                flush_prose()
                if not code_buffer:
                    buffer_page = page_num
                code_buffer.append(clean)
                continue
            if code_buffer:
                flush_code()
            if clean.startswith("•"):
                flush_prose()
                paragraphs.append(normalize_line(clean))
                paragraph_pages.append(page_num)
                continue
            if not prose_buffer:
                buffer_page = page_num
            prose_buffer.append(clean)
            if len(join_prose(prose_buffer)) >= 850 and re.search(r"[.!?]$", clean):
                flush_prose()

    flush_prose()
    flush_code()
    return paragraphs, paragraph_pages


def skipped_figure_page_range(reader: PdfReader, figure_index: FigureIndex, chapter: ChapterSpec) -> tuple[int, int] | None:
    start: int | None = None
    end = chapter.page_end + 1
    for page_num in range(chapter.page_start, chapter.page_end + 1):
        raw_text = figure_index.plain_text(page_num)
        lines = strip_page_lines(raw_text, chapter)
        for clean in lines:
            if start is None and (is_summary_heading(clean, chapter) or is_practice_or_exercises_heading(clean)):
                start = page_num
            if start is not None and is_further_reading_heading(clean):
                end = page_num
                return start, end
    if start is None:
        return None
    return start, end


def focus_keywords(chapter: ChapterSpec, paragraphs: list[str]) -> list[str]:
    keywords = [chapter.title]
    for paragraph in paragraphs:
        if paragraph.startswith("## "):
            title = re.sub(r"^#+\s+\d+(?:\.\d+)*\s*", "", paragraph).strip()
            if title and title not in {"Further Reading", "Review Terms"}:
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
    target = contact_dir / f"dbms-ch{chapter:02d}-contact.jpg"
    sheet.save(target, quality=88, optimize=True)
    return target


def build_material(args: argparse.Namespace) -> dict:
    reader = PdfReader(str(args.pdf))
    figure_index = FigureIndex(reader)
    cropper = RasterCropper(args.pdf, reader, args.pdftoppm, args.dpi)
    figure_root = args.target_root / "learning/dbms-book/figures"
    figure_root.mkdir(parents=True, exist_ok=True)
    if args.clean:
        for stale_image in figure_root.glob("dbms-figure-*.jpg"):
            stale_image.unlink()
    dimensions: dict[str, dict[str, int]] = {}
    topics: list[dict] = []
    failures: list[str] = []

    for chapter in CHAPTERS:
        if chapter.number not in args.chapter_filter:
            continue
        paragraphs, paragraph_pages = extract_chapter_text(reader, figure_index, chapter)
        skipped_figures = skipped_figure_page_range(reader, figure_index, chapter)
        figures = []
        contact_items: list[tuple[str, Path, tuple[int, int]]] = []
        for info in figure_index.chapter_figures(chapter):
            if skipped_figures is not None and skipped_figures[0] <= int(info["page"]) < skipped_figures[1]:
                continue
            figure_number = int(info["figure"])
            file_name = f"dbms-figure-{chapter.number:02d}-{figure_number:03d}.jpg"
            public_src = f"/learning/dbms-book/figures/{file_name}"
            target = figure_root / file_name
            try:
                crop = cropper.crop_figure(int(info["page"]), float(info["rasterY"]), float(info["drawY"]))
                if crop.width > args.max_width:
                    new_height = max(1, round(crop.height * (args.max_width / crop.width)))
                    crop = crop.resize((args.max_width, new_height), Image.LANCZOS)
                crop.save(target, quality=args.quality, optimize=True, progressive=True)
                width, height = crop.size
                dimensions[public_src] = {"width": width, "height": height}
                contact_items.append((target.name, target, crop.size))
            except Exception as exc:  # noqa: BLE001 - full batch should report all failures.
                failures.append(f"{info['label']} page {info['page']}: {exc}")
                continue
            figures.append(
                {
                    "id": f"DBMS-CH{chapter.number:02d}-FIG-{figure_number:03d}",
                    "src": public_src,
                    "caption": str(info["caption"]),
                    "page": int(info["page"]),
                    "width": width,
                    "height": height,
                }
            )
        contact = save_contact_sheet(chapter.number, contact_items, args.contact_dir)
        avg_len = round(sum(len(paragraph) for paragraph in paragraphs) / max(1, len(paragraphs)))
        print(
            f"chapter {chapter.number:02d}: paragraphs={len(paragraphs)} avg_len={avg_len} "
            f"figures={len(figures)} contact={contact}",
            flush=True,
        )
        topics.append(
            {
                "topicId": f"DBMS-CH-{chapter.number:02d}",
                "title": f"Chapter {chapter.number}: {chapter.title}",
                "difficulty": "Medium",
                "focusKeywords": focus_keywords(chapter, paragraphs),
                "readingParagraphs": paragraphs,
                "paragraphPages": paragraph_pages,
                "pageStart": chapter.page_start,
                "pageEnd": chapter.page_end,
                "figures": figures,
            }
        )

    if failures:
        for failure in failures:
            print(f"FIGURE_CROP_FAILURE {failure}", flush=True)
        raise RuntimeError(f"{len(failures)} figure crops failed")

    material = {
        "metadata": {
            "title": "Database System Concepts Textbook (PDF + Figures, Clean Minified)",
            "version": "1.0.0",
            "createdDate": "2026-06-07",
            "format": "minified-json-primary",
            "audience": "Learners studying DBMS chapter-by-chapter from textbook content",
            "trackId": "computer-science",
            "sourceFile": args.pdf.name,
            "notes": [
                "Chapter text was extracted from the source PDF and cleaned for readable study material.",
                "Each chapter omits Summary, Practice Exercises, and Exercises while retaining Review Terms and Further Reading.",
                "Figure images are cropped from real textbook captions and compressed to keep the project size manageable.",
            ],
        },
        "globalStudyPlan": [
            "Read each chapter section-by-section, then use the cropped figures to anchor schemas, operators, storage layouts, and transaction timelines.",
            "When a chapter includes SQL or pseudocode, rewrite the example against a small personal schema so the syntax and tradeoffs become concrete.",
        ],
        "referenceCatalog": [],
        "subjects": [
            {
                "subjectId": "database-systems-textbook",
                "order": 6,
                "title": "Database Systems",
                "overview": "Database System Concepts chapters with textbook-aligned headings, cleaned reading text, Further Reading sections, and compressed figure crops.",
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
        src: size for src, size in dimension_data.items() if not src.startswith("/learning/dbms-book/figures/")
    }
    dimension_data.update(dimensions)
    args.dimensions.write_text(json.dumps(dimension_data, separators=(",", ":")) + "\n")
    print(f"wrote {args.json}", flush=True)
    print(f"updated dimensions with {len(dimensions)} DBMS figures", flush=True)
    return material


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON)
    parser.add_argument("--target-root", type=Path, default=DEFAULT_PUBLIC)
    parser.add_argument("--dimensions", type=Path, default=DEFAULT_DIMENSIONS)
    parser.add_argument("--contact-dir", type=Path, default=DEFAULT_CONTACTS)
    parser.add_argument("--pdftoppm", type=Path, default=DEFAULT_PDFTOPPM)
    parser.add_argument("--chapters", default="1-26")
    parser.add_argument("--dpi", type=int, default=180)
    parser.add_argument("--quality", type=int, default=60)
    parser.add_argument("--max-width", type=int, default=1400)
    parser.add_argument("--no-clean", action="store_false", dest="clean")
    parser.set_defaults(clean=True)
    args = parser.parse_args()
    args.chapter_filter = parse_chapters(args.chapters)
    build_material(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
