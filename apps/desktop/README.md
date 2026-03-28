# Desktop Companion App

## Purpose
Electron desktop companion for local-machine features: resume compile (LaTeX) and the local coding-arena judge
(C, C++, Java, JavaScript, Python, Rust).

## What This Folder Owns
Electron main process boot, local helper API, and packaging config.

## Coding Arena
The desktop app runs a local multi-language judge (`src/coding/`) exposed via the same helper server as the LaTeX
compiler. It detects toolchains already installed on the user's machine (GCC/G++, a JDK or JRE 11+, Python 3, and
optionally Rust) rather than bundling them - see `src/coding/README.md`. Run `npm run smoke:coding` to sanity-check the
whole pipeline end to end.

## Integration Points
Web app can call local helper endpoint for desktop-only operations.

## Files In This Folder
- `package.json`

## Child Folders
- `src`
- `scripts` - build/prepare/smoke-test scripts run outside the packaged app (LaTeX/AI runtime prep, the coding-arena
  smoke test, and the historical coding-problem source data - see that folder's README).

## Maintenance Notes
Keep local server locked to localhost and document any required native dependencies.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
