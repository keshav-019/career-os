# Add System Design Question (Admin)

## Purpose
Admin-only page for authoring system-design catalog problems. Problem data now lives in Firestore's
`systemDesignProblems` collection (see `apps/web/src/lib/system-design/firestore.ts`) instead of the
old hardcoded `PROBLEMS` array in `apps/web/src/lib/system-design/catalog.server.ts`. Linked from the
sidebar as "Add System Design Question", only for accounts with `admin: true` (or the local-dev
`non_admin: true` escape hatch - see `apps/web/src/lib/server/require-admin.ts`).

## What This Page Does
1. **Lists existing problems** (paginated, 10 per page) fetched from `GET /api/admin/system-design-problems`.
   Clicking one loads it into the editor for edits.
2. **Add / Edit One** - paste a whole `CatalogProblem` object (see
   `@/lib/system-design/catalog.server`) into a textarea. Unlike the coding-problems admin page, there
   is no field-by-field mode - the tree schema (node -> parent links, node-tied tradeoffs,
   tolerance-graded estimation, quiz answer keys) is too interconnected to safely decompose into
   individual form fields. See `apps/web/src/lib/system-design/README.md`'s "Adding a new problem"
   section for the full authoring rules a pasted problem must follow.
3. **Bulk Import** - paste a JSON *array* of problems (e.g. the entire root
   `system-design-problems.seed.json`, the one-time export of the 26 problems that used to be
   hardcoded) and it saves each entry in turn via the same single-problem save endpoint, reporting
   per-entry success/failure.
4. **Editing an existing problem** starts from `SystemDesignProblemRecord.sourceJson` - the admin's
   last-submitted input, stored verbatim - same reasoning as the coding-problems editor.
5. **Saving** POSTs to `GET`/`POST /api/admin/system-design-problems`, which re-verifies admin status
   server-side (`requireAdmin`), validates the tree (`buildSystemDesignProblemRecord` - checks every
   node id is known/unique, every `parentId` resolves, the tradeoff's `nodeId` exists in the tree,
   exactly one correct tradeoff option, every failure-quiz `correctOptionId` matches one of its own
   options), and writes it to Firestore.

## Integration Points
- `@/lib/firebase/user-profile` - `useIsAdmin()` for client-side gating (convenience only - the real
  check is server-side).
- `@/app/api/admin/system-design-problems/route.ts` - the only API route this page talks to;
  admin-gated via `@/lib/server/require-admin` on every request.
- `@/lib/system-design/problem-builder.ts` - `buildSystemDesignProblemRecord()`, the validation this
  page's save action depends on.

## Files In This Folder
- `page.tsx`

## Child Folders
- No direct child folders.

## Maintenance Notes
If `CatalogProblem`'s shape changes, update `buildSystemDesignProblemRecord()`'s validation in
`@/lib/system-design/problem-builder.ts` to match - there's no runtime schema library in use, so
keeping them in sync is a manual discipline, not something the type system enforces end-to-end.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. Never remove the `useIsAdmin()` gate or assume the sidebar link being hidden is sufficient security.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
