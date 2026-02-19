# Learning API Namespace

## Purpose
Route namespace for Learning Center data APIs backed by the repository-level `learning-material` folder.

## What This Folder Owns
Read-only content APIs for:
- listing available learning tracks and subject/subtopic summaries
- fetching full detail for a selected subtopic

## Integration Points
Used by `apps/web/src/app/learning/page.tsx` to build hierarchical tile navigation and content rendering.

## Files In This Folder
- No direct files. This folder is currently a route namespace container.

## Child Folders
- `library`
- `topic`

## Maintenance Notes
Keep these routes read-only and deterministic; they should not mutate user data.

## Contributor Checklist
1. Validate query params early and return clear error payloads.
2. Keep payload size controlled for list endpoints.
3. Use server-only utility modules for filesystem access.
4. Preserve response shape stability for client compatibility.

