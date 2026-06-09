#!/usr/bin/env python3
"""Build Alex Xu System Design Interview material from the PDF."""

from __future__ import annotations

import argparse
import collections
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF = Path("/Users/survivor/Downloads/System Design Interview by Alex Xu.pdf")
DEFAULT_JSON = ROOT / "learning-material/system_design_interview_textbook_clean.min.json"
DEFAULT_PUBLIC = ROOT / "apps/web/public"
DEFAULT_DIMENSIONS = ROOT / "apps/web/src/lib/learning/os-figure-dimensions.json"
DEFAULT_CONTACTS = Path("/private/tmp/system-design-figure-contact-sheets")


@dataclass(frozen=True)
class ChapterSpec:
    number: int
    title: str
    pdf_start: int
    pdf_end: int


@dataclass(frozen=True)
class ImagePlacement:
    name: str
    page: int
    visual_index: int
    x: float
    y: float
    width: float
    height: float
    image: Image.Image


CHAPTER_STARTS = [
    (1, "Scale From Zero To Millions Of Users", 5),
    (2, "Back-of-the-envelope Estimation", 34),
    (3, "A Framework For System Design Interviews", 42),
    (4, "Design A Rate Limiter", 51),
    (5, "Design Consistent Hashing", 71),
    (6, "Design A Key-value Store", 87),
    (7, "Design A Unique ID Generator In Distributed Systems", 110),
    (8, "Design A URL Shortener", 119),
    (9, "Design A Web Crawler", 132),
    (10, "Design A Notification System", 151),
    (11, "Design A News Feed System", 166),
    (12, "Design A Chat System", 178),
    (13, "Design A Search Autocomplete System", 200),
    (14, "Design YouTube", 220),
    (15, "Design Google Drive", 244),
    (16, "The Learning Continues", 264),
]

CHAPTER_TITLE_RE = re.compile(r"^CHAPTER\s+(\d+):\s*(.+)$", re.IGNORECASE)
LIST_RE = re.compile(r"^(?:[•*-]|\d+[.)])\s+")
STEP_RE = re.compile(r"^Step\s+\d+\s*[-:]", re.IGNORECASE)
REFERENCE_RE = re.compile(r"^(?:Reference materials?|References)$", re.IGNORECASE)
KNOWN_HEADING_RE = re.compile(
    r"^(?:"
    r"Requirements|High-level design|Detailed design|Deep dive|Summary|"
    r"Back-of-the-envelope estimation|API design|Data model|Data model design|"
    r"Database schema|Capacity estimation|System APIs|Design deep dive|"
    r"Scale the design|Scale the system|Understand the problem|"
    r"Message flow|Service discovery|Potential problems and resolutions|"
    r"Reference materials|Interview tip|Notification template|"
    r"Single server setup|Database|Load balancer|Database replication|Cache|Cache tier|"
    r"Content delivery network \(CDN\)|Stateless web tier|Stateful architecture|"
    r"Stateless architecture|Data centers|Message queue|Logging, metrics, automation|"
    r"Adding message queues and different tools|Database scaling|Vertical scaling|"
    r"Horizontal scaling|Horizontal partitioning|Sharding|Millions of users and beyond|"
    r"Power of two|Latency numbers every programmer should know|Availability numbers|"
    r"Example: Estimate Twitter QPS and storage requirements|A 4-step process for effective system design interview|"
    r"Design considerations|High-level architecture|Component deep dive|"
    r"Happy path|Failure scenarios|Wrap up"
    r")$",
    re.IGNORECASE,
)


def make_chapters() -> tuple[ChapterSpec, ...]:
    chapters: list[ChapterSpec] = []
    for index, (number, title, start) in enumerate(CHAPTER_STARTS):
        if index + 1 < len(CHAPTER_STARTS):
            end = CHAPTER_STARTS[index + 1][2] - 1
        else:
            end = 268
        chapters.append(ChapterSpec(number, title, start, end))
    return tuple(chapters)


CHAPTERS = make_chapters()


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


