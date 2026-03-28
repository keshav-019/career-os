import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";
import { firestoreCollections } from "./collections";
import type { MobileResumeRecord, ResumeData, ResumeTemplateId } from "../types/resume";

/** New collection introduced for the mobile Visual Mode resume builder - see src/types/resume.ts for why this
 *  isn't force-fit into the web's ResumeVersion/sections shape. Save/load only; no server-side generation logic
 *  needed since ResumeData is just structured form data. */
export function useMobileResumes(userId: string | undefined) {
  const [resumes, setResumes] = useState<MobileResumeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setResumes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const resumesQuery = query(
      collection(db, "users", userId, firestoreCollections.mobileResumes),
      orderBy("updatedAt", "desc")
    );
    const unsubscribe = onSnapshot(
      resumesQuery,
      (snapshot) => {
        setResumes(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as MobileResumeRecord));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [userId]);

  return { resumes, loading };
}

export async function saveMobileResume(
  userId: string,
  resumeId: string,
  label: string,
  templateId: ResumeTemplateId,
  data: ResumeData,
  createdAt?: string
): Promise<void> {
  const now = new Date().toISOString();
  await setDoc(doc(db, "users", userId, firestoreCollections.mobileResumes, resumeId), {
    id: resumeId,
    label,
    templateId,
    data,
    createdAt: createdAt ?? now,
    updatedAt: now
  });
}

export async function deleteMobileResume(userId: string, resumeId: string): Promise<void> {
  await deleteDoc(doc(db, "users", userId, firestoreCollections.mobileResumes, resumeId));
}
