import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
// @ts-expect-error - getReactNativePersistence is genuinely exported and works at runtime (Metro resolves the
// "react-native" package.json export condition, which ships it); tsc resolves via "node"/"default" instead, whose
// type definitions omit it. Known upstream issue: https://github.com/firebase/firebase-js-sdk/issues/9316
import { getReactNativePersistence, initializeAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { FIREBASE_CONFIG } from "../config/env";

function getFirebaseApp() {
  return getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG);
}

const app = getFirebaseApp();

// React Native has no window.localStorage, so Firebase Auth needs an explicit persistence adapter - this is the
// one difference from apps/web/src/lib/firebase/client.ts's plain getAuth(app). Without this, the user would have
// to sign in again every time the app restarts.
export const auth: Auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export const db: Firestore = getFirestore(app);

/** Same Firebase project's Storage bucket (career-os-9aa87.firebasestorage.app - see config/env.ts) - previously
 *  unused by either app. Used by lib/resumeUpload.ts to store uploaded resume files. Free (Spark) tier covers
 *  this comfortably (5GB storage, 1GB/day download) for personal use. */
export const storage: FirebaseStorage = getStorage(app);

export { app as firebaseApp };
