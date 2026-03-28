# System Design Route

## Purpose
Container for the System Design track's solve view - a drag-and-drop architecture canvas problem, launched from
Interview War Room.

## What This Folder Owns
Routing only. All actual UI, validation-call wiring, and completion-log integration live in `[problemId]/page.tsx`.

## Integration Points
- `@/lib/system-design/catalog.server.ts` - the actual problem catalog (server-only; never sent to the client
  directly, only through the validate/solution API routes under `app/api/system-design`).
- `@/lib/interview/system-design-client.ts` - typed fetch wrappers the solve page calls.
- Linked from Interview War Room's System Design track cards.

## Files In This Folder
- No direct files.

## Child Folders
- `[problemId]`

## Maintenance Notes
Authoring a new system-design problem is significantly more involved than adding a coding problem - see
`apps/web/src/lib/system-design/README.md` for the full walkthrough (component tree structure, tradeoffs, estimation
questions, failure quiz). There is currently no admin UI for this track; problems are still authored directly in
`catalog.server.ts`.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update `lib/system-design` and
   `lib/interview/system-design-client.ts` in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
