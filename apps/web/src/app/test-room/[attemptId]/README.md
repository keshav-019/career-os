# Test Attempt Route

## Purpose
Runtime test-taking screen for a specific attempt id.

## What This Folder Owns
Timer, question navigation, response capture, submission, and result state updates.

## Integration Points
Reads and writes attempt docs in Firestore and uses scoring utilities.

## Files In This Folder
- `apps/web/src/app/test-room/[attemptId]/page.tsx`

## Child Folders
- No direct child folders.

## Maintenance Notes
Preserve deterministic persistence for in-progress and submitted states.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
