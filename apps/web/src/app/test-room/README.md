# Test Room Namespace

## Purpose
Host route for test attempt lifecycle screens.

## What This Folder Owns
Attempt bootstrap, instruction stage, and nested live attempt execution route.

## Integration Points
Uses practice attempt records and scoring helpers.

## Files In This Folder
- No direct files. This folder is currently a structural container.

## Child Folders
- `[attemptId]`

## Maintenance Notes
Attempt counting and timer behavior must reflect real start-submit boundaries.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
