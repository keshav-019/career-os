"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  type DocumentData,
  type QueryDocumentSnapshot
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase/client";

export type ReminderEventType = "interview" | "prep" | "deadline" | "focus";

export type CalendarReminder = {
  createdAt?: string;
  id: string;
  notes: string;
  startsAt: string;
  title: string;
  type: ReminderEventType;
};

const EVENT_TYPE_VALUES = new Set<ReminderEventType>(["interview", "prep", "deadline", "focus"]);

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asIsoString(value: unknown): string {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
  }

  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    try {
      const date = value.toDate() as Date;
      const parsed = date.getTime();
      return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
    } catch {
      return "";
    }
  }

  return "";
}

function parseReminder(snapshot: QueryDocumentSnapshot<DocumentData>): CalendarReminder {
  const data = snapshot.data() as Record<string, unknown>;
  const typeCandidate = asString(data.type) as ReminderEventType;

  return {
    id: snapshot.id,
    title: asString(data.title) || "Untitled event",
    startsAt: asIsoString(data.startsAt) || new Date().toISOString(),
    type: EVENT_TYPE_VALUES.has(typeCandidate) ? typeCandidate : "focus",
    notes: asString(data.notes),
    createdAt: asIsoString(data.createdAt) || undefined
  };
}

function sortRemindersAscending(reminders: CalendarReminder[]): CalendarReminder[] {
  return [...reminders].sort((first, second) => Date.parse(first.startsAt) - Date.parse(second.startsAt));
}

export function useUserReminders() {
  const hasAuth = Boolean(auth);
  const hasDb = Boolean(db);
  const [reminders, setReminders] = useState<CalendarReminder[]>([]);
  const [user, setUser] = useState<User | null>(auth?.currentUser ?? null);
  const [loading, setLoading] = useState(hasAuth && hasDb);
  const [error, setError] = useState<string | null>(
    !hasAuth ? "Firebase authentication is not configured." : !hasDb ? "Firestore is not configured." : null
  );

  useEffect(() => {
    if (!auth || !db) {
      return;
    }

    let unsubscribeReminders: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      if (unsubscribeReminders) {
        unsubscribeReminders();
        unsubscribeReminders = null;
      }

      setUser(authUser);

      if (!authUser) {
        setReminders([]);
        setLoading(false);
        setError(null);
        return;
      }

      if (!db) {
        setReminders([]);
        setLoading(false);
        setError("Firestore is not configured.");
        return;
      }

      setLoading(true);
      setError(null);

      unsubscribeReminders = onSnapshot(
        collection(db, "users", authUser.uid, "reminders"),
        (snapshot) => {
          const parsedReminders = snapshot.docs.map((docSnapshot) => parseReminder(docSnapshot));
          setReminders(sortRemindersAscending(parsedReminders));
          setLoading(false);
          setError(null);
        },
        (snapshotError) => {
          setReminders([]);
          setLoading(false);
          setError(snapshotError.message || "Failed to load reminders.");
        }
      );
    });

    return () => {
      if (unsubscribeReminders) {
        unsubscribeReminders();
      }

      unsubscribeAuth();
    };
  }, []);

  return {
    error,
    loading,
    reminders,
    user
  };
}

export async function createReminder(
  userId: string,
  payload: { notes: string; startsAt: string; title: string; type: ReminderEventType }
) {
  if (!db) {
    throw new Error("Firestore is not configured.");
  }

  const reminderRef = await addDoc(collection(db, "users", userId, "reminders"), {
    title: payload.title,
    startsAt: payload.startsAt,
    type: payload.type,
    notes: payload.notes,
    createdAt: new Date().toISOString()
  });

  return reminderRef.id;
}

export async function removeReminder(userId: string, reminderId: string) {
  if (!db) {
    throw new Error("Firestore is not configured.");
  }

  await deleteDoc(doc(db, "users", userId, "reminders", reminderId));
}
