# Shared UI Components

## Purpose
Reusable presentation and shell components shared across multiple routes.

## What This Folder Owns
Navigation shell, metric cards, status badges, resume preview helpers, and avatar utilities.

## Integration Points
Imported by route pages to avoid duplicated layout and UI primitives.

## Files In This Folder
- `AppShell.tsx`
- `CompanyAvatar.tsx`
- `MetricCard.tsx`
- `ResumeStudioDesktopOnlyCard.tsx`
- `ResumeTemplatePreview.tsx`
- `StatusBadge.tsx`

## Child Folders
- No direct child folders.

## Maintenance Notes
Prefer pure, prop-driven components; keep route-specific side effects out of shared components. `AppShell` also honors the local admin session stored by the login page so env-only learning edits can be checked without creating a Firebase user.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
