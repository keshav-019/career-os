# Applications Route

## Purpose
Main application pipeline management page.

## What This Folder Owns
Kanban flow, table/expanded views, status transitions, and application-level actions.

## Integration Points
Backed by saved job records and pipeline status updates in Firestore.

## Files In This Folder
- `page.tsx`

## Child Folders
- No direct child folders.

## Maintenance Notes
Keep drag/status UX deterministic and avoid hidden destructive actions.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
