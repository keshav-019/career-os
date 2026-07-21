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
 * Append-only log of completed system-design attempts (every required
 * component placed correctly). Mirrors coding-submission-log.ts: no design
 * content is stored, only "this user completed this problem at this
 * moment", so we can show attempt counts/history without keeping a copy of
 * anyone's actual design.
 */
export type SystemDesignAttemptLogEntry = {
  completedAt: string;
  id: string;
  problemId: string;
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

function parseAttemptLog(snapshot: QueryDocumentSnapshot<DocumentData>): SystemDesignAttemptLogEntry {
  const data = snapshot.data() as Record<string, unknown>;
  return {
    completedAt: asIsoString(data.completedAt) || new Date(0).toISOString(),
    id: snapshot.id,
    problemId: asString(data.problemId),
    userId: asString(data.userId)
  };
}

/**
 * Records a completed attempt. Best-effort and silent on failure - a
 * logging problem must never block the completion state the user already
 * sees on screen. Call this only once, the first time a problem flips to
 * completed in a given session.
 */
export async function logSystemDesignAttempt(userId: string, problemId: string): Promise<void> {
  if (!db || !userId || !problemId) {
    return;
  }

  try {
    await addDoc(collection(db, "systemDesignAttemptLogs"), {
      completedAt: new Date().toISOString(),
      problemId,
      userId
    });
  } catch {
    // Intentionally swallowed - see doc comment above.
  }
}

/**
 * Reads the current user's completion history for one problem. Queries by
 * (userId, problemId) equality only - no orderBy - so this works without
 * deploying a composite Firestore index; sorting happens client-side since
 * per-problem attempt counts are expected to stay small.
 */
export function useSystemDesignAttemptStats(problemId: string | null) {
  const [entries, setEntries] = useState<SystemDesignAttemptLogEntry[]>([]);
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
        collection(db, "systemDesignAttemptLogs"),
        where("userId", "==", user.uid),
        where("problemId", "==", problemId)
      );

      unsubscribeLogs = onSnapshot(
        logsQuery,
        (snapshot) => {
          const parsed = snapshot.docs
            .map(parseAttemptLog)
            .sort((first, second) => Date.parse(second.completedAt) - Date.parse(first.completedAt));
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
    lastCompletedAt: entries[0]?.completedAt ?? null,
    loading
  };
}
