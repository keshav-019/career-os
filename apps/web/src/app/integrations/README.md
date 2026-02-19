# Integrations Route

## Purpose
Integrations surface (currently minimized or transitional).

## What This Folder Owns
Reserved for external provider connection settings if reintroduced.

## Integration Points
Can share settings primitives with profile/settings modules.

## Files In This Folder
- `page.tsx`

## Child Folders
- No direct child folders.

## Maintenance Notes
If feature is disabled, keep route copy explicit about current availability.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
