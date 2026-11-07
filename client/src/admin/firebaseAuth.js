import { getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, inMemoryPersistence, sendPasswordResetEmail, setPersistence, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { firebaseConfig, firebaseReady } from '../firebase.js';

function identity() {
  if (!firebaseReady) throw new Error('Firebase sign-in is not configured on this website.');
  const app = getApps().find((a) => a.name === 'printing-engine-admin') || initializeApp(firebaseConfig, 'printing-engine-admin');
  return getAuth(app);
}

// A separate, memory-only Firebase app keeps team login away from shopper data sync.
async function freshToken(signIn) {
  const auth = identity();
  await setPersistence(auth, inMemoryPersistence);
  try {
    const credential = await signIn(auth);
    return await credential.user.getIdToken(true);
  } finally { await signOut(auth).catch(() => {}); }
}

export const adminIdToken = (email, password) => freshToken((auth) => signInWithEmailAndPassword(auth, email.trim(), password));
export const adminGoogleIdToken = () => freshToken((auth) => signInWithPopup(auth, new GoogleAuthProvider()));

export const resetAdminPassword = (email) => sendPasswordResetEmail(identity(), email.trim());
