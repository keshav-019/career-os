# Learning Topic Route

## Purpose
Returns full readable content for one selected subtopic and accepts local admin edits for that topic.

## What This Folder Owns
GET handler keyed by:
- `track`
- `subjectId`
- `topicId`

Response includes topic reading text, figures, page hints, focus keywords, and resolved reference-link groups. PATCH updates `readingParagraphs` and optional figure metadata in the source minified JSON only when the request carries the signed local admin session cookie created by `/login`.

## Integration Points
Called on demand by `apps/web/src/app/learning/page.tsx` when a subtopic tile is selected.

## Files In This Folder
- `route.ts`

## Child Folders
- No direct child folders.

## Maintenance Notes
Keep this endpoint strict on parameter validation and return precise status codes (`400`, `401`, `404`, `500`) for robust UI handling. Editing must remain gated by the signed local admin session cookie plus `ALLOW_LEARNING_CONTENT_EDIT` and `CAREEROS_LEARNING_ADMIN_*` environment variables.

## Contributor Checklist
1. Validate and sanitize query params before lookup.
2. Preserve deterministic topic resolution IDs.
3. Keep link metadata complete (`title`, `url`, optional context fields).
4. Avoid returning unrelated large payloads.
