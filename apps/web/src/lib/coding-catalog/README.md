# Coding Catalog (Problem Authoring & Storage)

## Purpose
Turns admin-submitted problem definitions into fully judge-ready records, and stores/reads them in Firestore. This
is the replacement for the old hand-edited `apps/desktop/src/coding/problems.json` catalog - see
`apps/desktop/src/coding/README.md` for the judge engine this feeds (still local/desktop-only; only the problem
*data* moved to the cloud, not the actual compiling/running).

## What This Folder Owns
- `types.ts` - `CodingProblemSourceInput` (what an admin submits, matching
  `apps/desktop/scripts/coding-catalog/problems-source.js` entry shape so the root `/coding-problems.seed.json` can
  be pasted straight into the admin editor), `CodingProblemRecord` (the fully-baked Firestore document), and the two
  narrower public shapes (`CodingProblemPublicSummary`/`Detail`) plus `CodingProblemJudgeData` (harness + hidden
  tests - never sent to a browser).
- `starter-templates.js` / `serialize.js` - copied unchanged from `apps/desktop/scripts/coding-catalog/`. Pure
  string-generation logic (no browser/Electron dependency), so they're required as-is via CommonJS `require()` from
  `problem-builder.ts` rather than reimplemented in TypeScript. **Do not hand-edit these** - if the generator needs
  to change, change it in the desktop copy too (or better: make one the source of truth and the other a copy step).
- `problem-builder.ts` - `buildCodingProblemRecord(input, context)`: generates the per-language starter
  code + hidden harness from `paramSpec`/`outputKind`, then runs the admin's `referenceBody` JS solution (in a
  short-lived separate Node process, 10s timeout) against every test case to compute ground-truth expected output.
  Node-only - never import this from a `"use client"` file. Also stamps the record's `sourceJson` field with the
  admin's input, JSON-stringified verbatim - this is what lets the admin editor reload a problem for editing without
  reconstructing it from the (lossy, one-way) derived fields.
- `firestore.ts` - Admin SDK reads/writes against the `codingProblems` Firestore collection.
- `public-shapes.ts` - strips a full `CodingProblemRecord` down to what's safe to return from each API route.
  `sourceJson` never appears in any of the three public/judge shapes - it's admin-only.
- `statement-images.ts` - the `[[image:<url>]]` marker convention that lets a problem `statement` embed images
  anywhere in the text (a statement can have any number of them, at arbitrary positions - unlike the Learning
  Center's separate `[[figure:id]]` + companion-array convention, this one carries the full Cloudinary URL directly
  in the marker, since the admin editor inserts it the instant an upload finishes and there's nothing else to look
  up). `splitStatementIntoSegments()` is the shared parser both the admin editor's live preview and the public
  solve page's `<StatementWithImages>` component (`apps/web/src/components/StatementWithImages.tsx`) use to turn a
  raw statement string into text/image segments.

## Integration Points
- `app/api/admin/coding-problems/route.ts` - admin-gated create/update, calls `buildCodingProblemRecord` then
  `saveCodingProblemRecord`. `GET` returns full `CodingProblemRecord`s (including `sourceJson`) - only ever called
  by `app/admin/coding-problems/page.tsx`, never by any other client.
- `app/api/coding-problems/route.ts` and `app/api/coding-problems/[problemId]/route.ts` - signed-in-gated public
  list/detail, using `toPublicSummary`/`toPublicDetail`.
- `app/api/coding-problems/[problemId]/judge-data/route.ts` - signed-in-gated, returns `toJudgeData()`. Called only
  by the desktop app's local helper server (`apps/desktop/src/coding/index.js`), which forwards the signed-in user's
  Firebase id token when fetching this - never called directly from the browser bundle.
- `app/admin/coding-problems/page.tsx` - the actual admin editor UI (paste JSON, or field-by-field with a Cloudinary
  image inserter for the statement). See that folder's README.md for how it works and for the two ways to submit a
  problem.
- `/coding-problems.seed.json` (repo root) - the original 28 problems, re-exported from
  `apps/desktop/scripts/coding-catalog/problems-source.js` into this exact `CodingProblemSourceInput[]` shape.
  Paste any single array entry into the admin editor's "Paste JSON" box to recreate one of the original problems now
  that they're no longer hardcoded anywhere in the running app.
- `apps/web/src/lib/cloudinary/upload-image.ts` - the unsigned browser-to-Cloudinary upload helper the admin editor
  uses for statement images (same pattern as the profile-photo uploader in `app/profile/page.tsx`).

## Files In This Folder
- `firestore.ts`
- `problem-builder.ts`
- `public-shapes.ts`
- `serialize.js`
- `starter-templates.js`
- `statement-images.ts`
- `types.ts`

## Child Folders
- No direct child folders.

## Maintenance Notes
`buildCodingProblemRecord` throws plain `Error`s with human-readable messages - API routes should surface
`error.message` directly to the admin, not wrap it in something generic, since these messages are the admin's only
feedback on why a problem definition didn't validate.

The reference-solution execution trust boundary is identical to the desktop build script it replaces: only a trusted
admin (gated by `users/{uid}.admin`) can trigger it, and it always runs in a short-lived separate process, never
in-process `eval`.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If `starter-templates.js`/`serialize.js` need a fix, consider whether the desktop copy needs the same fix.
3. Never add a way for `CodingProblemJudgeData` (harness/hiddenTests) to reach a public/summary/detail response.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
