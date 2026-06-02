# Settings Route

## Purpose
Account, security, and preference settings page.

## What This Folder Owns
Theme/account controls, 2FA setup-disable, session controls, and preference toggles.

## Integration Points
Connects to 2FA API routes and Firebase user metadata.

## Files In This Folder
- `page.tsx`

## Child Folders
- No direct child folders.

## Maintenance Notes
Security changes must remain explicit and reversible where safe.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
