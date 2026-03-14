#!/usr/bin/env python3
"""Rebuild Operating System Concepts chapter reading text from the source PDF."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF = Path("/Users/survivor/Downloads/Abraham-Silberschatz-Operating-System-Concepts-10th-2018.pdf")
DEFAULT_JSON = ROOT / "learning-material/operating_systems_textbook_clean.min.json"


SECTION_RE = re.compile(r"^(\d+\.\d+(?:\.\d+)*)\s+(.+)$")
SUMMARY_RE = re.compile(r"^\d+\.\d+\s+Summary\b", re.IGNORECASE)
STOP_HEADINGS = ("Practice Exercises", "Further Reading", "Bibliography")
FIGURE_RE = re.compile(r"^\s*Figure\s+\d+\.\d+\s+[A-Z]")


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


def leading_spaces(value: str) -> int:
    return len(value) - len(value.lstrip(" "))


def collapse_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def compact_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def normalize_line(value: str) -> str:
    text = collapse_spaces(value)
    text = text.replace("ﬁ", "fi").replace("ﬂ", "fl")
    text = text.replace("–", "-")
    text = text.replace("socalled", "so-called")
    text = text.replace("aprogram", "a program")
    text = text.replace("aprocess", "a process")
    text = text.replace("aCPU", "a CPU")
    text = text.replace("theCPU", "the CPU")
    text = text.replace("anI/O", "an I/O")
    text = text.replace("AIX,andmacOS", "AIX, and macOS")
    text = text.replace("andmacOS", "and macOS")
    text = text.replace("wheretheyare", "where they are")
    text = text.replace("Whenapagemustbereplaced", "When a page must be replaced")
    text = text.replace("whichisa", "which is a")
    text = text.replace("ofpreempt", "of preempt")
    text = text.replace("breakingthe", "breaking the")
    text = text.replace("pagefaultrateforafixednumberofframes", "page-fault rate for a fixed number of frames")
    text = text.replace("anoptimal", "an optimal")
    text = text.replace("MIN.Itissimplythis", "MIN. It is simply this")
    text = text.replace("Aset", "A set")
    text = text.replace("Afunction", "A function")
    text = re.sub(r"\bBUFFER\s*SIZE\b", "BUFFER_SIZE", text)
    text = text.replace("BUFFERSIZE", "BUFFER_SIZE")
    text = text.replace("nextproduced", "next_produced")
    text = text.replace("next consumed", "next_consumed")
    text = text.replace("nextconsumed", "next_consumed")
    text = text.replace("test and set", "test_and_set")
    text = text.replace("compare and swap", "compare_and_swap")
    text = text.replace("compareandswap", "compare_and_swap")
    text = text.replace("Ifprocess", "If process")
    text = text.replace("ofcount", "of count")
    text = text.replace("valueof", "value of")
    text = text.replace("localCPU", "local CPU")
    text = text.replace("arace", "a race")
    text = text.replace("Infact", "In fact")
    text = text.replace("theterm", "the term")
    text = text.replace("Thevalue", "The value")
    text = text.replace("resetflag", "reset flag")
    text = text.replace("itmustalso", "it must also")
    text = text.replace("alsoset", "also set")
    text = text.replace("weuse", "we use")
    text = text.replace("whereThread", "where Thread")
    text = text.replace("Thread1performs", "Thread 1 performs")
    text = text.replace("performsthestatements", "performs the statements")
    text = text.replace("sempahore", "semaphore")
    text = re.sub(r"\b(process)(P[\w\d]+)", r"\1 \2", text)
    text = re.sub(r"\b(P[\w\d]+)is\b", r"\1 is", text)
    text = re.sub(r"\bthread(T\d+)\b", r"thread \1", text)
    text = re.sub(r"\beachk∈K\b", "each k ∈ K", text)
    text = text.replace("thenprocessPiis", "then process Pi is")
    text = re.sub(r"(\w+\(\))function", r"\1 function", text)
    text = re.sub(r"([.!?])(?=[A-Z])", r"\1 ", text)
    text = re.sub(r"([,;:])(?=[A-Za-z])", r"\1 ", text)
    text = re.sub(r"(\d+\.)(?=[A-Z])", r"\1 ", text)
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    return text.strip()


def is_running_header(line: str, chapter: int, is_first_nonblank: bool) -> bool:
    clean = normalize_line(line)
    if not clean:
        return False
    if re.fullmatch(r"\d+", clean):
        return True
    if is_first_nonblank and re.match(rf"^\d+\s+Chapter\s+{chapter}\b", clean, re.IGNORECASE):
        return True
    if is_first_nonblank and re.match(rf"^{chapter}\.\d+\s+.+\s+\d+$", clean):
        return True
    return False


def looks_like_heading(line: str) -> bool:
    clean = normalize_line(line)
    if SUMMARY_RE.match(clean):
        return True
    match = SECTION_RE.match(clean)
    if not match:
        return False
    # Avoid numbered list entries such as "1. Mutual exclusion."
    return match.group(1).count(".") >= 1 and bool(match.group(2).strip())


def looks_like_code(line: str, indent: int) -> bool:
    clean = normalize_line(line)
    if not clean:
        return False
    lower = clean.lower()
    if lower.startswith(("if ", "while ")) and not re.match(r"^(if|while)\s*\(", clean):
        return False
    code_starts = (
        "#",
        "boolean ",
        "condition ",
        "do ",
        "else",
        "for ",
        "if ",
        "int ",
        "monitor ",
        "pid_t ",
        "pthread_",
        "return",
        "struct ",
        "typedef ",
        "void ",
        "while ",
    )
    if re.match(r"^T\d+:", clean):
        return True
    if clean in {"{", "}", "};"}:
        return True
    if clean.startswith(code_starts) and any(mark in clean for mark in ("{", "}", ";", "=", "/*", "*/")):
        return True
    if indent >= 34 and (
        clean.startswith(code_starts)
        or any(mark in clean for mark in ("{", "}", ";", "=", "/*", "*/", "++", "--"))
    ):
        return True
    return False


def looks_like_figure_line(line: str) -> bool:
    clean = normalize_line(line)
    if not clean:
        return True
    indent = leading_spaces(line)
    if looks_like_code(line, 34):
        return True
    if looks_like_code(line, indent):
        return True
    if indent >= 34:
        return True
    if "\x81" in clean:
        return True
    if len(clean) <= 120 and not re.search(r"[A-Za-z]", clean):
        return True
    if (
        len(clean) <= 90
        and len(clean.split()) <= 12
        and not clean.startswith("•")
        and not clean.endswith((".", ":", ";"))
        and not any(mark in clean for mark in [",", "—"])
    ):
        return True
    return False


def remove_figure_blocks(lines: list[str]) -> list[str]:
    remove: set[int] = set()
    for index, line in enumerate(lines):
        if not FIGURE_RE.match(line):
            continue

        start = index
        cursor = index - 1

        # Captions in the textbook sit below the figure. The PDF extractor may
        # expose the figure's internal labels as text, so remove the whole visual
        # block above a caption, bounded by the preceding blank gap.
        while cursor >= 0 and not lines[cursor].strip():
            start = cursor
            cursor -= 1

        group_cursor = cursor
        blank_run_end: int | None = None
        while group_cursor >= 0:
            if lines[group_cursor].strip():
                group_cursor -= 1
                continue

            blank_end = group_cursor
            while group_cursor >= 0 and not lines[group_cursor].strip():
                group_cursor -= 1
            blank_start = group_cursor + 1
            if blank_end - blank_start + 1 >= 2:
                blank_run_end = blank_end
                break

        if blank_run_end is not None:
            start = blank_run_end + 1
            cursor = start - 1
            while cursor >= 0:
                candidate = lines[cursor]
                if not candidate.strip():
                    start = cursor
                    cursor -= 1
                    continue
                if looks_like_heading(candidate):
                    break
                if not looks_like_figure_line(candidate):
                    break
                start = cursor
                cursor -= 1
        else:
            cursor = index - 1
            while cursor >= 0:
                candidate = lines[cursor]
                if not candidate.strip():
                    start = cursor
                    cursor -= 1
                    continue
                if looks_like_heading(candidate):
                    break
                if not looks_like_figure_line(candidate):
                    break
                start = cursor
                cursor -= 1

        end = index
        while end + 1 < len(lines) and not lines[end + 1].strip():
            end += 1

        remove.update(range(start, end + 1))

    return [line for index, line in enumerate(lines) if index not in remove]


def clean_page_lines(reader: PdfReader, page_num: int, chapter: int) -> list[str]:
    text = reader.pages[page_num - 1].extract_text(extraction_mode="layout") or ""
    raw_lines = text.splitlines()
    lines: list[str] = []
    first_nonblank_seen = False

    for raw_line in raw_lines:
        if not raw_line.strip():
            lines.append("")
            continue
        is_first_nonblank = not first_nonblank_seen
        first_nonblank_seen = True
        if is_running_header(raw_line, chapter, is_first_nonblank):
            continue
        lines.append(raw_line.rstrip())

    return remove_figure_blocks(lines)


def normalize_heading(line: str) -> str:
    clean = normalize_line(line)
    match = SECTION_RE.match(clean)
    if not match:
        return clean
    level = "###" if match.group(1).count(".") >= 2 else "##"
    return f"{level} {match.group(1)} {match.group(2).strip()}"


def join_prose_lines(lines: list[str]) -> str:
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


def normalize_code_lines(lines: list[str]) -> str:
    if not any(line.strip() for line in lines):
        return ""
    normalized: list[str] = []
    min_indent = min((leading_spaces(line) for line in lines if line.strip()), default=0)
    for line in lines:
        if not line.strip():
            if normalized and normalized[-1] != "":
                normalized.append("")
            continue
        clean = normalize_line(line[min_indent:])
        normalized.append(clean)
    while normalized and normalized[-1] == "":
        normalized.pop()
    return "```c\n" + "\n".join(normalized) + "\n```"


def should_stop(line: str) -> bool:
    clean = normalize_line(line)
    return SUMMARY_RE.match(clean) is not None or clean.startswith(STOP_HEADINGS)


def is_chapter_title_fragment(clean: str, chapter: int, chapter_title: str) -> bool:
    if len(clean) > 60:
        return False
    if clean.lower().startswith("updated by "):
        return True
    clean_key = compact_key(clean).replace(str(chapter), "")
    title_key = compact_key(chapter_title)
    if not clean_key:
        return False
    return clean_key in title_key or title_key in clean_key


def extract_chapter(reader: PdfReader, topic: dict, chapter: int) -> tuple[list[str], list[int], int]:
    page_start = int(topic["pageStart"])
    page_end = int(topic["pageEnd"])
    paragraphs: list[str] = [f"# CHAPTER {chapter}: {topic['title'].split(':', 1)[-1].strip()}"]
    pages: list[int] = [page_start]
    prose_buffer: list[str] = []
    code_buffer: list[str] = []
    buffer_page = page_start
    skipping_objectives = False
    stopped_page = page_end

    def flush_prose() -> None:
        nonlocal prose_buffer, buffer_page
        text = join_prose_lines(prose_buffer)
        if text:
            paragraphs.append(text)
            pages.append(buffer_page)
        prose_buffer = []

    def flush_code() -> None:
        nonlocal code_buffer, buffer_page
        text = normalize_code_lines(code_buffer)
        if text:
            paragraphs.append(text)
            pages.append(buffer_page)
        code_buffer = []

    for page_num in range(page_start, page_end + 1):
        for raw_line in clean_page_lines(reader, page_num, chapter):
            clean = normalize_line(raw_line)
            if not clean:
                if code_buffer:
                    code_buffer.append("")
                else:
                    flush_prose()
                continue
            if re.match(r"^\d+\s*Lorelyn\s+Medina/Shutterstock\.", clean):
                continue

            chapter_title = topic["title"].split(":", 1)[-1].strip()
            title_tokens = set(chapter_title.lower().split())
            if clean in {str(chapter), "CHAPTER", topic["title"].split(":")[-1].strip()}:
                continue
            if page_num == page_start and is_chapter_title_fragment(clean, chapter, chapter_title):
                continue
            if page_num == page_start:
                clean_tokens = clean.lower().split()
                if clean_tokens and all(token in title_tokens or token == str(chapter) for token in clean_tokens):
                    continue
            if page_num == page_start and str(chapter) in clean and all(
                word.lower() in clean.lower() for word in chapter_title.split()[:2]
            ):
                continue
            if clean.upper() == "CHAPTER OBJECTIVES":
                flush_prose()
                flush_code()
                skipping_objectives = True
                continue
            if skipping_objectives:
                if SECTION_RE.match(clean):
                    skipping_objectives = False
                else:
                    continue
            if should_stop(clean):
                flush_prose()
                flush_code()
                stopped_page = page_num
                return paragraphs, pages, stopped_page

            if SECTION_RE.match(clean):
                flush_prose()
                flush_code()
                paragraphs.append(normalize_heading(clean))
                pages.append(page_num)
                continue

            indent = leading_spaces(raw_line)
            if looks_like_code(raw_line, indent):
                flush_prose()
                if not code_buffer:
                    buffer_page = page_num
                code_buffer.append(raw_line)
                continue

            if code_buffer:
                flush_code()

            if not prose_buffer:
                buffer_page = page_num
            prose_buffer.append(raw_line)

    flush_prose()
    flush_code()
    return paragraphs, pages, stopped_page


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--chapters", default="3-21")
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON)
    args = parser.parse_args()

    chapter_filter = parse_chapters(args.chapters)
    data = json.loads(args.json.read_text())
    reader = PdfReader(str(args.pdf))

    changed = 0
    for topic in data["subjects"][0]["topics"]:
        chapter = int(str(topic["topicId"]).split("-")[-1])
        if chapter not in chapter_filter:
            continue
        paragraphs, pages, stopped_page = extract_chapter(reader, topic, chapter)
        topic["readingParagraphs"] = paragraphs
        topic["paragraphPages"] = pages
        topic["pageEnd"] = min(int(topic["pageEnd"]), stopped_page)
        changed += 1
        avg_len = round(sum(len(paragraph) for paragraph in paragraphs) / max(len(paragraphs), 1))
        print(
            f"chapter {chapter:02d}: paragraphs={len(paragraphs)} avg_len={avg_len} "
            f"pages={topic['pageStart']}-{topic['pageEnd']}"
        )

    args.json.write_text(json.dumps(data, separators=(",", ":")) + "\n")
    print(f"updated {changed} chapters")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
