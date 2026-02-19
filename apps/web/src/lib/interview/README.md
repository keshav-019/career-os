# Interview Question Engine

## Purpose
Question banks, compiled test sets, role catalogs, and template assembly for Interview War Room.

## What This Folder Owns
Aptitude-CS-AI datasets, category balancing logic, test metadata, and scoring helpers.

## Integration Points
Consumed by interview-prep route, test-room flows, and analytics topic scoring.

## Files In This Folder
- `ai-role-bank.ts`
- `ai-role-questions.min.json`
- `compiled-question-sets.ts`
- `compiled-sources.md`
- `computer-science-bank.ts`
- `computer-science-tests.min.json`
- `question-bank.ts`

## Child Folders
- No direct child folders.

## Maintenance Notes
Treat compiled-minified datasets as source of truth for deterministic test generation.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
