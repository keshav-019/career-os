# 2FA Disable Route

## Purpose
Endpoint for disabling authenticator-based 2FA on user request.

## What This Folder Owns
Verifies caller and clears server-side 2FA state for the account.

## Integration Points
Consumed by settings security controls.

## Files In This Folder
- `route.ts`

## Child Folders
- No direct child folders.

## Maintenance Notes
Require strong auth checks before mutating account security state.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
