# 2FA Verify Route

## Purpose
Validates authenticator codes for setup confirmation and sign-in challenges.

## What This Folder Owns
Code verification and signed 2FA session issuance.

## Integration Points
Used by login challenge screen and setup completion flow.

## Files In This Folder
- `route.ts`

## Child Folders
- No direct child folders.

## Maintenance Notes
Guard against replay, clock drift abuse, and malformed payloads.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
