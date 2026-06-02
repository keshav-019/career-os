# Public Static Assets

## Purpose
Static files served directly by Next.js without bundling transformations.

## What This Folder Owns
Icons, favicon, war-room art, aptitude media diagrams, and browser TeX runtime assets.

## Integration Points
Referenced by route UIs, interview question metadata, and resume tooling.

## Files In This Folder
- `careeros-logo-128.png`
- `favicon.ico`

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
