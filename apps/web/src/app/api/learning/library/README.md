# Learning Library Route

## Purpose
Provides the Learning Center track catalog and hierarchical summaries (track -> subject -> subtopic tiles).

## What This Folder Owns
Read-only GET handler that returns:
- all supported tracks (Computer Science, AI)
- availability status per track
- subject and subtopic metadata for tile rendering

## Integration Points
Called by `apps/web/src/app/learning/page.tsx` during initial load.

## Files In This Folder
- `route.ts`

## Child Folders
- No direct child folders.

## Maintenance Notes
Keep this endpoint lightweight: list metadata only, avoid returning full large topic bodies here.

## Contributor Checklist
1. Preserve output field names used by the Learning page.
2. Handle missing learning-material folders gracefully.
3. Keep error responses explicit and parseable by client UI.
4. Avoid client-only imports in route handlers.
