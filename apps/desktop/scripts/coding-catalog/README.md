# Coding Catalog (Historical Source - Frozen)

## Purpose
**This folder is no longer part of the running app or any build step.** It's kept only as the historical hand-authored
source the original 28 coding problems were extracted from, before the coding-arena catalog moved to Firestore and
an in-app admin editor (see `apps/web/src/lib/coding-catalog/README.md` and
`apps/web/src/app/admin/coding-problems/README.md`). The root `/coding-problems.seed.json` is the up-to-date
re-export of this data in the shape the new admin editor actually accepts - treat that file, not this folder, as the
source of truth going forward.

## What This Folder Owns
- `problems-source.js` - `module.exports = { PROBLEMS }`, the 28 original hand-authored problem definitions
  (metadata, `paramSpec`/`outputKind`, `referenceBody`, raw `testCases` values). No `difficulty` field (that was
  injected at build time, always `"hard"`, by `build-problems.js`).
- `starter-templates.js` / `serialize.js` - the per-language harness/starter-code generator and stdin serializer.
  **Duplicated** (not shared) at `apps/web/src/lib/coding-catalog/{starter-templates,serialize}.js` - that copy is
  the one actually used by the running app now. If you ever need to change harness-generation logic, change it in
  both places or retire one in favor of the other.
- `build-problems.js` - the old build-time script that turned `problems-source.js` into
  `apps/desktop/src/coding/problems.js` (computing expected outputs by running each `referenceBody`). That output
  file no longer exists - the equivalent work now happens per-problem, on save, in
  `apps/web/src/lib/coding-catalog/problem-builder.ts`'s `buildCodingProblemRecord()`. `build-problems.js` itself
  still runs if invoked directly, but nothing calls it anymore (the `build:coding-catalog` npm script was removed
  from `apps/desktop/package.json` for exactly this reason) and its output would go nowhere useful.

## Integration Points
None at runtime. Referenced only by documentation (this file, and the READMEs linked above) pointing back here as
"where the original data came from."

## Files In This Folder
- `build-problems.js`
- `problems-source.js`
- `serialize.js`
- `starter-templates.js`

## Child Folders
- No direct child folders.

## Maintenance Notes
Do not add new problems here - add them through the admin editor (`/admin/coding-problems` in the web app) instead,
which writes directly to Firestore. This folder should be treated as read-only history; if it ever gets in the way
of a refactor, it's safe to delete entirely (the seed JSON already captures everything useful from it).

## Contributor Checklist
1. Do not wire this folder back into any build step - the new pipeline is Firestore + the admin editor, on purpose.
2. If you do need to reference this data, prefer the root `/coding-problems.seed.json` (already in the correct
   `CodingProblemSourceInput[]` shape) over reading these files directly.
