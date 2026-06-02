# Profile Route

## Purpose
Candidate profile management workspace.

## What This Folder Owns
Personal details, career preferences, education/experience modals, accomplishments, and resume references.

## Integration Points
Persists to user profile collections and feeds display names into shell/components.

## Files In This Folder
- `page.tsx`

## Child Folders
- No direct child folders.

## Maintenance Notes
Keep autosave/manual-save expectations explicit and avoid silent data loss.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
