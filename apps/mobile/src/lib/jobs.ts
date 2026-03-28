import { collection, deleteDoc, deleteField, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";
import { firestoreCollections } from "./collections";
import type { CareerJob } from "../types/job";

/** Mirrors apps/web/src/lib/firebase/jobs.ts's useUserJobs() - same collection, same live onSnapshot pattern. */
export function useUserJobs(userId: string | undefined) {
  const [jobs, setJobs] = useState<CareerJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setJobs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const jobsQuery = query(collection(db, "users", userId, firestoreCollections.jobs), orderBy("savedAt", "desc"));
    const unsubscribe = onSnapshot(
      jobsQuery,
      (snapshot) => {
        setJobs(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as CareerJob));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [userId]);

  return { jobs, loading };
}

export async function updateJobRecord(userId: string, jobId: string, updates: Record<string, unknown>): Promise<void> {
  await updateDoc(doc(db, "users", userId, firestoreCollections.jobs, jobId), updates);
}

export async function clearJobInterviewLink(userId: string, jobId: string): Promise<void> {
  await updateDoc(doc(db, "users", userId, firestoreCollections.jobs, jobId), {
    interviewReminderId: deleteField(),
    nextActionAt: deleteField()
  });
}

export async function deleteJobRecord(userId: string, jobId: string): Promise<void> {
  await deleteDoc(doc(db, "users", userId, firestoreCollections.jobs, jobId));
}
