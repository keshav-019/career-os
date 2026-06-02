# Analytics Route

## Purpose
Candidate performance analytics screen for test attempts.

## What This Folder Owns
Date filtering, track filtering, summary cards, charts, pagination, and topic strengths/weaknesses.

## Integration Points
Consumes practice attempts from Firebase hooks and question metadata for scoring/topic breakdowns.

## Files In This Folder
- `page.tsx`

## Child Folders
- No direct child folders.

## Maintenance Notes
Chart and summary UX should stay readable for both sparse and dense datasets.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
