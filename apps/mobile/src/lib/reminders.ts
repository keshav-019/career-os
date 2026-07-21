import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";
import { firestoreCollections } from "./collections";
import type { CalendarReminder, ReminderType } from "../types/reminder";

/** Mirrors apps/web/src/lib/firebase/reminders.ts. No update/edit function exists on web either - reminders can
 *  only be created or deleted, never edited in place. */
export function useUserReminders(userId: string | undefined) {
  const [reminders, setReminders] = useState<CalendarReminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setReminders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const remindersQuery = query(
      collection(db, "users", userId, firestoreCollections.reminders),
      orderBy("startsAt", "asc")
    );
    const unsubscribe = onSnapshot(
      remindersQuery,
      (snapshot) => {
        setReminders(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as CalendarReminder));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [userId]);

  return { reminders, loading };
}

export async function createReminder(
  userId: string,
  input: { title: string; startsAt: string; type: ReminderType; notes: string }
): Promise<string> {
  const docRef = await addDoc(collection(db, "users", userId, firestoreCollections.reminders), {
    ...input,
    createdAt: new Date().toISOString()
  });
  return docRef.id;
}

export async function removeReminder(userId: string, reminderId: string): Promise<void> {
  await deleteDoc(doc(db, "users", userId, firestoreCollections.reminders, reminderId));
}
