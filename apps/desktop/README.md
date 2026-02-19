# Desktop Companion App

## Purpose
Electron desktop companion for local-machine features, especially resume compile.

## What This Folder Owns
Electron main process boot, local helper API, and packaging config.

## Integration Points
Web app can call local helper endpoint for desktop-only operations.

## Files In This Folder
- `package.json`

## Child Folders
- `src`

## Maintenance Notes
Keep local server locked to localhost and document any required native dependencies.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