def normalize_line(value: str) -> str:
    text = collapse_spaces(value)
    text = (
        text.replace("\u00ad", "")
        .replace("ﬁ", "fi")
        .replace("ﬂ", "fl")
        .replace("–", "-")
        .replace("—", "-")
        .replace("“", '"')
        .replace("”", '"')
        .replace("’", "'")
        .replace("‘", "'")
    )
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    text = re.sub(r"([(])\s+", r"\1", text)
    text = re.sub(r"\s+([)])", r"\1", text)
    text = re.sub(r"([.!?])(?=[A-Z])", r"\1 ", text)
    text = re.sub(r"([,;:])(?=[A-Za-z])", r"\1 ", text)
    return collapse_spaces(text)


def normalize_title(value: str) -> str:
    text = normalize_line(value)
    fixes = {
        "Back-of-the-envelope": "Back-of-the-Envelope",
        "Key-value": "Key-Value",
        "URL": "URL",
        "YouTube": "YouTube",
    }
    for source, target in fixes.items():
        text = re.sub(source, target, text, flags=re.IGNORECASE)
    return text


def is_chapter_title_fragment(clean: str, chapter: ChapterSpec, page_num: int) -> bool:
    if page_num != chapter.pdf_start:
        return False
    if CHAPTER_TITLE_RE.match(clean):
        return True
    title_key = re.sub(r"[^a-z0-9]+", "", chapter.title.lower())
    clean_key = re.sub(r"[^a-z0-9]+", "", clean.lower())
    return bool(clean_key and (clean_key in title_key or title_key in clean_key))


def looks_like_heading(clean: str) -> bool:
    if not clean or len(clean) > 115:
        return False
    if LIST_RE.match(clean):
        return False
    if STEP_RE.match(clean) or KNOWN_HEADING_RE.match(clean) or REFERENCE_RE.match(clean):
        return True
    if any(symbol in clean for symbol in ["/", "=", "{", "}", "://"]):
        return False
    if clean.endswith((".", ",", ";", "?", "!")):
        return False
    if ":" in clean and not clean.lower().startswith(("step ", "figure ", "table ")):
        return False
    words = clean.split()
    if not (1 <= len(words) <= 9):
        return False
    lower_words = {"a", "an", "and", "as", "for", "from", "in", "of", "or", "the", "to", "vs", "with"}
    titleish = sum(1 for word in words if word[:1].isupper() or word.lower() in lower_words)
    return titleish >= max(1, math.ceil(len(words) * 0.55))


def heading_level(clean: str) -> int:
    if STEP_RE.match(clean):
        return 2
    if clean.lower() in {"summary", "reference materials"}:
        return 2
    return 2


def join_lines(lines: list[str]) -> str:
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


def clean_page_lines(reader: PdfReader, page_num: int, chapter: ChapterSpec) -> list[str]:
    text = reader.pages[page_num - 1].extract_text() or ""
    lines: list[str] = []
    for raw_line in text.splitlines():
        clean = normalize_line(raw_line)
        if not clean:
            continue
        if clean.isdigit():
            continue
        if is_chapter_title_fragment(clean, chapter, page_num):
            continue
        lines.append(clean)
    return lines


def extract_chapter_text(reader: PdfReader, chapter: ChapterSpec) -> tuple[list[str], list[float]]:
    paragraphs: list[str] = [f"# CHAPTER {chapter.number}: {chapter.title}"]
    paragraph_pages: list[float] = [float(chapter.pdf_start)]
    buffer: list[str] = []
    buffer_page = float(chapter.pdf_start)

    def flush() -> None:
        nonlocal buffer, buffer_page
        paragraph = join_lines(buffer)
        if paragraph:
            paragraphs.append(paragraph)
            paragraph_pages.append(buffer_page)
        buffer = []

    for page_num in range(chapter.pdf_start, chapter.pdf_end + 1):
        lines = clean_page_lines(reader, page_num, chapter)
        for clean in lines:
            if REFERENCE_RE.match(clean):
                flush()
                return paragraphs, paragraph_pages

            if looks_like_heading(clean):
                flush()
                level = heading_level(clean)
                paragraphs.append(f"{'#' * level} {normalize_title(clean)}")
                paragraph_pages.append(float(page_num))
                continue

            starts_new_list_item = bool(LIST_RE.match(clean))
            if starts_new_list_item and buffer:
                flush()

            if not buffer:
                buffer_page = float(page_num)
            buffer.append(clean)

            if starts_new_list_item and clean.endswith((".", ":", ";", "?", "!")):
                flush()
                continue

            if len(join_lines(buffer)) >= 850 and clean.endswith((".", "?", "!")):
                flush()

    flush()
    return paragraphs, paragraph_pages


