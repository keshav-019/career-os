# @careeros/shared Package

## Purpose

Shared TypeScript package for domain types and common logic.

## What This Folder Owns

Exports types, scoring helpers, and stable interfaces for cross-app consistency.

## Integration Points

Used by web app and extension-desktop planning contracts.

## Files In This Folder

- `package.json`
- `tsconfig.json`

## Child Folders

- `src`

## Maintenance Notes

Prefer backward-compatible additions and document all shape changes clearly.

## Contributor Checklist

1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
