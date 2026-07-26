# Desktop Scripts

## Purpose

Standalone Node scripts run outside the packaged Electron app - build steps, runtime prep, and smoke tests. None of
these ship inside the built app itself; they're dev/CI tooling.

## What This Folder Owns

- `build-web.js` - copies the built Next.js standalone bundle from `apps/web` into this app so Electron can serve it
  locally without a network connection (see `src/web-app.js`).
- `prepare-ai-runtime.js` / `install-ai-runtime-linux.sh` - fetches/prepares the bundled local AI runtime.
- `prepare-latex-runtime.js` - fetches/prepares the portable LaTeX (Tectonic) runtime. Use `--target win32-x64` when
  preparing a Windows bundle from any host OS.
- `verify-latex-bundle.js` - fails the Windows package build if the packaged app does not contain the bundled
  `resources/latex/win32-x64/tectonic.exe` compiler.
- `smoke-helper-api.js` - end-to-end sanity check for the helper server's LaTeX endpoints.
- `smoke-latex-runtime.js` - sanity check for the LaTeX runtime specifically.
- `smoke-coding-arena.js` - end-to-end sanity check for the coding-arena judge (`/code/run`, `/code/submit`) across
  the crash/syntax-error/wrong-answer/correct-answer paths. Problem catalog data now lives in Firestore (see
  `apps/web/src/lib/coding-catalog`), so this script mocks the one web-app endpoint the desktop helper depends on
  (`GET /api/coding-problems/:id/judge-data`) with a tiny local HTTP server serving `fixtures/trapping-rain-water-judge-data.json`,
  rather than requiring a real Firebase project to run. It does **not** test the catalog/Firestore layer at all -
  that's covered separately (see `apps/web/src/lib/coding-catalog/README.md`'s validation notes). Run with
  `npm run smoke:coding` from `apps/desktop`.

## Integration Points

- `smoke-coding-arena.js` imports `../src/helper-server.js` directly (in-process, no Electron needed) and calls
  `helper.setWebBaseUrl()` to point it at its own local mock server instead of a real running web app.

## Files In This Folder

- `build-web.js`
- `install-ai-runtime-linux.sh`
- `prepare-ai-runtime.js`
- `prepare-latex-runtime.js`
- `smoke-coding-arena.js`
- `smoke-helper-api.js`
- `smoke-latex-runtime.js`
- `verify-latex-bundle.js`

## Child Folders

- `coding-catalog` - **historical only**, no longer part of the running app or any build step. See that folder's
  README before touching it.
- `fixtures` - small static JSON fixtures used by the smoke tests (currently just the coding-arena judge-data mock).

## Maintenance Notes

If `apps/web/src/lib/coding-catalog/problem-builder.ts` or `public-shapes.ts`'s `toJudgeData()` output shape ever
changes, regenerate `fixtures/trapping-rain-water-judge-data.json` (see that folder's README for the exact steps) -
`smoke-coding-arena.js` will otherwise be testing against a stale/wrong shape without any error, since it's a static
fixture, not a live computation.

## Contributor Checklist

1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
