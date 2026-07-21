# Extension Source

## Purpose

Core extension runtime logic and UI assets.

## What This Folder Owns

Content parser-injector, background coordination, popup auth UX (Google/GitHub OAuth + token
paste fallback), and style system.

## Integration Points

Interacts with job portals in content context and CareerOS API over network requests.

`background.js` owns the OAuth flow: `CAREEROS_GET_OAUTH_CONFIG` asks the web app which providers
are configured (`GET /api/extension/oauth-config`), and `CAREEROS_OAUTH_START` runs
`chrome.identity.launchWebAuthFlow()` against the provider's authorize URL, then posts the resulting
code to `POST /api/extension/oauth/[provider]` to trade it for a Firebase session. `popup.js` only
talks to `background.js` via `chrome.runtime.sendMessage` - it never calls the provider or the
CareerOS API directly.

## Files In This Folder

- `background.js`
- `contentScript.js`
- `popup.css`
- `popup.html`
- `popup.js`

## Child Folders

- No direct child folders.

## Maintenance Notes

Keep parser extraction robust against site layout drift and isolate selectors per site.

## Contributor Checklist

1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. If contracts change (types, payloads, route behavior), update dependent folders in the same PR.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
4. Run lint/typecheck for affected workspaces after edits and capture known gaps in PR notes.
