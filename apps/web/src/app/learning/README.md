# Learning Route

## Purpose
Learning center surface for preparation resources.

## What This Folder Owns
Resource cards, progress-oriented study guidance, and the local admin editor for correcting file-backed learning content.

## Integration Points
Can consume interview topic weakness signals from analytics in future iterations.

## Files In This Folder
- `page.tsx`

## Child Folders
- No direct child folders.

## Maintenance Notes
Keep content cards data-driven and easy to expand. The editor controls are visible only for the local admin login session created by `/login`; local saves write back to the minified JSON files and uploaded images under `public/learning/admin-uploads`.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
