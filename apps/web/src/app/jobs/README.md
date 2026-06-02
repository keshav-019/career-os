# Jobs Route

## Purpose
Jobs discovery and saved-jobs oriented route surface.

## What This Folder Owns
Displays imported job records and related workflow entry points.

## Integration Points
Couples with extension import pipeline and job collection hooks.

## Files In This Folder
- `page.tsx`

## Child Folders
- No direct child folders.

## Maintenance Notes
Keep parsing assumptions out of UI; UI should consume normalized job fields only.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
