# Learning Topic Route

## Purpose
Returns full readable content for one selected subtopic.

## What This Folder Owns
Read-only GET handler keyed by:
- `track`
- `subjectId`
- `topicId`

Response includes topic notes, objectives, drills, study plan, and resolved reference-link groups.

## Integration Points
Called on demand by `apps/web/src/app/learning/page.tsx` when a subtopic tile is selected.

## Files In This Folder
- `route.ts`

## Child Folders
- No direct child folders.

## Maintenance Notes
Keep this endpoint strict on parameter validation and return precise status codes (`400`, `404`, `500`) for robust UI handling.

## Contributor Checklist
1. Validate and sanitize query params before lookup.
2. Preserve deterministic topic resolution IDs.
3. Keep link metadata complete (`title`, `url`, optional context fields).
4. Avoid returning unrelated large payloads.
