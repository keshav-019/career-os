# Coding Room Route

## Purpose
Desktop-only LeetCode-style solve view for a single coding-arena problem.

## What This Folder Owns
Split-pane problem statement + CodeMirror editor, language switcher, Run/Submit actions, custom test cases, and the
run/submit results panel. All actual code execution happens through the CareerOS Desktop local helper server - this
route has no server-side execution of its own and does nothing useful when opened on plain web (Vercel), since there
is no helper server to talk to there.

## Integration Points
- `@/lib/interview/coding-arena-client` - typed fetch wrapper around the desktop helper's `/code/*` endpoints.
- `@/components/CodeArenaEditor` - CodeMirror wrapper with per-language syntax highlighting.
- Linked from `CodingArenaBrowser` (rendered inside `/interview-prep` when `isDesktopAppEnabled()`).
- `@/lib/firebase/coding-submission-log.ts` - `logCodingSubmission()` fires once per accepted submission
  (`result.accepted === true`). Log-only (who/what/when) - never the submitted source. `useCodingSubmissionStats()`
  reads it back to show a "Submitted Nx" indicator in the action bar.

## Files In This Folder
- `[problemId]/page.tsx`

## Child Folders
- `[problemId]`

## Maintenance Notes
Hidden test cases must never be fetched by this route - the desktop helper's `/code/problems/:id` response
intentionally omits them, and `/code/submit` only returns pass/fail plus the first failing case for debugging.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update `apps/desktop/src/coding` in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
