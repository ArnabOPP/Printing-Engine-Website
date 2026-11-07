import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider, createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile,
} from 'firebase/auth';
import { auth, firebaseReady } from '../firebase.js';
import { EMPTY_ACCOUNT, readAccount, readOrders, writeAccount, writeOrders } from '../account.js';
import { loadOrders, loadUserDoc, saveOrder, saveProfile } from '../cloud.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // `loading` stays true until Firebase has said whether someone is signed in.
  const [loading, setLoading] = useState(firebaseReady);

  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
  }, []);

  // `cloud` is the customer's saved data from Firebase. The pages read the local cache, which is refreshed when `ready` flips.
  const [cloud, setCloud] = useState({ ready: false, wishlist: [], failed: false });
  const uid = user?.uid;

  useEffect(() => {
    if (!uid) { setCloud({ ready: false, wishlist: [], failed: false }); return undefined; }
    let live = true;
    (async () => {
      try {
        const remote = await loadUserDoc(uid);
        // Details saved in the account win; anything missing is filled from this device, then from the sign-in itself.
        const merged = { ...EMPTY_ACCOUNT, ...readAccount() };
        Object.entries(remote.profile || {}).forEach(([k, v]) => { if (String(v || '').trim()) merged[k] = v; });
        merged.name = merged.name || user.displayName || '';
        merged.email = merged.email || user.email || '';
        writeAccount(merged);
        if (JSON.stringify(merged) !== JSON.stringify({ ...EMPTY_ACCOUNT, ...(remote.profile || {}) })) await saveProfile(uid, merged);

        // Orders placed on this device before signing in are added to the account.
        const remoteOrders = await loadOrders(uid);
        const known = new Set(remoteOrders.map((o) => o.id));
        const extra = readOrders().filter((o) => o && o.id && !known.has(o.id));
        await Promise.all(extra.map((o) => saveOrder(uid, o).catch(() => {})));
        writeOrders([...remoteOrders, ...extra].sort((a, b) => (a.placedAt < b.placedAt ? 1 : -1)));
        if (live) setCloud({ ready: true, wishlist: remote.wishlist, failed: false });
      } catch {
        // Firestore not switched on yet, or no connection: the pages keep working from this device.
        if (live) setCloud({ ready: false, wishlist: [], failed: true });
      }
    })();
    return () => { live = false; };
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => ({
    user,
    cloud,
    loading,
    available: firebaseReady,
    signIn: (email, password) => signInWithEmailAndPassword(auth, email.trim(), password),
    signUp: async (name, email, password) => {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
      return cred;
    },
    google: () => signInWithPopup(auth, new GoogleAuthProvider()),
    reset: (email) => sendPasswordResetEmail(auth, email.trim()),
    // The account's copy stays in Firebase. Clear this device's copy so the next person on it does not see it.
    signOut: async () => {
      // Only when the account really holds a copy; if Firebase could not be reached, keep this device's data.
      if (cloud.ready) try { ['account', 'orders', 'wishlist'].forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
      await signOut(auth);
    },
  }), [user, loading, cloud]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
