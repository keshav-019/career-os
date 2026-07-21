import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";
import { firestoreCollections } from "./collections";
import type { CareerResume } from "../types/resume";

/** Read-only mirror of apps/web/src/lib/firebase/resumes.ts's useUserResumes() - AI Match reads this collection to
 *  list candidate resumes. Saving/editing these (the LaTeX/section-based ResumeVersion editor) stays desktop-only,
 *  same as web; mobile only needs to read them for AI Match's resume picker. */
export function useUserResumes(userId: string | undefined) {
  const [resumes, setResumes] = useState<CareerResume[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setResumes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const resumesQuery = query(collection(db, "users", userId, firestoreCollections.resumes), orderBy("updatedAt", "desc"));
    const unsubscribe = onSnapshot(
      resumesQuery,
      (snapshot) => {
        setResumes(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as CareerResume));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [userId]);

  return { resumes, loading };
}
