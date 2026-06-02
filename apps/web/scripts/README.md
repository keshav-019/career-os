# Web App Scripts

## Purpose
Reserved location for web-app specific automation scripts.

## What This Folder Owns
One-off data migration, asset prep, or development utilities scoped to web app only.

## Integration Points
Can be referenced from apps/web package scripts when added.

## Files In This Folder
- No direct files. This folder is currently a structural container.

## Child Folders
- No direct child folders.

## Maintenance Notes
Keep script side effects explicit and document usage inline.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
