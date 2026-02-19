# Aptitude Question Media

## Purpose
SVG diagrams used by aptitude MCQs.

## What This Folder Owns
Keeps visual aids separate from question text so they can be reused across tests.

## Integration Points
Question bank entries reference these assets by URL path.

## Files In This Folder
- `arithmetic-grid.svg`
- `number-line.svg`
- `probability-bag.svg`
- `ratio-bars.svg`
- `speed-distance.svg`
- `trains.svg`
- `venn.svg`

## Child Folders
- No direct child folders.

## Maintenance Notes
Prefer lightweight SVGs and stable filenames to avoid broken references in existing tests.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
