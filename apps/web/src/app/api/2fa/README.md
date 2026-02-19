# Two-Factor API Namespace

## Purpose
Groups all authenticator-based two-factor server routes.

## What This Folder Owns
Setup handshake, code verification, session checks, and disable flow.

## Integration Points
Backed by encrypted TOTP secret storage and session token signing utilities.

## Files In This Folder
- No direct files. This folder is currently a structural container.

## Child Folders
- `disable`
- `session`
- `setup`
- `verify`

## Maintenance Notes
Any contract changes here must be mirrored in login/settings client flows.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
