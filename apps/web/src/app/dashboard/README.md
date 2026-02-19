# Dashboard Route

## Purpose
Primary landing surface after authentication.

## What This Folder Owns
High-level metrics, quick status visibility, and entry points into major workflows.

## Integration Points
Aggregates data from jobs, interview prep, reminders, and profile readiness signals.

## Files In This Folder
- `page.tsx`

## Child Folders
- No direct child folders.

## Maintenance Notes
Prefer concise signal-first widgets over dense configuration controls.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
