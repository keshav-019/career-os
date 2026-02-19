# Extension Icons

## Purpose
Chrome extension icon assets at required sizes.

## What This Folder Owns
16-32-48-128 icon set referenced by manifest and store surfaces.

## Integration Points
Consumed by browser toolbar, extension management UI, and prompts.

## Files In This Folder
- `icon128.png`
- `icon16.png`
- `icon32.png`
- `icon48.png`

## Child Folders
- No direct child folders.

## Maintenance Notes
Maintain consistent visual identity across all required dimensions.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
