# Firebase Access Layer

## Purpose
Client-admin initialization and typed collection access helpers for Firestore/Auth.

## What This Folder Owns
Session-aware hooks for jobs, reminders, resumes, interview attempts, the `admin` account flag, and core collection
constants.

## Integration Points
Primary persistence boundary for most web routes.

## Files In This Folder
- `admin.ts` - Firebase Admin SDK bootstrap (server-only; despite the name, unrelated to the `admin` user flag).
- `client.ts`
- `coding-submission-log.ts` - append-only log of successful coding-arena submissions (`codingSubmissionLogs`
  collection). No solution content is stored, only who/what/when.
- `collections.ts`
- `interview-war-room.ts`
- `jobs.ts`
- `reminders.ts`
- `resumes.ts`
- `system-design-attempt-log.ts` - same idea as `coding-submission-log.ts` but for completed system-design attempts
  (`systemDesignAttemptLogs` collection).
- `user-profile.ts` - `useIsAdmin()` client hook reading `users/{uid}.admin`. UI gating only - API routes must
  independently verify via `lib/server/require-admin.ts`.

## Child Folders
- No direct child folders.

## Maintenance Notes
Normalize data at ingress-egress to keep route components resilient to schema drift.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
