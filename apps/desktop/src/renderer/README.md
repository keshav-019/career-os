# Desktop Renderer Assets

## Purpose
Renderer entry HTML and static desktop window shell resources.

## What This Folder Owns
Minimal user-facing desktop window chrome and content.

## Integration Points
Loaded by electron main process during app startup.

## Files In This Folder
- `error.html` - shown if the bundled web app runtime fails to start.
- `index.html`
- `loading.html` - shown briefly while the bundled web app runtime boots.
- `logo.png` - copy of `apps/web/public/careeros-dark-mode.png`, shown on the loading/error screens above. Kept in
  sync manually with the web app's asset (see `apps/desktop/build/README.md` for the same note about the
  electron-builder icon copy).

## Child Folders
- No direct child folders.

## Maintenance Notes
Keep lightweight and avoid duplicating web app logic unless intentionally productized.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
