# Jobs API Namespace

## Purpose
Namespace for job ingestion and job-related server operations.

## What This Folder Owns
Current primary entry: extension-driven import route.

## Integration Points
Receives authenticated payloads from browser extension and stores normalized job records.

## Files In This Folder
- No direct files. This folder is currently a structural container.

## Child Folders
- `import`

## Maintenance Notes
Prefer additive payload parsing to support multiple job-board structures.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
