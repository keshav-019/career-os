"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase/client";
import { firestoreCollections } from "@/lib/firebase/collections";
import type { ResumeData, VisualResumeRecord } from "@/lib/resume-types";

/** Mirrors apps/mobile/src/lib/mobileResumes.ts exactly - same collection (users/{uid}/mobileResumes), same
 *  document shape, so a Visual Mode resume built on one platform loads and edits identically on the other. */

export function useUserVisualResumes() {
  const hasAuth = Boolean(auth);
  const hasDb = Boolean(db);
  const [resumes, setResumes] = useState<VisualResumeRecord[]>([]);
  const [loading, setLoading] = useState(hasAuth && hasDb);

  useEffect(() => {
    const firebaseAuth = auth;
    const firestore = db;
    if (!firebaseAuth || !firestore) {
      setLoading(false);
      return;
    }

    let unsubscribeResumes: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user: User | null) => {
      if (unsubscribeResumes) {
        unsubscribeResumes();
        unsubscribeResumes = null;
      }

      if (!user) {
        setResumes([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const resumesQuery = query(
        collection(firestore, "users", user.uid, firestoreCollections.mobileResumes),
        orderBy("updatedAt", "desc")
      );
      unsubscribeResumes = onSnapshot(
        resumesQuery,
        (snapshot) => {
          setResumes(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as VisualResumeRecord));
          setLoading(false);
        },
        () => setLoading(false)
      );
    });

    return () => {
      if (unsubscribeResumes) unsubscribeResumes();
      unsubscribeAuth();
    };
  }, []);

  return { resumes, loading };
}

export async function saveVisualResume(
  userId: string,
  resumeId: string,
  label: string,
  templateId: string,
  data: ResumeData,
  createdAt?: string,
  jobId?: string,
  jobLabel?: string
): Promise<void> {
  if (!db) throw new Error("Firestore is not configured.");
  const now = new Date().toISOString();
  await setDoc(doc(db, "users", userId, firestoreCollections.mobileResumes, resumeId), {
    id: resumeId,
    label,
    templateId,
    data,
    createdAt: createdAt ?? now,
    updatedAt: now,
    ...(jobId ? { jobId } : {}),
    ...(jobLabel ? { jobLabel } : {})
  });
}

export async function deleteVisualResume(userId: string, resumeId: string): Promise<void> {
  if (!db) throw new Error("Firestore is not configured.");
  await deleteDoc(doc(db, "users", userId, firestoreCollections.mobileResumes, resumeId));
}
