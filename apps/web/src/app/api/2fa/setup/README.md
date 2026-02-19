# 2FA Setup Route

## Purpose
Creates setup payloads (secret/otpauth/qr metadata) for authenticator enrollment.

## What This Folder Owns
Initial setup transaction before activation is finalized.

## Integration Points
Triggered from settings security section.

## Files In This Folder
- `route.ts`

## Child Folders
- No direct child folders.

## Maintenance Notes
Do not mark 2FA active until verification succeeds.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
