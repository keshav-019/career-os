# Cloudinary Upload Helper

## Purpose
One shared function for the handful of places in the app that upload an image straight from the browser to
Cloudinary using an unsigned upload preset - currently the profile photo uploader (`app/profile/page.tsx`, which
predates this shared helper and still has its own inline copy) and the admin coding-problem editor's statement
image inserter (`app/admin/coding-problems/page.tsx`).

## What This Folder Owns
- `upload-image.ts` - `uploadImageToCloudinary(file)`: validates the file is an image under 5MB, POSTs a
  `FormData` (`file` + `upload_preset`) directly to `https://api.cloudinary.com/v1_1/<cloud_name>/image/upload` (no
  backend involved - this is why the upload preset must be configured "unsigned" in the Cloudinary dashboard), and
  returns the sanitized `secure_url`. Throws a human-readable `Error` on any failure (missing env config, upload
  rejected, non-image file, oversized file).

## Integration Points
- Reads `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` from the environment - both
  must be set (and the preset must exist and be unsigned in the Cloudinary dashboard) or every upload fails with a
  clear "missing configuration" error rather than a confusing network failure.
- Uses `@/lib/url-safety`'s `sanitizeExternalUrl()` to make sure whatever Cloudinary returns is actually a safe
  `http(s)` URL before handing it back to the caller.

## Files In This Folder
- `upload-image.ts`

## Child Folders
- No direct child folders.

## Maintenance Notes
This is a browser-only unsigned upload - there is no server-side validation of what gets uploaded to the configured
Cloudinary account beyond the client-side file-type/size check here. That's an accepted tradeoff for an admin-only
tool talking to a preset scoped for this purpose; do not reuse this exact pattern for a surface untrusted users can
reach without adding server-side checks.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If you add a third caller, consider migrating `app/profile/page.tsx`'s inline copy to use this helper too instead
   of letting a third near-identical copy exist.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
