# Web Domain Library

## Purpose
Shared non-visual logic for data access, formatting, domain models, and utility workflows.

## What This Folder Owns
Firebase data hooks, interview engines, latex helpers, preferences, and server-only security utilities.

## Integration Points
Used throughout app routes and API handlers.

## Files In This Folder
- `format.ts`
- `mock-data.ts`
- `preferences.ts`
- `resume-templates.ts`
- `two-factor-session.ts`

## Child Folders
- `firebase`
- `interview`
- `latex`
- `server`

## Maintenance Notes
Maintain strict separation between browser-safe helpers and server-only modules.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
