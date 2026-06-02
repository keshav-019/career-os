# Web Source Root

## Purpose
All TypeScript/React source for the web app.

## What This Folder Owns
Route files, reusable UI components, Firebase data hooks, domain helpers, and server utilities.

## Integration Points
App Router code in src/app composes with helpers from src/lib and UI from src/components.

## Files In This Folder
- No direct files. This folder is currently a structural container.

## Child Folders
- `app`
- `components`
- `lib`

## Maintenance Notes
Keep route-specific logic close to route folders; extract shared behavior into lib/components when reused.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
