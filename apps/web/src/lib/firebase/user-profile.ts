"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase/client";

/**
 * Reads the signed-in user's root `users/{uid}` document and reports whether
 * `admin === true`. This field can only ever be set through the Firebase
 * console or the Admin SDK - firestore.rules blocks clients from writing it
 * themselves, so this hook is safe to use for UI gating (the corresponding
 * API routes re-verify admin status server-side before doing anything
 * privileged; this hook only controls what's shown, never what's allowed).
 *
 * Also treats `non_admin === true` as sufficient. That field is a
 * local-development-only escape hatch (see lib/server/require-admin.ts) for
 * when the Firebase Admin SDK service account isn't configured yet - unlike
 * `admin`, it's just a plain field a developer can set on their own doc via
 * the Firebase console to unblock admin screens locally, and should be
 * removed once the Admin SDK is properly configured.
 */
export function useIsAdmin() {
  const hasAuth = Boolean(auth);
  const hasDb = Boolean(db);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(hasAuth && hasDb);

  useEffect(() => {
    if (!auth || !db) {
      setLoading(false);
      return;
    }

    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (authUser: User | null) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (!authUser) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      if (!db) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      unsubscribeProfile = onSnapshot(
        doc(db, "users", authUser.uid),
        (snapshot) => {
          const data = snapshot.data() as { admin?: unknown; non_admin?: unknown } | undefined;
          setIsAdmin(data?.admin === true || data?.non_admin === true);
          setLoading(false);
        },
        () => {
          setIsAdmin(false);
          setLoading(false);
        }
      );
    });

    return () => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }

      unsubscribeAuth();
    };
  }, []);

  return { isAdmin, loading };
}
