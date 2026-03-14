# Learning Material Source Folder

## Purpose
Stores source learning-content files consumed by the web Learning Center.

## What This Folder Owns
Minified JSON content files (for example CSE and AI) that are parsed server-side and rendered in hierarchical UI tiles.

## Integration Points
Read by `apps/web/src/lib/learning/material-library.ts` through Learning APIs:
- `/api/learning/library`
- `/api/learning/topic`

## Files In This Folder
- `cse_detailed_reading_material_minified.json`
- `algorithms_textbook_clean.min.json`
- `operating_systems_textbook_clean.min.json`
- `c_programming_textbook_clean.min.json`
- `data_structures_textbook_clean.min.json`
- `python_programming_textbook_clean.min.json`
- `system_design_interview_textbook_clean.min.json`
- `ai_textbook_curriculum_clean.min.json`

## Child Folders
- No direct child folders.

## Maintenance Notes
1. Keep files valid JSON and include stable identifiers for subjects and topics when possible.
2. Preserve link fields (`url`) for references so UI can render clickable resources.
3. Avoid deleting this folder even when content is temporarily sparse; additional files can be dropped in incrementally.
4. Prefer additive updates to existing files to keep IDs stable for bookmarks and analytics.
5. `python_programming_textbook_clean.min.json` is chapter-driven content generated from the PDF source with compressed figure assets and inline-placement metadata.
6. `c_programming_textbook_clean.min.json` is unit-driven content generated from `DECAP010_PROGRAMMING_IN_C.pdf` with cleaned headers, triple-quoted code blocks, compressed figure assets, and inline-placement metadata.
7. `data_structures_textbook_clean.min.json` is unit-driven content generated from `DCAP407_DATA_STRUCTURE.pdf` with Objectives/Contents removed, numbered section prefixes stripped from headers (for example `1.1`), triple-quoted code blocks, compressed figure assets, and inline-placement metadata.
8. `algorithms_textbook_clean.min.json` is chapter-driven CLRS content generated from `Cormen Introduction to Algorithms.pdf`, where each chapter starts at the chapter opening and stops at the first `Exercises` heading (all exercises and content after that point are excluded).
9. `operating_systems_textbook_clean.min.json` is chapter-driven OS textbook content generated from `Abraham-Silberschatz-Operating-System-Concepts-10th-2018.pdf`, where each chapter removes Objectives and stops at the first `Summary` heading (summary, practice exercises, and all later chapter content excluded).
10. `system_design_interview_textbook_clean.min.json` is chapter-driven content generated from `System Design Interview by Alex Xu.pdf`, with per-chapter Reference materials sections removed and embedded visuals, code snippets, and tables extracted from the PDF, compressed, and loaded as a Computer Science subject.
11. `ai_textbook_curriculum_clean.min.json` is ordered AI textbook material generated from the supplied ML, math, deep learning, NLP, transformer, computer vision, and MLOps PDFs. Text-bearing PDFs are extracted by chapter or section with chapter-end summaries omitted, figures are compressed under `apps/web/public/learning/ai-textbooks`, the image-only Deep Learning PDF is converted to OCR text instead of published page screenshots, and MLOps is represented as one direct whitepaper topic.

## Supported Content Shapes
The parser supports multiple JSON formats and normalizes them into the same track -> subject -> topic UI flow:

1. Classic learning format:
- `metadata`
- `referenceCatalog`
- `subjects[]` with nested `topics[]`

2. AI role-phase format:
- top-level `roles[]`
- each role contains `topics[]`
- optional fields like `reading_strategy`, `expected_artifacts`, `practice_lab`, etc.

3. System design module format:
- top-level `modules[]`
- modules grouped into subjects by `area`
- each module treated as a topic (with drill-down fields + extracted links)

## Authoring Notes For Future Files
1. Prefer setting `metadata.trackId` when available to avoid any ambiguity in category mapping.
2. Keep stable IDs (`subjectId`, `topicId`, `id`) whenever possible so deep links stay stable.
3. Add link fields as `url` or `reference_links` arrays so clickable reference cards can be generated automatically.
4. If a new schema is introduced, update `apps/web/src/lib/learning/material-library.ts` parser adapters.
