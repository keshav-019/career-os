# Learning Material Library

## Purpose
Server-side parsing and normalization for file-based learning content added under the repository `learning-material` folder.

## What This Folder Owns
Material discovery, track mapping, subject-topic summarization, topic-detail resolution, and local admin edit persistence used by Learning APIs.

## Integration Points
Consumed by:
- `/api/learning/library` for top-level track and subject tiles.
- `/api/learning/topic` for full subtopic content and reference links.

## Files In This Folder
- `material-library.ts`

## Child Folders
- No direct child folders.

## Maintenance Notes
Keep this module server-only because it reads from and writes to the filesystem and parses large JSON payloads. Do not import it into client components.

## Contributor Checklist
1. Keep schema handling tolerant of optional fields because source files may evolve.
2. Preserve deterministic ID generation for tracks, subjects, and topics so deep links remain stable.
3. Current adapters support:
   - classic `subjects[]` schema,
   - AI role-phase `roles[]` schema,
   - system design `modules[]` schema grouped by `area`.
4. Add validation logic when introducing new material formats.
5. Keep edited topic saves minified and preserve deterministic IDs.
6. Re-check Learning API response shape after any schema change.
