"use client";

import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase/client";

/**
 * Append-only log of successful coding-arena submissions. Deliberately does
 * NOT store the submitted source code - only "this user passed this
 * problem's hidden tests at this moment", so we can show submission counts
 * and history without keeping a copy of anyone's solution.
 */
export type CodingSubmissionLogEntry = {
  id: string;
  problemId: string;
  submittedAt: string;
  userId: string;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asIsoString(value: unknown): string {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
  }

  return "";
}

function parseSubmissionLog(snapshot: QueryDocumentSnapshot<DocumentData>): CodingSubmissionLogEntry {
  const data = snapshot.data() as Record<string, unknown>;
  return {
    id: snapshot.id,
    problemId: asString(data.problemId),
    submittedAt: asIsoString(data.submittedAt) || new Date(0).toISOString(),
    userId: asString(data.userId)
  };
}

/**
 * Records a successful submission. Best-effort and silent on failure - a
 * logging problem must never block the judge result the user is looking at.
 * Call this only after the judge itself reports the submission as accepted.
 */
export async function logCodingSubmission(userId: string, problemId: string): Promise<void> {
  if (!db || !userId || !problemId) {
    return;
  }

  try {
    await addDoc(collection(db, "codingSubmissionLogs"), {
      problemId,
      submittedAt: new Date().toISOString(),
      userId
    });
  } catch {
    // Intentionally swallowed - see doc comment above.
  }
}

/**
 * Reads the current user's submission history for one problem. Queries by
 * (userId, problemId) equality only - no orderBy - so this works without
 * deploying a composite Firestore index; sorting happens client-side since
 * per-problem submission counts are expected to stay small.
 */
export function useCodingSubmissionStats(problemId: string | null) {
  const [entries, setEntries] = useState<CodingSubmissionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth || !db || !problemId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    let unsubscribeLogs: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeLogs) {
        unsubscribeLogs();
        unsubscribeLogs = null;
      }

      if (!user || !db) {
        setEntries([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const logsQuery = query(
        collection(db, "codingSubmissionLogs"),
        where("userId", "==", user.uid),
        where("problemId", "==", problemId)
      );

      unsubscribeLogs = onSnapshot(
        logsQuery,
        (snapshot) => {
          const parsed = snapshot.docs
            .map(parseSubmissionLog)
            .sort((first, second) => Date.parse(second.submittedAt) - Date.parse(first.submittedAt));
          setEntries(parsed);
          setLoading(false);
        },
        () => {
          setEntries([]);
          setLoading(false);
        }
      );
    });

    return () => {
      if (unsubscribeLogs) {
        unsubscribeLogs();
      }

      unsubscribeAuth();
    };
  }, [problemId]);

  return {
    count: entries.length,
    entries,
    lastSubmittedAt: entries[0]?.submittedAt ?? null,
    loading
  };
}
