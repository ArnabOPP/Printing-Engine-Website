import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { COOKIE_NAME, COOKIE_SAMESITE, JWT_SECRET, SESSION_HOURS, isProd } from './config.js';
import { data } from './store.js';
import { firebaseAdminMode, firebaseAuthError, firebaseIdentity } from './firebaseAdmin.js';
import { readAdminAccess } from './firebaseAccess.js';

const FIREBASE_COOKIE = 'pe_admin_firebase';

export const MIN_PASSWORD = 10;

export const hashPassword = (pw) => bcrypt.hash(pw, 12);

// Compared against when the email is unknown, so a wrong email takes as long as a wrong password.
const DUMMY = bcrypt.hashSync('not-a-real-password', 12);
export async function checkLogin(email, password) {
  const admin = data().admins.find((a) => a.email === String(email).trim().toLowerCase());
  const ok = await bcrypt.compare(String(password), admin ? admin.passHash : DUMMY);
  return ok && admin && !admin.disabled ? admin : null;
}

export function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (pw.length > 200) return 'That password is too long.';
  if (!/[a-z]/i.test(pw) || !/\d/.test(pw)) return 'Use letters and at least one number.';
  return null;
}

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: COOKIE_SAMESITE,
  secure: isProd || COOKIE_SAMESITE === 'none',
  maxAge: SESSION_HOURS * 3600 * 1000,
  path: '/',
});

export function startSession(res, admin, { firebaseSession } = {}) {
  const token = jwt.sign({ sub: admin.id, tv: admin.tokenVersion || 0, ...(firebaseSession ? { firebaseUid: admin.firebaseUid } : {}) }, JWT_SECRET, { expiresIn: `${SESSION_HOURS}h` });
  res.cookie(COOKIE_NAME, token, cookieOptions());
  if (firebaseSession) res.cookie(FIREBASE_COOKIE, firebaseSession, cookieOptions());
}

export const endSession = (res) => {
  for (const name of [COOKIE_NAME, FIREBASE_COOKIE]) res.clearCookie(name, { ...cookieOptions(), maxAge: undefined });
};

// Works out who is calling from the login cookie. Disabled admins and changed passwords end old sessions at once.
async function currentAdmin(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    const { sub, tv, firebaseUid } = jwt.verify(token, JWT_SECRET);
    if (firebaseAdminMode()) {
      if (!firebaseUid || firebaseUid !== sub || !req.cookies?.[FIREBASE_COOKIE]) return null;
      const identity = await firebaseIdentity().verifySessionCookie(req.cookies[FIREBASE_COOKIE], true);
      if (identity.uid !== firebaseUid) return null;
      return readAdminAccess(firebaseUid, identity);
    }
    const admin = data().admins.find((a) => a.id === sub);
    return admin && !admin.disabled && (admin.tokenVersion || 0) === tv ? admin : null;
  } catch (err) {
    if (err.status === 503 || err.code) {
      const error = firebaseAuthError(err);
      if (error.status !== 401) throw error;
    }
    return null;
  }
}

export async function requireAdmin(req, res, next) {
  let admin;
  try { admin = await currentAdmin(req); } catch (err) { return next(err); }
  if (!admin) return res.status(401).json({ error: 'Please sign in.' });
  // Anything that changes data must carry this header. Browsers only let the real site send it (CORS),
  // so a page on another website cannot make a signed-in admin change something.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('x-admin-request') !== '1') {
    return res.status(403).json({ error: 'Request blocked.' });
  }
  req.admin = admin;
  return next();
}

export function requireOwner(req, res, next) {
  if (req.admin?.role !== 'owner') return res.status(403).json({ error: 'Only the owner can do this.' });
  return next();
}

export const publicAdmin = (a) => ({ id: a.id, email: a.email, name: a.name, role: a.role, firebaseUid: a.firebaseUid || null, authProvider: firebaseAdminMode() ? 'firebase' : 'local', disabled: !!a.disabled, createdAt: a.createdAt, lastLoginAt: a.lastLoginAt || null });
