import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
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

export { app as firebaseApp };
