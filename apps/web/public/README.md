# Public Static Assets

## Purpose
Static files served directly by Next.js without bundling transformations.

## What This Folder Owns
Icons, favicon, war-room art, aptitude media diagrams, and browser TeX runtime assets.

## Integration Points
Referenced by route UIs, interview question metadata, and resume tooling.

## Files In This Folder
- `careeros-dark-mode.png` - default brand mark (favicon, Electron taskbar/packaged icon, and the sidebar logo when the
  app is in dark mode). This is the default everywhere outside the app; see `AppShell.tsx` for the in-app light-mode
  swap.
- `careeros-light-mode.png` - sidebar logo shown only when the in-app theme toggle is set to light mode.
- `careeros-logo-128.png` - superseded by the two files above; kept only because nothing currently deletes it.
- `favicon.ico` - superseded by the PNG favicon declared in `app/layout.tsx` metadata; browsers that ignore the
  `<link rel="icon">` tag fall back to this.

## Child Folders
- `aptitude-media`
- `texlive`
- `war-room`

## Maintenance Notes
Use deterministic names for cache stability. Large binaries should be intentional and documented.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
