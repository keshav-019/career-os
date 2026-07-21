# Server-Only Security Helpers

## Purpose
Node-only modules for secure auth verification, admin-access gating, TOTP secret encryption, 2FA session tokens, the
local learning-content admin cookie session, and API rate limiting.

## What This Folder Owns
Token verification, `admin: true` gating for privileged API routes, encrypted secret handling, ephemeral session
issuance-validation, and request throttling.

## Integration Points
Used exclusively by API route handlers under src/app/api.

## Files In This Folder
- `learning-admin.ts` - local username/password admin session for editing Learning Center content (unrelated to
  Firebase user `admin` flag).
- `rate-limit.ts`
- `require-admin.ts` - verifies a request's Bearer id token AND that the caller's `users/{uid}` Firestore document has
  `admin === true`. This is the only trustworthy way to gate an admin-only API route - the client-side `useIsAdmin()`
  hook only controls what UI is shown.
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
