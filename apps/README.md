# Runtime Applications

## Purpose

Container for all user-facing runtime applications.

## What This Folder Owns

Web app, Chrome extension, desktop helper app, and Expo-powered mobile app.

## Integration Points

Each child app can evolve independently but should align on shared domain types from packages/shared.

## Files In This Folder

- No direct files. This folder is currently a structural container.

## Child Folders

- `desktop`
- `extension`
- `mobile`
- `web`

## Maintenance Notes

Treat each app as a bounded context. Cross-app changes should start from shared contracts first.

## Contributor Checklist

1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
