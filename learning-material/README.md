# Learning Material Source Folder

## Purpose
Stores source learning-content files consumed by the web Learning Center.

## What This Folder Owns
Minified JSON content files (for example CSE, System Design, Aptitude, AI) that are parsed server-side and rendered in hierarchical UI tiles.

## Integration Points
Read by `apps/web/src/lib/learning/material-library.ts` through Learning APIs:
- `/api/learning/library`
- `/api/learning/topic`

## Files In This Folder
- `cse_detailed_reading_material_minified.json`
- `system_design_deep_reading_materials_210.min.json`
- `ai_ml_reading_materials_phase_1.min.json`
- `ai_ml_reading_materials_phase_2.min.json`
- `ai_ml_reading_materials_phase_3.min.json`
- `ai_ml_reading_materials_phase_4.min.json`
- `ai_ml_reading_materials_phase_5.min.json`
- `aptitude_reading_materials_by_subtopic_54.min.json`

## Child Folders
- No direct child folders.

## Maintenance Notes
1. Keep files valid JSON and include stable identifiers for subjects and topics when possible.
2. Preserve link fields (`url`) for references so UI can render clickable resources.
3. Avoid deleting this folder even when content is temporarily sparse; additional files can be dropped in incrementally.
4. Prefer additive updates to existing files to keep IDs stable for bookmarks and analytics.

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

4. Aptitude section format:
- top-level `sections[]`
- each section contains `topics[]`
- each topic contains nested `reading_material`, worked examples, traps, drills, and mastery checks

## Authoring Notes For Future Files
1. Prefer setting `metadata.trackId` when available to avoid any ambiguity in category mapping.
2. Keep stable IDs (`subjectId`, `topicId`, `id`) whenever possible so deep links stay stable.
3. Add link fields as `url` or `reference_links` arrays so clickable reference cards can be generated automatically.
4. If a new schema is introduced, update `apps/web/src/lib/learning/material-library.ts` parser adapters.
