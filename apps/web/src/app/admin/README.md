# Admin Tools

## Purpose
Container for tools restricted to accounts with `admin: true` on their `users/{uid}` Firestore document. Nothing here
is linked in the sidebar for non-admins, and every page must independently re-check `useIsAdmin()` on mount (never
assume unreachability equals security).

## What This Folder Owns
Admin-only UI. It does not own admin authorization itself - that lives in `lib/firebase/user-profile.ts` (client-side
gating, UI only) and `lib/server/require-admin.ts` (server-side verification, the only check that actually matters).

## Integration Points
- `@/lib/firebase/user-profile` - `useIsAdmin()` hook used by every page in this folder to decide what to render.
- `@/lib/server/require-admin` - used by the API routes these pages call, never by the pages themselves (client
  components cannot use Admin SDK code).
- `AppShell`'s `buildNavSections()` only adds the "Admin" nav section when `useIsAdmin()` is true.

## Files In This Folder
- No direct files.

## Child Folders
- `coding-problems` - author/manage coding-arena problems (paste JSON or fill in fields one by one).
- `system-design-problems` - author/manage system-design catalog problems (paste JSON only, plus a
  bulk-import box for the one-time 26-problem migration - see that folder's README.md).

## Maintenance Notes
The `admin` flag can only ever be set through the Firebase console or the Admin SDK - firestore.rules blocks clients
from writing it themselves (see the root `firestore.rules`). Do not add a self-service "become admin" UI; that would
defeat the point.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. Every new admin page must call `useIsAdmin()` and render a restricted-access state when false/loading - never rely
   solely on the page being unlinked.
3. Every new admin API route must call `requireAdmin()` before doing anything privileged - never trust a client-sent
   "isAdmin" flag.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
