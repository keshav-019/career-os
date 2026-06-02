# Shared Package Source

## Purpose
Type-safe source files exported by @careeros/shared.

## What This Folder Owns
Canonical interfaces (types.ts) and shared scoring-utility implementations.

## Integration Points
Serves as the contract layer across app boundaries.

## Files In This Folder
- `imports.ts`
- `index.ts`
- `scoring.ts`
- `types.ts`

## Child Folders
- No direct child folders.

## Maintenance Notes
Keep exports intentional and avoid app-specific concerns in shared code.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
