# System Design Solve Page

## Purpose
The actual System Design solve experience: pan/zoom architecture canvas, component placement validation, back-of-
envelope estimation checkpoint, technology tradeoff quizzes, and a post-completion failure-mode quiz.

## What This Folder Owns
- `page.tsx` - all client state and UI for one problem attempt: placed nodes, validation calls, the stopwatch,
  estimation/tradeoff/failure-quiz flows, and pan/zoom canvas interaction.

## Integration Points
- `@/lib/interview/system-design-client.ts` - `getSystemDesignProblem`, `validateSystemDesignPlacement`,
  `checkSystemDesignEstimate`, `checkSystemDesignTradeoff`, `checkSystemDesignFailureQuiz`, `getSystemDesignSolution`.
- `@/lib/firebase/system-design-attempt-log.ts` - `logSystemDesignAttempt()` fires once, the first time `completed`
  flips true for a given attempt (every required component placed correctly). This is a log-only write (who/what/
  when) - it never stores the design itself. `useSystemDesignAttemptStats()` reads it back to show a "Completed Nx"
  indicator next to the stopwatch.
- `@/lib/firebase/client` - `auth.currentUser` gates the log call; nothing happens if the user isn't signed in
  (shouldn't normally occur since `AppShell` requires auth, but the log call fails silently either way).

## Files In This Folder
- `page.tsx`

## Child Folders
- No direct child folders.

## Maintenance Notes
`completed` is derived (`placedNodes.length >= totalNodeCount`), not a server response - the log write and the
`completedAt` stopwatch-freeze both key off the same derived value in the same effect, so they can never disagree
about when an attempt finished.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. Never add solution/design content to the attempt log - it must stay log-only (who/what/when), matching the coding
   track's `codingSubmissionLogs` convention.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
