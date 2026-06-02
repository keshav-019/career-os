# Interview Prep Route

## Purpose
Interview War Room front door for track/role exploration and test selection.

## What This Folder Owns
Track cards, AI role flow, attempted/not-attempted filtering, and navigation into test room.

## Integration Points
Uses compiled question bank templates and user attempt history from Firestore.

## Files In This Folder
- `page.tsx`

## Child Folders
- No direct child folders.

## Maintenance Notes
Preserve smooth transition animations and clear route-level affordances.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
