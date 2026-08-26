import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  UserCredential,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyA7YDi0gH82_5A691p-B5u_9MTX8Nye0A0",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "hris-ae237.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "hris-ae237",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "hris-ae237.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "726804546046",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:726804546046:web:86030bc52174aa677e00af",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-ZNZL9ZKQWZ",
};

// Initialize Firebase App singleton
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/calendar.events");
googleProvider.setCustomParameters({
  prompt: "select_account",
});

export interface FirebaseGoogleLoginResult {
  user: {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
  };
  idToken: string;
  accessToken: string | null;
}

/**
 * Extract standardized result from Firebase UserCredential.
 */
export async function parseUserCredential(result: UserCredential): Promise<FirebaseGoogleLoginResult> {
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const idToken = await result.user.getIdToken(true);
  const accessToken = credential?.accessToken ?? null;

  return {
    user: {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
    },
    idToken,
    accessToken,
  };
}

/**
 * Sign in with Google using Popup or fallback to Redirect if Popup is blocked by COOP/Browser policies.
 */
export async function signInWithGoogleFirebase(): Promise<FirebaseGoogleLoginResult | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return await parseUserCredential(result);
  } catch (err: any) {
    console.warn("[Firebase Auth] Popup blocked or failed, falling back to Redirect:", err);
    // If popup is blocked by COOP or user browser settings, fallback to redirect
    await signInWithRedirect(auth, googleProvider);
    return null;
  }
}

/**
 * Check if returning from a signInWithRedirect operation.
 */
export async function checkFirebaseRedirectResult(): Promise<FirebaseGoogleLoginResult | null> {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      return await parseUserCredential(result);
    }
  } catch (err) {
    console.error("[Firebase Auth] Error getting redirect result:", err);
  }
  return null;
}

export async function logoutFirebase(): Promise<void> {
  await firebaseSignOut(auth);
}
