# Web Domain Library

## Purpose
Shared non-visual logic for data access, formatting, domain models, and utility workflows.

## What This Folder Owns
Firebase data hooks, interview engines, latex helpers, preferences, coding/system-design problem catalogs, upload
helpers, and server-only security utilities.

## Integration Points
Used throughout app routes and API handlers.

## Files In This Folder
- `desktop-mode.ts`
- `format.ts`
- `latex-compiler.ts`
- `local-admin-session.ts`
- `mock-data.ts`
- `preferences.ts`
- `resume-templates.ts`
- `resume-types.ts`
- `two-factor-session.ts`
- `url-safety.ts`

## Child Folders
- `ai` - OpenRouter-backed AI features (currently the Learning Center's plan generator).
- `cloudinary` - shared unsigned browser-to-Cloudinary upload helper.
- `coding-catalog` - admin-authored coding-arena problem storage/generation (Firestore-backed).
- `firebase`
- `interview`
- `latex`
- `learning`
- `server`
- `system-design` - the System Design track's problem catalog and grading logic (still hardcoded in code, not
  admin-editable - see that folder's README for why and how to add a problem).

## Maintenance Notes
Maintain strict separation between browser-safe helpers and server-only modules.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
