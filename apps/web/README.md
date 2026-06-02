# CareerOS Web App

## Purpose
Next.js application that powers the main CareerOS product experience.

## What This Folder Owns
Authentication, profile and settings, application pipeline, interview prep/testing flows, analytics, calendar, and resume entry points.

## Integration Points
Uses Firebase client + Firestore hooks, server route handlers, and @careeros/shared domain types.

## Files In This Folder
- `.env.local`
- `.env.local.example`
- `eslint.config.mjs`
- `next-env.d.ts`
- `next.config.ts`
- `package.json`
- `tsconfig.json`
- `tsconfig.tsbuildinfo`

## Child Folders
- `public`
- `scripts`
- `src`

## Maintenance Notes
Preserve App Router conventions and keep UI logic in src/app + src/components while reusable domain code stays in src/lib.
For production, configure `CAREEROS_ALLOWED_ORIGINS` and `CAREEROS_ALLOWED_EXTENSION_IDS` so `/api/jobs/import` accepts only trusted web origins and extension ids.
Profile photo uploads use Cloudinary from the browser and require `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
