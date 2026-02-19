# Extension Source

## Purpose
Core extension runtime logic and UI assets.

## What This Folder Owns
Content parser-injector, background coordination, popup token UX, and style system.

## Integration Points
Interacts with job portals in content context and CareerOS API over network requests.

## Files In This Folder
- `background.js`
- `contentScript.js`
- `popup.css`
- `popup.html`
- `popup.js`

## Child Folders
- No direct child folders.

## Maintenance Notes
Keep parser extraction robust against site layout drift and isolate selectors per site.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
