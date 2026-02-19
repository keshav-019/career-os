# Resumes Route

## Purpose
Resume library and listing route.

## What This Folder Owns
Resume listing management and desktop-only messaging for advanced studio functions.

## Integration Points
Interfaces with resume metadata hooks and desktop helper flows.

## Files In This Folder
- `page.tsx`

## Child Folders
- `new`

## Maintenance Notes
Keep clear boundary between web-safe actions and desktop-only actions.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
