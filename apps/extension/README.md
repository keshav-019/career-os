# Chrome Extension App

## Purpose

Manifest V3 extension for detecting and saving job postings into CareerOS.

## What This Folder Owns

Manifest config, popup UI, background workers, content scripts, and extension icons.

## Integration Points

Posts normalized job payloads to web app import API using extension token package auth.

## Signing In

The popup supports two ways to authenticate:

1. **Continue with Google / Continue with GitHub (preferred).** Uses `chrome.identity.launchWebAuthFlow()`
   to run the provider's real OAuth screen, then hands the resulting authorization code to
   `apps/web/src/app/api/extension/oauth/[provider]/route.ts`, which exchanges it server-side and mints
   a real Firebase session. The extension never sees or stores a client secret. This requires the site
   operator to set `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET` and/or
   `GITHUB_OAUTH_CLIENT_ID`/`GITHUB_OAUTH_CLIENT_SECRET` in `apps/web/.env.local` - see the comments
   there for exact console steps. If a provider isn't configured, its button stays disabled and the
   popup shows a "Setup help" panel with the extension's redirect URI.
2. **Paste a token package (fallback).** Copy the token package from CareerOS Settings and paste it into
   the "Advanced" section. Always available, no setup required.

The extension's OAuth redirect URI is fixed at `https://hcddedljkhdhmcklmdbadnpjcadhmoac.chromiumapp.org/`
because `manifest.json` pins a `"key"` field, which makes Chrome derive the same extension ID regardless
of the machine or path it's loaded from. Do not remove or change that `key` - doing so changes the
extension ID and breaks the registered OAuth redirect URIs.

## Files In This Folder

- `manifest.json`
- `package.json`

## Child Folders

- `icons`
- `src`

## Maintenance Notes

Keep host permission scope minimal and parser behavior deterministic per supported site.

## Contributor Checklist

1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
