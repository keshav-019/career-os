export const firestoreCollections = {
  jobs: "jobs",
  interviews: "interviews",
  resumes: "resumes",
  emails: "emails",
  reminders: "reminders",
  practiceAttempts: "practiceAttempts",
  // Visual Mode resumes (structured ResumeData, not the HTML-sections `resumes` shape) - name is a holdover from
  // when this collection was mobile-only; now shared by both web's and mobile's Visual Mode editors so a resume
  // built on one platform is editable on the other. See lib/firebase/visual-resumes.ts.
  mobileResumes: "mobileResumes"
} as const;

export type FirestoreCollection = keyof typeof firestoreCollections;

export function userCollectionPath(userId: string, collection: FirestoreCollection) {
  return `users/${userId}/${firestoreCollections[collection]}`;
}
