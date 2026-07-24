# Browser Extension App

## Purpose

Manifest V3 browser extension for detecting and saving job postings into CareerOS.

## What This Folder Owns

Manifest config, popup UI, background workers, content scripts, and extension icons.

## Integration Points

Posts normalized job payloads to web app import API using extension OAuth, email/password, or token package auth.

## Signing In

The popup supports three ways to authenticate:

1. **Continue with Google / Continue with GitHub (preferred).** Uses `chrome.identity.launchWebAuthFlow()`
   to run the provider's real OAuth screen, then hands the resulting authorization code to
   `apps/web/src/app/api/extension/oauth/[provider]/route.ts`, which exchanges it server-side and mints
   a real Firebase session. The extension never sees or stores a client secret. This requires the site
   operator to set `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET` and/or
   `GITHUB_OAUTH_CLIENT_ID`/`GITHUB_OAUTH_CLIENT_SECRET` in `apps/web/.env.local` - see the comments
   there for exact console steps. If a provider isn't configured, its button stays disabled and the
   popup shows a "Setup help" panel with the extension's redirect URI.
2. **Email/password.** Uses Firebase's REST password sign-in endpoint with the deployment's public
   Firebase web API key. If the account has CareerOS authenticator 2FA enabled, the popup asks for the
   6-digit authenticator code before it stores the extension session.
3. **Paste a token package (fallback).** Copy the token package from CareerOS Settings and paste it into
   the "Advanced" section. Always available, no setup required.

`manifest.json` keeps a `"key"` field for local unpacked Chrome development so Chrome derives a stable dev
extension ID. Chrome Web Store does not allow that field, so `/api/extension/download?browser=chrome`
strips it from the packaged zip automatically. The Firefox package also strips this Chrome-only key and injects
Firefox's `browser_specific_settings.gecko.id` plus a Firefox-compatible background script declaration.

## Packaging

The web app exposes download buttons on `/integrations`:

- Chrome: `/api/extension/download?browser=chrome` -> `careeros-capture-chrome.zip`
- Firefox: `/api/extension/download?browser=firefox` -> `careeros-capture-firefox.xpi`

Local packaging commands write ignored upload artifacts to `dist/extensions/`:

```bash
npm run extension:package:chrome
npm run extension:package:firefox
npm run extension:package
```

Use `dist/extensions/careeros-capture-firefox.xpi` for Firefox testing/signing. For normal Firefox installs,
the XPI must be signed by Mozilla. If CareerOS self-hosts the download instead of listing it publicly on AMO,
submit it to AMO as an unlisted add-on and host the signed XPI returned by Mozilla.

## Firefox Workflow

1. Run `npm run extension:package:firefox`.
2. For temporary local testing, open Firefox, go to `about:debugging#/runtime/this-firefox`, choose
   "Load Temporary Add-on", and select `apps/extension/manifest.json` or the generated XPI. Temporary add-ons
   are removed when Firefox restarts.
3. Open the extension popup and copy the redirect URI shown in Setup help. Firefox may use a loopback redirect
   such as `http://127.0.0.1/mozoauth2/<extension-subdomain>` for OAuth compatibility.
4. Add that Firefox redirect URI to your Google OAuth client. For GitHub OAuth, create a separate OAuth app if
   you need both Chrome and Firefox because GitHub OAuth apps allow one callback URL.
5. Upload `dist/extensions/careeros-capture-firefox.xpi` to Mozilla Add-ons. Choose listed if it should appear
   publicly on AMO, or unlisted if CareerOS will provide the download itself.
6. After Mozilla signs it, replace the self-generated XPI with Mozilla's signed XPI for production download.

For local unpacked development, the OAuth redirect URI is:

- `https://hcddedljkhdhmcklmdbadnpjcadhmoac.chromiumapp.org/`

For Chrome Web Store, create/upload the listing first, copy the Store-assigned extension ID, then use:

- `https://<chrome-web-store-extension-id>.chromiumapp.org/`

For Firebase Authentication, keep these domains authorized:

- `localhost`
- `127.0.0.1`
- `hcddedljkhdhmcklmdbadnpjcadhmoac.chromiumapp.org`
- `<chrome-web-store-extension-id>.chromiumapp.org`
- your Vercel production domain, for example `career-os.vercel.app`
- any custom production domain, for example `careeros.app`

For Google OAuth, add the relevant authorized redirect URI to the Google Cloud OAuth client:

- local/dev: `https://hcddedljkhdhmcklmdbadnpjcadhmoac.chromiumapp.org/`
- Chrome Web Store: `https://<chrome-web-store-extension-id>.chromiumapp.org/`

For GitHub OAuth, set the callback URL to that same redirect URI. GitHub OAuth apps only support one
callback URL, so use the Store URI for production. Create a second GitHub OAuth app if you also need local
unpacked GitHub sign-in.

For production job imports, set `CAREEROS_ALLOWED_EXTENSION_IDS=<chrome-web-store-extension-id>` on the
web deployment so `/api/jobs/import` accepts requests from the published extension.

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
