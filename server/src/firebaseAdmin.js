import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export const firebaseAdminMode = () => process.env.ADMIN_AUTH_PROVIDER !== 'local';
const unavailable = () => Object.assign(new Error('Firebase admin sign-in is not configured on the server yet.'), { status: 503, expose: true });

export function firebaseIdentity() {
  const existing = getApps().find((app) => app.name === 'printing-engine-admin');
  if (existing) return getAuth(existing);
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) : null;
    const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccount?.project_id;
    if (!projectId) throw unavailable();
    const credential = serviceAccount ? cert(serviceAccount) : applicationDefault();
    return getAuth(initializeApp({ projectId, credential }, 'printing-engine-admin'));
  } catch { throw unavailable(); }
}

export function firebaseAccessStore() {
  firebaseIdentity();
  return getFirestore(getApps().find((app) => app.name === 'printing-engine-admin'));
}

export function firebaseAuthError(err) {
  if (err.status) return err;
  if (['auth/argument-error', 'auth/invalid-id-token', 'auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found', 'auth/session-cookie-expired', 'auth/session-cookie-revoked', 'auth/invalid-session-cookie'].includes(err.code)) {
    return Object.assign(new Error('Your Firebase sign-in expired or is invalid. Please sign in again.'), { status: 401 });
  }
  return unavailable();
}
