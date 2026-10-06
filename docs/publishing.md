# Publishing

Every app ships from the default branch (`first-phase`) when its **version
changes**. Stores reject a version they already have, so the rule is simply:
bump the version in the same commit as the change you want to ship.

| App | Bump this | Workflow | Goes to |
|---|---|---|---|
| Browser extension | `apps/extension/manifest.json` → `version` | [publish-extension.yml](../.github/workflows/publish-extension.yml) | Chrome Web Store (uploaded and submitted for review); Firefox Add-ons if configured |
| Desktop app | `apps/desktop/package.json` → `version` | [release-desktop.yml](../.github/workflows/release-desktop.yml) | GitHub Release `v<version>` with Windows, Linux and macOS (Apple Silicon + Intel) builds |
| Android app | `apps/mobile/app.json` → `expo.version` | [publish-android.yml](../.github/workflows/publish-android.yml) | EAS build, then Google Play (track set in `apps/mobile/eas.json`) |
| Web + API | nothing | Vercel's Git integration | Production on every push |

Each publishing job checks for its credentials first. Until they are set it
skips with a notice instead of failing, so each channel can be switched on
independently. Every workflow can also be started by hand from the Actions
tab (Run workflow), which skips the version check. [CI](../.github/workflows/ci.yml)
runs the typecheck and the desktop smoke tests (macOS and Linux) on every pull
request.

Secrets go in **Settings → Secrets and variables → Actions** (or in the
GitHub environment named below, to restrict them to that job).

## Chrome Web Store

1. Google Cloud Console (any project): enable **Chrome Web Store API**, then
   create a service account and download a JSON key for it.
2. [Developer Dashboard](https://chrome.google.com/webstore/devconsole/) →
   **Account**: add the service account's email. → **Publisher → Settings**:
   copy the publisher ID.
3. Add the secrets (environment `chrome-web-store`):
   - `CWS_SERVICE_ACCOUNT_JSON`: the whole JSON key file
   - `CWS_PUBLISHER_ID`: the publisher ID

The item ID defaults to the live listing (`llendblljmalpjakenfmllaajhblkcim`);
override it with the repository variable `CWS_EXTENSION_ID`. The workflow
uses the [Chrome Web Store API v2](https://developer.chrome.com/docs/webstore/using-api):
upload, wait for processing, then `:publish`, which submits the new version
for review. Google publishes it automatically once review passes.

## Firefox Add-ons (optional)

1. [addons.mozilla.org API keys](https://addons.mozilla.org/developers/addon/api/key/):
   generate a JWT issuer and secret.
2. Secrets (environment `firefox-add-ons`): `AMO_JWT_ISSUER`, `AMO_JWT_SECRET`.
3. Repository variable `AMO_CHANNEL`: `listed` (public on AMO, default) or
   `unlisted` (Mozilla signs it, you host the `.xpi`).

## Desktop (GitHub Releases)

Works with no setup: the version bump builds all platforms and creates the
release. Signing is optional per platform.

**macOS signing and notarization.** Without it, macOS shows "Apple could not
verify CareerOS" on first launch; users open it once from **System Settings →
Privacy & Security → Open Anyway**. To remove that prompt:

1. Join the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).
2. Create a **Developer ID Application** certificate, export it with its
   private key as `.p12`, and base64-encode it: `base64 -i cert.p12 | pbcopy`.
3. Create an [app-specific password](https://account.apple.com) for your Apple ID.
4. Secrets: `MAC_CERTIFICATE_P12_BASE64`, `MAC_CERTIFICATE_PASSWORD`,
   `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.

With all five set, electron-builder signs with the Developer ID and notarizes
each build. The release job also checks every macOS bundle's signature and
that it contains the LaTeX engine for its architecture.

## Android (Google Play)

Google requires a few one-time manual steps before automation can take over:

1. [Expo](https://expo.dev) account. In `apps/mobile`, run `npx eas-cli init`
   (links the project and adds `extra.eas.projectId` to `app.json`; commit it).
2. Set the app's public config as EAS environment variables for the
   `production` environment (`npx eas-cli env:create`): every
   `EXPO_PUBLIC_*` value from the repo-root `.env.local`.
3. [Google Play Console](https://play.google.com/console) ($25 one-time):
   create the app with package `com.careeros.mobile`, complete the store
   listing, and **upload the first build by hand**
   (`npx eas-cli build -p android --profile production`, then upload the
   `.aab`). Play's API cannot create the first release.
4. Create a Google Cloud service account, grant it access in Play Console
   (**Users and permissions**), and upload its JSON key to EAS
   (`npx eas-cli credentials` → Android → Google Service Account).
5. Create an [Expo access token](https://expo.dev/settings/access-tokens) and
   add it as the secret `EXPO_TOKEN` (environment `google-play`).

`eas.json` submits to the **internal** testing track, available to your
testers immediately. To have releases reviewed and published publicly, set
`track` to `production`. New personal Play accounts must first run a closed
test (12 testers, 14 days) before production access is granted.

## Adding another channel

Follow the same shape: a workflow triggered on `first-phase` for the app's
paths, a job that compares the version with the previous commit, and a
publish job that checks its secrets and skips with a notice when they are
missing. Candidates already packaged in this repo: `winget/`, `choco/` and
`flathub/` for the desktop release.
