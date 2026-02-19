# Interview War Room Artwork

## Purpose
Static category artwork for interview prep cards.

## What This Folder Owns
Base track cards and AI role-specific art namespace.

## Integration Points
Consumed by interview-prep UI to render consistent category and role visuals.

## Files In This Folder
- `ai-card.svg`
- `aptitude-card.svg`
- `coding-card.svg`
- `cs-card.svg`

## Child Folders
- `ai-roles`

## Maintenance Notes
Keep naming in sync with route-level mapping logic.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
