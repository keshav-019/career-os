# Login Route

## Purpose
Authentication entry route for email/password and OAuth sign-in.

## What This Folder Owns
Sign-in/up UI, provider restrictions, 2FA challenge initiation, and post-auth routing.

## Integration Points
Uses Firebase auth + 2FA API session checks. In local development, the sign-in form can also use the env-gated learning admin credentials through `/api/learning/admin/session`.

## Files In This Folder
- `page.tsx`

## Child Folders
- No direct child folders.

## Maintenance Notes
Avoid auth dead-ends; recovery and clear error copy are critical. Keep the local admin path opt-in through `ALLOW_LEARNING_CONTENT_EDIT` and `CAREEROS_LEARNING_ADMIN_*` so Firebase remains the normal production flow.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
