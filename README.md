# CareerOS Monorepo

## Purpose
Top-level orchestration folder for all CareerOS runtime apps, shared packages, Firebase config, and project-wide tooling.

## What This Folder Owns
Workspace-level dependency management, shared scripts, deployment config, and cross-app coordination.

## Integration Points
Coordinates app workspaces under apps/* and shared package code under packages/* via npm workspaces.

## Files In This Folder
- `.gitignore`
- `.npmrc`
- `.nvmrc`
- `firebase.json`
- `firestore.indexes.json`
- `firestore.rules`
- `package-lock.json`
- `package.json`
- `vercel.json`

## Child Folders
- `apps`
- `images`
- `packages`
- `scripts`

## Maintenance Notes
Keep root scripts workspace-safe and avoid app-specific logic at root when it can live inside the relevant app folder.
Never commit Firebase keys or server secrets to tracked files. Use environment variables (`.env.local` for local dev, Vercel project envs for deploys).
For production API hardening, set `CAREEROS_ALLOWED_ORIGINS` and `CAREEROS_ALLOWED_EXTENSION_IDS` in deployment environments.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
