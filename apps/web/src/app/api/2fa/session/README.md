# 2FA Session Route

## Purpose
Checks whether an authenticated request has satisfied second-factor requirements.

## What This Folder Owns
Returns session status used by route guarding logic.

## Integration Points
Used by AppShell and login flow to gate dashboard access.

## Files In This Folder
- `route.ts`

## Child Folders
- No direct child folders.

## Maintenance Notes
Keep response schema stable because multiple UI gates depend on it.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
