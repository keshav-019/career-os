# Shared Packages

## Purpose
Workspace for reusable package code consumed by multiple apps.

## What This Folder Owns
Currently houses @careeros/shared domain contracts and scoring helpers.

## Integration Points
Imported via npm workspaces by web app and future apps.

## Files In This Folder
- No direct files. This folder is currently a structural container.

## Child Folders
- `shared`

## Maintenance Notes
Any breaking contract changes should be coordinated across dependents in a single PR.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
