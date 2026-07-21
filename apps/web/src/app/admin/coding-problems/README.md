# Add Coding Question (Admin)

## Purpose
Admin-only page for authoring coding-arena problems, replacing the old hand-edited `apps/desktop/src/coding/problems.json`
catalog (problem data now lives in Firestore - see `apps/web/src/lib/coding-catalog/README.md` for the full
generation pipeline this page drives). Linked from the sidebar as "Add Coding Question", only for accounts with
`admin: true`. Deliberately unpolished - this is a tool for a trusted single admin, not a customer-facing surface.

## What This Page Does
1. **Lists existing problems** (paginated, 10 per page) fetched from `GET /api/admin/coding-problems`. Clicking one
   loads it into the editor for edits.
2. **Three ways to submit a problem**, toggled by a tab:
   - **Paste JSON** - paste a single whole `CodingProblemSourceInput` object (see `@/lib/coding-catalog/types`)
     straight into a textarea.
   - **Field-by-field** - a form covering every field: id, title, difficulty, companies/tags, statement, input/output
     format, constraints, param spec (name + type rows), worked examples, reference solution (JS), and test cases.
     Test cases are still edited as a raw JSON array in this mode (`{ values, visible }[]`, keyed by the param spec
     names) - modeling arbitrary structured input as individual form fields wasn't worth the complexity here.
   - **Bulk Import** - paste a JSON *array* of problems (this is how the root `/coding-problems.seed.json` entries -
     the original 28 problems, re-exported from the old hardcoded catalog - get loaded back in, all at once). Each
     array entry is saved in turn via the same single-problem save endpoint, with per-entry success/failure reported
     after the run. Pasting the array into the single-object **Paste JSON** tab instead fails with "id must be
     lowercase letters..." since that tab expects one problem object, not an array.
3. **Statement images** - a small "Insert Image" / "Upload Image" control next to the statement field. Picking a
   file uploads it straight to Cloudinary (unsigned upload, same pattern as the profile-photo uploader in
   `app/profile/page.tsx`) and inserts a `[[image:<url>]]` marker either at the textarea's cursor position
   (field-by-field mode) or as a copyable snippet (paste-JSON mode, since there's no cursor to insert into). See
   `@/lib/coding-catalog/statement-images.ts` for how that marker gets parsed back into an inline image wherever a
   statement is rendered (both this page's own live preview and the public solve page use the same parser).
4. **Editing an existing problem** starts from `CodingProblemRecord.sourceJson` - the admin's last-submitted input,
   stored verbatim - rather than trying to reconstruct it from the derived/serialized fields (harness, hiddenTests,
   generated starter code), since that reconstruction would be lossy (e.g. a test case's structured `values` object
   becomes a serialized stdin string with no way back).
5. **Saving** POSTs to `GET`/`POST /api/admin/coding-problems`, which re-verifies admin status server-side
   (`requireAdmin`), builds the full judge-ready record (`buildCodingProblemRecord` - generates per-language starter
   code + hidden harness, then runs the reference solution once per test case to compute expected output), and
   writes it to Firestore.

## Integration Points
- `@/lib/firebase/user-profile` - `useIsAdmin()` for client-side gating (convenience only - the real check is
  server-side).
- `@/app/api/admin/coding-problems/route.ts` - the only API route this page talks to; admin-gated via
  `@/lib/server/require-admin` on every request.
- `@/lib/cloudinary/upload-image.ts` - the Cloudinary upload helper.
- `@/lib/coding-catalog/statement-images.ts` - the `[[image:url]]` marker builder/parser.
- `@/components/StatementWithImages.tsx` - renders the live preview.

## Files In This Folder
- `page.tsx`

## Child Folders
- No direct child folders.

## Maintenance Notes
If `CodingProblemSourceInput`'s shape changes, update three places together: the form fields in `page.tsx`, the
`buildPayloadFromForm()`/`sourceToForm()` converters in the same file, and `buildCodingProblemRecord()`'s validation
in `@/lib/coding-catalog/problem-builder.ts`. They're not derived from a single schema definition (no runtime schema
library is in use here), so keeping them in sync is a manual discipline, not something the type system enforces
end-to-end.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. Never remove the `useIsAdmin()` gate or assume the sidebar link being hidden is sufficient security.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
