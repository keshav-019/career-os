# Job Import Route

## Purpose
Accepts parsed job payloads and persists them into user pipeline data.

## What This Folder Owns
Normalization, token verification, and idempotent save behavior for captured jobs.

## Integration Points
Primary backend contract for Chrome extension save action.

## Files In This Folder
- `route.ts`

## Child Folders
- No direct child folders.

## Maintenance Notes
Keep parsing tolerant and fail with actionable errors for extension UI.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
