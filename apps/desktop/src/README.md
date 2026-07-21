# Desktop Source

## Purpose
Source files for electron main process and renderer shell.

## What This Folder Owns
Main process lifecycle and minimal renderer bootstrap assets.

## Integration Points
Main process exposes local helper endpoints consumed by web flows.

## Files In This Folder
- `main.js`
- `web-app.js`
- `helper-server.js`
- `latex-runtime.js`

## Child Folders
- `renderer`
- `coding`

## Maintenance Notes
Keep UI shell thin; core desktop behavior should live in explicit service modules when expanded.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
