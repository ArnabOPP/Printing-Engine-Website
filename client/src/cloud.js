// A signed-in customer's details live in Firebase (Firestore), under their own user id:
//   users/{uid}                 -> { profile, wishlist, updatedAt }
//   users/{uid}/orders/{orderId} -> { uid, id, placedAt, total, data }   (data = the order as JSON text)
// firestore.rules lets each person read and write only their own documents.
import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc } from 'firebase/firestore';
import { db } from './firebase.js';

// Firestore refuses `undefined`, huge values and uploaded pictures. Keep the order readable but small.
const lean = (value) => JSON.parse(JSON.stringify(value, (k, v) => (typeof v === 'string' && (v.startsWith('data:') || v.length > 4000) ? '' : v)));

export async function loadUserDoc(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  const d = snap.exists() ? snap.data() : {};
  return { profile: d.profile || null, wishlist: Array.isArray(d.wishlist) ? d.wishlist : [] };
}

export const saveProfile = (uid, profile) => setDoc(doc(db, 'users', uid), { profile: lean(profile), updatedAt: new Date().toISOString() }, { merge: true });

export const saveWishlist = (uid, items) => setDoc(doc(db, 'users', uid), { wishlist: lean(items), updatedAt: new Date().toISOString() }, { merge: true });

export async function loadOrders(uid) {
  const snap = await getDocs(query(collection(db, 'users', uid, 'orders'), orderBy('placedAt', 'desc'), limit(50)));
  return snap.docs.map((d) => { try { return JSON.parse(d.data().data); } catch { return null; } }).filter((o) => o && o.id);
}

export const saveOrder = (uid, order) => setDoc(doc(db, 'users', uid, 'orders', order.id), {
  uid, id: order.id, placedAt: order.placedAt, total: order.total ?? order.subtotal ?? 0, data: JSON.stringify(lean(order)),
});
