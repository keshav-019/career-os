# Web API Routes

## Purpose
Server-side handlers for secure or integration-focused actions.

## What This Folder Owns
2FA setup/verify/session controls and extension job import endpoint.

## Integration Points
Uses server auth verification and crypto/session helpers from src/lib/server.

## Files In This Folder
- No direct files. This folder is currently a structural container.

## Child Folders
- `2fa`
- `jobs`
- `resumes`

## Maintenance Notes
Keep endpoints defensive, validate auth early, and return explicit error messages for UI handling.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
