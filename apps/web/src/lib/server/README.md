# Server-Only Security Helpers

## Purpose
Node-only modules for secure auth verification, TOTP secret encryption, and 2FA session tokens.

## What This Folder Owns
Token verification, encrypted secret handling, and ephemeral session issuance-validation.

## Integration Points
Used exclusively by API route handlers under src/app/api.

## Files In This Folder
- `two-factor-crypto.ts`
- `two-factor-session.ts`
- `two-factor-store.ts`
- `verify-request-auth.ts`

## Child Folders
- No direct child folders.

## Maintenance Notes
Never import these modules into client components. Keep secrets in server env only.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