def image_map_for_page(page) -> dict[str, Image.Image]:
    result: dict[str, Image.Image] = {}
    for image_file in page.images:
        name = "/" + Path(image_file.name).stem
        result[name] = image_file.image.convert("RGB")
    return result


def placements_for_page(reader: PdfReader, page_num: int) -> list[ImagePlacement]:
    page = reader.pages[page_num - 1]
    resources = (page.get("/Resources") or {}).get_object()
    xobjects = (resources.get("/XObject") or {}).get_object() if resources.get("/XObject") else {}
    image_by_name = image_map_for_page(page)
    placements: list[ImagePlacement] = []
    visual_index = 0

    def visit(op, args, cm, tm):
        nonlocal visual_index
        op_name = op.decode() if isinstance(op, bytes) else op
        if op_name != "Do":
            return
        name = str(args[0])
        xobject = xobjects.get(args[0])
        if not xobject:
            return
        resolved = xobject.get_object()
        if resolved.get("/Subtype") != "/Image":
            return
        image = image_by_name.get(name)
        if image is None:
            return
        visual_index += 1
        placements.append(
            ImagePlacement(
                name=name,
                page=page_num,
                visual_index=visual_index,
                x=float(cm[4]),
                y=float(cm[5]),
                width=abs(float(cm[0])),
                height=abs(float(cm[3])),
                image=image,
            )
        )

    page.extract_text(visitor_operand_before=visit)
    placements.sort(key=lambda item: (-item.y, item.x, item.visual_index))
    return placements


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
    target = contact_dir / f"system-design-ch{chapter:02d}-contact.jpg"
    sheet.save(target, quality=88, optimize=True)
    return target


def caption_for_visual(chapter: ChapterSpec, index: int, page_num: int, image: Image.Image) -> str:
    if image.height < 190 and image.width < 900:
        return f"Code or calculation visual {chapter.number}.{index} from page {page_num}"
    return f"System design visual {chapter.number}.{index} from page {page_num}"


def focus_keywords(chapter: ChapterSpec, paragraphs: list[str]) -> list[str]:
    keywords = [chapter.title]
    for paragraph in paragraphs:
        if paragraph.startswith("## "):
            keywords.append(paragraph[3:].strip())
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


