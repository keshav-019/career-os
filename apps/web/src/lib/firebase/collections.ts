export const firestoreCollections = {
  jobs: "jobs",
  interviews: "interviews",
  resumes: "resumes",
  emails: "emails",
  reminders: "reminders",
  practiceAttempts: "practiceAttempts"
} as const;

export type FirestoreCollection = keyof typeof firestoreCollections;

export function userCollectionPath(userId: string, collection: FirestoreCollection) {
  return `users/${userId}/${firestoreCollections[collection]}`;
}
