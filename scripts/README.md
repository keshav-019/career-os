# Workspace Scripts

## Purpose
Reserved root location for repository-wide maintenance scripts.

## What This Folder Owns
Cross-workspace tooling scripts when needed.

## Integration Points
Can be wired into root package.json scripts.

## Files In This Folder
- No direct files. This folder is currently a structural container.

## Child Folders
- No direct child folders.

## Maintenance Notes
Keep scripts deterministic and non-destructive by default.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
