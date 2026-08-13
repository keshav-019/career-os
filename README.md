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
- `coding-problems.seed.json` - the original 28 coding-arena problems, ready to paste (as a whole array, or one
  entry at a time) into the admin editor at `/admin/coding-problems` (accounts with `admin: true` only). See
  `apps/web/src/lib/coding-catalog/README.md` for the pipeline that turns a pasted entry into a judge-ready
  Firestore record, and `apps/web/src/app/admin/coding-problems/README.md` for how the editor itself works.
- `firebase.json`
- `firestore.indexes.json`
- `firestore.rules`
- `package-lock.json`
- `package.json`
- `system-design-problems.seed.json` - a reference export of the 26 System Design problems, for copying the *shape*
  of a new entry from. Unlike coding problems, System Design problems are **not** admin-editable through a UI - they
  live directly in `apps/web/src/lib/system-design/catalog.server.ts`. See that folder's README for the full
  step-by-step guide to adding one.
- `vercel.json`

## Child Folders

- `apps`
- `images`
- `packages`
- `scripts`

## Maintenance Notes

Keep root scripts workspace-safe and avoid app-specific logic at root when it can live inside the relevant app folder.
Never commit Firebase keys or server secrets to tracked files. Use the repo-root `.env.local` for local dev and hosting-provider environment variables for deploys; `.env.local.example` is the single tracked template for every workspace.
For production API hardening, set `CAREEROS_ALLOWED_ORIGINS` and `CAREEROS_ALLOWED_EXTENSION_IDS` in deployment environments.

## Contributor Checklist

1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
