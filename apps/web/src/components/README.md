# Shared UI Components

## Purpose
Reusable presentation and shell components shared across multiple routes.

## What This Folder Owns
Navigation shell, metric cards, status badges, resume preview/editor helpers, avatar utilities, the coding/system
design problem browsers, the code editor, and a statement renderer that supports embedded images.

## Integration Points
Imported by route pages to avoid duplicated layout and UI primitives.

## Files In This Folder
- `AppShell.tsx` - the sidebar/nav shell, theme-aware brand logo, and `buildNavSections()` (including the
  admin-only "Add Coding Question" and "Add System Design Question" links).
- `CodeArenaEditor.tsx` - the CodeMirror-based code editor used on the coding-room solve page.
- `CodingArenaBrowser.tsx` - the paginated coding-problem list/paper picker on the Coding track's landing page.
- `CompanyAvatar.tsx`
- `Editor.tsx` / `Preview.tsx` / `Toolbar.tsx` - the resume LaTeX Studio's editor pane, live preview, and toolbar.
- `MetricCard.tsx`
- `ResumeLatexStudio.tsx` - the LaTeX-mode resume studio shell (as opposed to Visual Mode, which lives under
  `resume/`).
- `ResumeStudioDesktopOnlyCard.tsx`
- `ResumeTemplatePreview.tsx`
- `StatementWithImages.tsx` - renders a coding-problem `statement` string, turning `[[image:<url>]]` markers (see
  `@/lib/coding-catalog/statement-images.ts`) into inline images. Used by both the public coding-room solve page and
  the admin editor's live preview.
- `StatusBadge.tsx`
- `SystemDesignBrowser.tsx` - the paginated System Design problem list with track filtering.

## Child Folders
- `resume` - Visual Mode resume builder (template gallery, form, and per-template renderers) - the non-LaTeX
  counterpart to `ResumeLatexStudio.tsx` above.

## Maintenance Notes
Prefer pure, prop-driven components; keep route-specific side effects out of shared components. `AppShell` also honors the local admin session stored by the login page so env-only learning edits can be checked without creating a Firebase user.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
