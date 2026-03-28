// Mirrors apps/web/src/lib/firebase/collections.ts exactly - same Firestore project, same collection names, so
// the mobile app reads/writes the same per-user documents the web app does.
export const firestoreCollections = {
  jobs: "jobs",
  interviews: "interviews",
  resumes: "resumes",
  emails: "emails",
  reminders: "reminders",
  practiceAttempts: "practiceAttempts",
  // New collection introduced for this app: Visual Mode resume data has no Firestore persistence on web today
  // (apps/web/src/components/resume/ResumeStudio.tsx holds it in local component state only, since that whole
  // route is desktop-app-gated and out of scope for a from-scratch save/load design). Mobile needs save/load, so
  // it gets its own collection rather than force-fitting into the web's HTML-sections `resumes` shape, which is
  // structured for a completely different (LaTeX/section-based) editor. See src/types/resume.ts.
  mobileResumes: "mobileResumes"
} as const;
