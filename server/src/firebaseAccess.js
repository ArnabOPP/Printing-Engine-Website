import { firebaseAccessStore } from './firebaseAdmin.js';

export const ADMIN_COLLECTION = 'adminAccess';

export function accessAdmin(uid, record, claims = {}) {
  if (!record || !['admin', 'owner'].includes(record.status)) return null;
  return {
    id: uid, firebaseUid: uid, email: claims.email || record.email || '', name: record.name || claims.name || claims.email || uid,
    role: record.status, disabled: false, authProvider: 'firebase', createdAt: record.createdAt || null, lastLoginAt: record.lastLoginAt || null,
  };
}

export async function readAdminAccess(uid, claims = {}) {
  try {
    const snapshot = await firebaseAccessStore().collection(ADMIN_COLLECTION).doc(uid).get();
    return snapshot.exists ? accessAdmin(uid, snapshot.data(), claims) : null;
  } catch {
    throw Object.assign(new Error('Admin permissions could not be checked in Firebase. Please try again.'), { status: 503, expose: true });
  }
}
