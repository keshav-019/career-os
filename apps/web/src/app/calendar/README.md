# Calendar Route

## Purpose
Internal calendar view for interviews and reminders.

## What This Folder Owns
Displays and groups user events from CareerOS-managed scheduling data.

## Integration Points
Fed by interview status updates and reminder collections.

## Files In This Folder
- `page.tsx`

## Child Folders
- No direct child folders.

## Maintenance Notes
Calendar UX should remain functional without external calendar provider sync.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
