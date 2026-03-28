# App Router Layer

## Purpose
Next.js App Router pages, global styles, and route handlers.

## What This Folder Owns
Product screens, layout shell wiring, API endpoints, and fallback routes.

## Integration Points
Route components depend on firebase hooks and interview/question utilities in src/lib.

## Files In This Folder
- `globals.css`
- `layout.tsx`
- `not-found.tsx`
- `page.tsx`

## Child Folders
- `admin` - admin-only tools gated on the `users/{uid}.admin` Firestore flag (see `lib/firebase/user-profile.ts` and
  `lib/server/require-admin.ts`). Not linked in navigation for non-admins.
- `ai-match`
- `analytics`
- `api`
- `applications`
- `calendar`
- `coding-room`
- `dashboard`
- `desktop`
- `integrations`
- `interview-prep`
- `jobs`
- `learning`
- `login`
- `notifications`
- `profile`
- `resumes`
- `settings`
- `system-design`
- `test-room`
- `war-room`

## Maintenance Notes
Follow App Router file conventions with page.tsx, layout.tsx, not-found.tsx, and route.ts where applicable.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
