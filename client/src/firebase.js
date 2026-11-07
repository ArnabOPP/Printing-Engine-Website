// Firebase sign-in for shoppers. These values are the public "web app" settings from the Firebase console
// (Project settings → Your apps → Web app). They are not secrets. Put them in client/.env (see .env.example).
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};
export const firebaseConfig = config;

export const firebaseReady = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
const app = firebaseReady ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

// Plain-English messages for Firebase's error codes.
export function authMessage(err) {
  switch (err?.code) {
    case 'auth/invalid-email': return 'That email address does not look right.';
    case 'auth/missing-password': return 'Enter your password.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials': return 'Email or password is not correct.';
    case 'auth/email-already-in-use': return 'An account with this email already exists. Try signing in.';
    case 'auth/weak-password': return 'Choose a stronger password (at least 6 characters).';
    case 'auth/too-many-requests': return 'Too many tries. Wait a few minutes and try again.';
    case 'auth/network-request-failed': return 'No connection. Check your internet and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request': return '';
    case 'auth/popup-blocked': return 'Your browser blocked the Google window. Allow pop-ups and try again.';
    case 'auth/operation-not-allowed': return 'This sign-in method is not switched on yet.';
    case 'auth/unauthorized-domain': return 'This website address is not allowed for sign-in yet.';
    case 'auth/account-exists-with-different-credential': return 'This email is already used with another sign-in method.';
    default: return 'Something went wrong. Please try again.';
  }
}
