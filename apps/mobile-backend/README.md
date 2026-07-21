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
talks to this backend - a plain long-running Node process (Railway, or any Node host), which sidesteps serverless
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

Copy `.env.example` to `.env` and fill in the Firebase Admin service account fields at minimum (OpenRouter keys
only needed to exercise `/api/ai/*`).

## Deploying to Railway

1. Create a new Railway project from this GitHub repo. Leave the root directory as the repo root (not
   `apps/mobile-backend`) - the repo-root `railway.json` already points Railway at this workspace specifically via
   `npm ci --workspace @careeros/mobile-backend --workspace @careeros/shared` / `npm run start --workspace
   @careeros/mobile-backend`, and this app's own imports reach into `apps/web/src` by relative path, so the whole
   monorepo checkout needs to be present.
2. Set the environment variables from `.env.example` in Railway's dashboard (Variables tab). `FIREBASE_PRIVATE_KEY`
   should be pasted with its literal `\n` sequences intact (Railway stores it as one line; this app un-escapes it
   at startup the same way `apps/web/src/lib/firebase/admin.ts` does).
3. Deploy. Railway assigns a public URL (Settings -> Networking -> Generate Domain if one isn't assigned
   automatically).
4. Give that URL to update `apps/mobile/src/config/env.ts`'s `API_BASE_URL` (do NOT change the learning-content
   asset host - see `resolveAssetUrl` in `apps/mobile/src/lib/learningClient.ts`, which should keep pointing at the
   Vercel deployment for images, since that content already works fine there and isn't duplicated here).
