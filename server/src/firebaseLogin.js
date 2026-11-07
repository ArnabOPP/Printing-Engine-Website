import { audit, save } from './store.js';
import { SESSION_HOURS } from './config.js';
import { firebaseAuthError, firebaseIdentity } from './firebaseAdmin.js';
import { readAdminAccess } from './firebaseAccess.js';

// Firebase proves identity; only server-managed UID records grant admin access.
export async function firebaseLogin(idToken, { identity = firebaseIdentity(), lookup = readAdminAccess } = {}) {
  if (typeof idToken !== 'string' || !idToken || idToken.length > 16000) throw Object.assign(new Error('Sign in with Firebase first.'), { status: 401 });
  let claims;
  let sessionCookie;
  try {
    claims = await identity.verifyIdToken(idToken, true);
    const age = Date.now() / 1000 - claims.auth_time;
    if (!claims.uid || !Number.isFinite(age) || age < -60 || age > 300) throw Object.assign(new Error('Please sign in again before opening the admin panel.'), { status: 401 });
  } catch (err) { throw firebaseAuthError(err); }
  const admin = await lookup(claims.uid, claims);
  if (!admin || admin.disabled) throw Object.assign(new Error('This Firebase account does not have admin access.'), { status: 403 });
  try { sessionCookie = await identity.createSessionCookie(idToken, { expiresIn: SESSION_HOURS * 3600 * 1000 }); }
  catch (err) { throw firebaseAuthError(err); }
  admin.lastLoginAt = new Date().toISOString();
  audit(admin.email, 'admin.firebase-login');
  await save();
  return { admin, sessionCookie };
}
