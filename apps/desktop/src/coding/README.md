# Coding Arena (Local Judge)

## Purpose
Local, desktop-only multi-language judge that powers the Interview War Room "Coding" track: problems are authored
and stored in the cloud (Firestore, via the web app's admin tool), but every submission is still compiled and
executed entirely on the user's machine.

## What This Folder Owns
- `runtime.js`: detects installed toolchains (gcc/g++, a JDK or JRE 11+, python3/python, optional rustc) and
  compiles/runs a fully-composed source against a set of test cases with a timeout and output cap. Falls back to
  `java Main.java` single-file source-launch mode (JDK 11+) when only a JRE is available. Process crashes (SIGSEGV,
  SIGFPE, SIGABRT, SIGILL, SIGBUS, SIGKILL) with no stderr output of their own are turned into a clear,
  signal-specific explanation instead of surfacing as an empty, unexplained failure.
- `index.js`: glue layer (`createCodingArena`) consumed by `../helper-server.js`.
  - `fetchJudgeData(problemId, idToken)` fetches harness + hidden tests **live, per request** from the web app's own
    `GET /api/coding-problems/:id/judge-data` route, authenticated with the signed-in user's Firebase id token
    (forwarded from the renderer through the helper server on every run/submit call). There is no local cache and no
    bundled catalog - this app needs the web app runtime reachable to open or judge a problem, same as it already
    needs Firebase Auth reachable to sign in at all.
  - `composeFullSource(judgeData, language, userFunctionBlock)` stitches the hidden `harness.prefix` + the user's
    edited function + `harness.suffix` into the real program right before compiling/running it - this is the only
    place the two halves are ever joined.
  - `run()`/`submit()` never return `harness`/hidden test data in their responses - `/code/submit` only ever returns
    pass/fail plus the first failing test's input/expected/actual, never the full hidden test bank.

## Problem authoring
Problems are no longer hand-edited here. An admin (an account with `admin: true` on their `users/{uid}` Firestore
document) adds/edits problems from the web app's `/admin/coding-problems` page - paste JSON or fill in fields one by
one. See `apps/web/src/lib/coding-catalog/README.md` for the generation pipeline (per-language harness generation
from `paramSpec`/`outputKind`, and reference-solution execution to compute hidden-test expected output), and the
root `/coding-problems.seed.json` for the original 28-problem catalog re-exported as pasteable admin input.

`apps/desktop/scripts/coding-catalog/` (the old build-time generator) is kept only as the historical source those
seed problems were extracted from - it is no longer part of the running app.

## Known limitations
- Compilers/interpreters are detected, not bundled (unlike the portable LaTeX/Tectonic runtime) - six full toolchains
  across two OSes was out of scope to vendor. `runtime.js` reports clear install guidance per language when one is
  missing.
- Opening or judging a problem now requires the bundled web app runtime to be reachable (it always has for
  everything else in this app, since Firebase Auth sign-in is already mandatory) - there is intentionally no offline
  fallback for problem data.
- Rust support was implemented and code-reviewed against the same patterns already validated for the other five
  languages, but could not be executed in the environment this was built in (no `rustc` available). Worth a manual
  smoke test the first time this ships.
- In C, C++, and Rust, users can only add helper functions as nested closures/lambdas inside `solve()` (no separate
  class/struct scope like LeetCode's C++/Java tracks provide) since the harness only exposes one insertion point.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update `../helper-server.js`,
   `apps/web/src/lib/interview/coding-arena-client.ts`, and `apps/web/src/lib/coding-catalog` in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Never let `run()`/`submit()` return `harness` or the raw hidden test bank in their responses.
