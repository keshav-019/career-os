# Resume Compile Helpers

## Purpose
Abstractions for resume compile execution across browser and desktop modes.

## What This Folder Owns
Compiler adapters, capability probing, and fallback strategy logic.

## Integration Points
Used by resume flows and desktop-only messaging decisions.

## Files In This Folder
- `browser-compiler.ts`
- `desktop-helper-compiler.ts`

## Child Folders
- No direct child folders.

## Maintenance Notes
Keep compile adapters isolated so runtime strategy changes do not leak into UI code.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
