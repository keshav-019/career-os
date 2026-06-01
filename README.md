# CareerOS

CareerOS is a portfolio-ready career command center built around Next.js, Firebase, a Chrome job capture extension, and a future mobile app lane.

## Workspace

- `apps/web` - Next.js app for the CareerOS dashboard, applications pipeline, interview war room, resume studio, analytics, calendar, learning, notifications, and integrations.
- `apps/extension` - Chrome Manifest V3 starter for saving job posts from any portal.
- `apps/mobile` - Expo/React Native planning lane for notifications and mobile workflows.
- `packages/shared` - Shared TypeScript domain models and scoring helpers.

## Getting Started

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Firebase Setup

1. Create a Firebase project.
2. Copy `apps/web/.env.local.example` to `apps/web/.env.local`.
3. Fill in the public Firebase web app values.
4. Add Firebase Admin values when server-side persistence is added.

The current UI runs with mock data so the product shell is usable before Firebase credentials exist.

## Near-Term Build Plan

- Persist saved jobs under `users/{uid}/jobs`.
- Add Firebase Auth with Google sign-in.
- Connect the Chrome extension import route to Firestore.
- Add Gmail API ingestion for recruiter, interview, rejection, and offer signals.
- Add Calendar reminders for follow-ups, interviews, prep blocks, and application check-ins.
- Expand CareerOS into mobile notifications, learning plans, and a richer interview memory workspace.
