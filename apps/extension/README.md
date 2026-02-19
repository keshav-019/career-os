# Chrome Extension App

## Purpose
Manifest V3 extension for detecting and saving job postings into CareerOS.

## What This Folder Owns
Manifest config, popup UI, background workers, content scripts, and extension icons.

## Integration Points
Posts normalized job payloads to web app import API using extension token package auth.

## Files In This Folder
- `manifest.json`
- `package.json`

## Child Folders
- `icons`
- `src`

## Maintenance Notes
Keep host permission scope minimal and parser behavior deterministic per supported site.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
