# CareerOS Mobile Backend

## Purpose

A standalone Express server that implements every API route the Android app (`apps/mobile`) actually calls:
Interview War Room (aptitude/computer-science/AI test templates, MCQ review), System Design, and AI Match/Resume
generation. It imports the exact same business logic from `apps/web/src/lib/**` directly (via a `@/*` path alias
pointing at `../web/src`) - nothing here is copy-pasted, so there is only one copy of the actual logic to keep in
sync.

## Why this exists instead of just using the web app's API routes

The web app (`apps/web`) is deployed to Vercel, where every route that touches the Firebase Admin SDK
(`lib/firebase/admin.ts`) currently crashes with a generic 500 in Vercel's serverless runtime, even though the
exact same code works fine locally (`next dev` and `next start`). This affects System Design, the interview
templates API, and the admin content tools. Since Vercel's serverless bundling of `firebase-admin` is the
suspected cause and that's outside what a `next.config.ts` tweak alone could fully resolve, the mobile app instead
talks to this backend - a plain long-running Node process (a Docker container, or any Node host), which sidesteps serverless
bundling entirely.

Routes that don't need Firebase Admin (`/api/interview/ai-roles`, `/api/learning/library`, `/api/learning/topic`)
already work fine on the Vercel deployment and are NOT duplicated here - mobile keeps calling those from the
existing `API_BASE_URL`. Only what's listed below lives here.

## Routes

- `GET /api/interview/templates?testType=&roleId=&limit=`
- `GET /api/interview/templates/:templateId?testType=`
- `GET /api/interview/ai-roles`
- `POST /api/interview/mcq-review`
- `GET /api/system-design/problems`
- `GET /api/system-design/problems/:id`
- `POST /api/system-design/problems/:id/validate`
- `GET /api/system-design/problems/:id/solution`
- `POST /api/system-design/problems/:id/estimate`
- `POST /api/system-design/problems/:id/tradeoff`
- `POST /api/system-design/problems/:id/failure-quiz`
- `POST /api/ai/job-match`
- `POST /api/ai/resume-review`
- `POST /api/ai/generate-resume`
- `POST /api/ai/learning-plan`

All routes expect the same `Authorization: Bearer <firebase-id-token>` header apps/mobile's `apiClient.ts` already
sends, and return the same JSON response shapes as their `apps/web/src/app/api/**` counterparts - this is a drop-in
replacement, not a new contract. See each `apps/web/src/app/api/**/route.ts` file for the response shape if needed.

## Running locally

```powershell
npm install
npm run dev --workspace @careeros/mobile-backend
```

Copy the repo-root `.env.local.example` to `.env.local` at the repo root and fill in the Firebase Admin service
account fields at minimum. OpenRouter keys are only needed to exercise `/api/ai/*`.

## Deploying (Docker on vanisher.projectyourown.com)

The backend ships as a Docker image built from [`Dockerfile`](Dockerfile) (build context: the repo root, since it
bundles `apps/web/src` and `packages/shared` with esbuild). [`deploy/compose.yml`](deploy/compose.yml) runs it behind
Caddy, which obtains and renews the HTTPS certificate on its own.

```bash
docker build -f apps/mobile-backend/Dockerfile -t careeros-mobile-backend .
docker run --rm -p 8080:8080 --env-file .env.local careeros-mobile-backend
```

**Continuous deployment.** [`.github/workflows/deploy-backend.yml`](../../.github/workflows/deploy-backend.yml) runs on
every push to `first-phase` that touches this app, `apps/web/src/lib`, `packages/shared` or the lockfile: it pushes
`ghcr.io/keshav-019/careeros-mobile-backend:{sha,latest}`, copies `deploy/` to the server, restarts the stack and
checks `https://vanisher.projectyourown.com/`. CI builds and smoke-tests the same image on every pull request.

**One-time server setup.**

1. Create `/data/home/careeros-backend/.env` on the server with the server-side keys from `.env.local.example`
   (Firebase Admin, OpenRouter, R2, `CAREEROS_ALLOWED_ORIGINS`). Keep `FIREBASE_PRIVATE_KEY` on one line with its
   literal `\n` sequences; the app un-escapes them. The workflow never writes this file.
2. Create a deploy key and authorize it on the server:
   `ssh-keygen -t ed25519 -N "" -C careeros-deploy -f deploy_key`, then append `deploy_key.pub` to
   `~/.ssh/authorized_keys` on the server.
3. In GitHub, Settings -> Environments -> `vanisher`, add the secrets `VANISHER_SSH_KEY` (contents of `deploy_key`)
   and `VANISHER_KNOWN_HOSTS` (output of `ssh-keyscan vanisher.projectyourown.com`). Optional variables:
   `CAREEROS_BACKEND_DOMAIN`, `VANISHER_SSH_HOST`, `VANISHER_SSH_USER`, `VANISHER_DEPLOY_DIR`.

Ports 80 and 443 must be open to the internet (Caddy's certificate challenge uses them). To serve another hostname as
well, point its DNS at the server and set `CAREEROS_BACKEND_DOMAIN` to a comma-separated list, for example
`vanisher.projectyourown.com, careerosbackend.projectyourown.com`.

Clients find this backend through `EXPO_PUBLIC_CAREEROS_API_BASE_URL` (mobile, defaulting to
`https://vanisher.projectyourown.com` in `apps/mobile/src/config/env.ts`) and `GITHUB_EXCHANGE_URL` in
`apps/desktop/src/oauth.js`. Learning-content assets keep loading from the web deployment (see `resolveAssetUrl` in
`apps/mobile/src/lib/learningClient.ts`).