def build_material(args: argparse.Namespace) -> dict:
    reader = PdfReader(str(args.pdf))
    figure_root = args.target_root / "learning/system-design-book/figures"
    figure_root.mkdir(parents=True, exist_ok=True)
    if args.clean:
        for stale in figure_root.glob("system-design-visual-*.jpg"):
            stale.unlink()

    placement_cache: dict[int, list[ImagePlacement]] = {}
    topics: list[dict] = []
    dimensions: dict[str, dict[str, int]] = {}

    for chapter in CHAPTERS:
        if chapter.number not in args.chapter_filter:
            continue

        paragraphs, paragraph_pages = extract_chapter_text(reader, chapter)
        figures: list[dict] = []
        contact_items: list[tuple[str, Path, tuple[int, int]]] = []
        visual_count = 0

        for page_num in range(chapter.pdf_start, chapter.pdf_end + 1):
            placements = placement_cache.setdefault(page_num, placements_for_page(reader, page_num))
            for placement in placements:
                visual_count += 1
                file_name = f"system-design-visual-{chapter.number:02d}-{visual_count:03d}.jpg"
                target = figure_root / file_name
                public_src = f"/learning/system-design-book/figures/{file_name}"
                image = placement.image.convert("RGB")
                if image.width > args.max_width:
                    new_height = max(1, round(image.height * (args.max_width / image.width)))
                    image = image.resize((args.max_width, new_height), Image.LANCZOS)
                image.save(target, quality=args.quality, optimize=True, progressive=True)
                width, height = image.size
                dimensions[public_src] = {"width": width, "height": height}
                contact_items.append((target.name, target, image.size))
                figures.append(
                    {
                        "id": f"SDI-CH{chapter.number:02d}-VIS-{visual_count:03d}",
                        "src": public_src,
                        "caption": caption_for_visual(chapter, visual_count, page_num, image),
                        "page": page_num + 0.5,
                        "width": width,
                        "height": height,
                    }
                )

        contact = save_contact_sheet(chapter.number, contact_items, args.contact_dir)
        avg_len = round(sum(len(paragraph) for paragraph in paragraphs) / max(1, len(paragraphs)))
        print(
            f"chapter {chapter.number:02d}: paragraphs={len(paragraphs)} avg_len={avg_len} "
            f"visuals={len(figures)} pages={chapter.pdf_start}-{chapter.pdf_end} contact={contact}",
            flush=True,
        )
        topics.append(
            {
                "topicId": f"SDI-CH-{chapter.number:02d}",
                "title": f"Chapter {chapter.number}: {chapter.title}",
                "difficulty": "Medium" if chapter.number <= 3 or chapter.number == 16 else "Hard",
                "focusKeywords": focus_keywords(chapter, paragraphs),
                "readingParagraphs": paragraphs,
                "paragraphPages": paragraph_pages,
                "pageStart": chapter.pdf_start,
                "pageEnd": chapter.pdf_end,
                "figures": figures,
            }
        )

    material = {
        "metadata": {
            "title": "System Design Interview Textbook (PDF + Visuals, Clean Minified)",
            "version": "1.0.0",
            "createdDate": "2026-06-07",
            "format": "minified-json-primary",
            "audience": "Software engineering candidates preparing for system design interviews",
            "trackId": "computer-science",
            "sourceFile": args.pdf.name,
            "notes": [
                "Chapter text was extracted from the source PDF and cleaned for readable study material.",
                "Embedded book visuals, tables, and code snippets are extracted directly from the PDF and compressed.",
                "System Design is loaded as a Computer Science subject rather than as a separate track.",
            ],
        },
        "globalStudyPlan": [
            "Start with the framework and estimation chapters, then practice each product-design chapter as a full interview prompt.",
            "For every case study, identify requirements, constraints, APIs, data model, high-level design, bottlenecks, and failure handling.",
        ],
        "referenceCatalog": [],
        "subjects": [
            {
                "subjectId": "system-design-interview-textbook",
                "order": 8,
                "title": "System Design",
                "overview": "Alex Xu's System Design Interview chapters with textbook-aligned headings, full reading content, and compressed embedded visuals.",
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
        src: size
        for src, size in dimension_data.items()
        if not src.startswith("/learning/system-design-book/figures/")
    }
    dimension_data.update(dimensions)
    args.dimensions.write_text(json.dumps(dimension_data, separators=(",", ":")) + "\n")
    print(f"wrote {args.json}", flush=True)
    print(f"updated dimensions with {len(dimensions)} system design visuals", flush=True)
    return material


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON)
    parser.add_argument("--target-root", type=Path, default=DEFAULT_PUBLIC)
    parser.add_argument("--dimensions", type=Path, default=DEFAULT_DIMENSIONS)
    parser.add_argument("--contact-dir", type=Path, default=DEFAULT_CONTACTS)
    parser.add_argument("--chapters", default="1-16")
    parser.add_argument("--quality", type=int, default=62)
    parser.add_argument("--max-width", type=int, default=1100)
    parser.add_argument("--no-clean", action="store_false", dest="clean")
    parser.set_defaults(clean=True)
    args = parser.parse_args()
    args.chapter_filter = parse_chapters(args.chapters)
    build_material(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
