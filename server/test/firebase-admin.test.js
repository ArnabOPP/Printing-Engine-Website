import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pe-firebase-admin-test-'));
Object.assign(process.env, { DATA_DIR: dir, NODE_ENV: 'development', ADMIN_AUTH_PROVIDER: 'firebase', FIREBASE_PROJECT_ID: 'test-project', JWT_SECRET: 'firebase-test-secret-at-least-32-characters', DELHIVERY_TOKEN: '', R2_BUCKET: '' });
delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
const { firebaseIdentity, firebaseAccessStore } = await import('../src/firebaseAdmin.js');
const { accessAdmin } = await import('../src/firebaseAccess.js');
const { default: router } = await import('../src/routes/admin.js');
const identity = firebaseIdentity();
const records = new Map([['owner-uid', { status: 'owner', name: 'Owner' }], ['admin-one', { status: 'admin', name: 'Admin One' }], ['admin-two', { status: 'admin', name: 'Admin Two' }]]);
const sessions = new Map();
let permissionOutage = false;
let revoked = false;
let oldLogin = false;
let wrongProject = false;
const calls = [];
mock.method(identity, 'verifyIdToken', async (token, checkRevoked) => {
  calls.push(['id', checkRevoked]);
  if (token === 'invalid' || wrongProject) throw Object.assign(new Error('Invalid token'), { code: 'auth/invalid-id-token' });
  return { uid: token, email: `${token}@example.com`, auth_time: Math.floor(Date.now() / 1000) - (oldLogin ? 600 : 0), role: 'owner' };
});
mock.method(identity, 'createSessionCookie', async (token, options) => {
  assert.equal(options.expiresIn, 8 * 3600 * 1000);
  const session = `firebase-session-${token}`;
  sessions.set(session, { uid: token, email: `${token}@example.com` });
  return session;
});
mock.method(identity, 'verifySessionCookie', async (cookie, checkRevoked) => {
  calls.push(['session', checkRevoked]);
  if (revoked || !sessions.has(cookie)) throw Object.assign(new Error('Revoked'), { code: 'auth/session-cookie-revoked' });
  return sessions.get(cookie);
});
const collection = {
  doc: (uid) => ({ get: async () => {
    if (permissionOutage) throw new Error('Firestore offline');
    return { exists: records.has(uid), data: () => records.get(uid) };
  } }),
  limit: () => ({ get: async () => ({ docs: [...records].map(([id, value]) => ({ id, data: () => value })) }) }),
};
mock.method(firebaseAccessStore(), 'collection', (name) => { assert.equal(name, 'adminAccess'); return collection; });
const app = express();
app.set('trust proxy', 1);
app.use(express.json(), cookieParser());
app.use('/api/admin', router);
app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}/api/admin`;
let clientNumber = 0;
async function request(route, { token, cookie, method = token === undefined ? 'GET' : 'POST', body, header = true } = {}) {
  return fetch(base + route, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.0.0.${++clientNumber}`, ...(header ? { 'X-Admin-Request': '1' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: token === undefined ? (body ? JSON.stringify(body) : undefined) : JSON.stringify({ idToken: token, role: 'owner', status: 'owner' }) });
}
const cookieFrom = (res) => res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
async function login(uid) {
  const res = await request('/login', { token: uid });
  assert.equal(res.status, 200, await res.clone().text());
  return { response: res, cookie: cookieFrom(res), admin: (await res.json()).admin };
}

test('multiple approved Firebase users can sign in with secure server sessions', async () => {
  for (const uid of ['admin-one', 'admin-two', 'owner-uid']) {
    const { response, cookie, admin } = await login(uid);
    assert.equal(admin.firebaseUid, uid);
    assert.equal(admin.role, uid === 'owner-uid' ? 'owner' : 'admin');
    assert.equal(admin.authProvider, 'firebase');
    assert.equal(response.headers.getSetCookie().length, 2);
    assert.ok(response.headers.getSetCookie().every((c) => /HttpOnly/i.test(c)));
    assert.equal((await request('/me', { cookie })).status, 200);
  }
  assert.ok(calls.every(([, checkRevoked]) => checkRevoked === true));
});

test('shopper claims and browser-supplied roles cannot grant admin access', async () => {
  const response = await request('/login', { token: 'shopper-uid' });
  assert.equal(response.status, 403);
  assert.equal(response.headers.getSetCookie().length, 0);
  assert.equal(accessAdmin('uid', { status: 'customer', role: 'owner' }), null);
  assert.equal(accessAdmin('uid', { profile: { status: 'admin' } }), null);
});

test('invalid tokens, wrong-project tokens and stale sign-ins are refused', async () => {
  assert.equal((await request('/login', { token: 'invalid' })).status, 401);
  wrongProject = true;
  try { assert.equal((await request('/login', { token: 'admin-one' })).status, 401); } finally { wrongProject = false; }
  oldLogin = true;
  try { assert.equal((await request('/login', { token: 'admin-one' })).status, 401); } finally { oldLogin = false; }
});

test('Firebase status changes and deletions affect existing sessions immediately', async () => {
  const { cookie } = await login('admin-one');
  records.set('admin-one', { status: 'disabled' });
  assert.equal((await request('/me', { cookie })).status, 401);
  assert.equal((await request('/login', { token: 'admin-one' })).status, 403);
  records.set('admin-one', { status: 'admin' });
  assert.equal((await request('/admins', { cookie })).status, 403);
  records.set('admin-one', { status: 'owner' });
  assert.equal((await request('/admins', { cookie })).status, 200);
  records.delete('admin-one');
  assert.equal((await request('/me', { cookie })).status, 401);
  records.set('admin-one', { status: 'admin' });
});

test('Firebase revocation and permission lookup outages fail closed', async () => {
  const { cookie } = await login('admin-two');
  revoked = true;
  try { assert.equal((await request('/me', { cookie })).status, 401); } finally { revoked = false; }
  permissionOutage = true;
  try { assert.equal((await request('/me', { cookie })).status, 503); } finally { permissionOutage = false; }
});

test('old local-password sessions and mismatched Firebase identities cannot bypass Firebase', async () => {
  const localCookie = `pe_admin=${jwt.sign({ sub: 'owner-uid', tv: 0 }, process.env.JWT_SECRET)}`;
  assert.equal((await request('/me', { cookie: localCookie })).status, 401);
  const { cookie } = await login('admin-two');
  const mismatch = cookie.replace('firebase-session-admin-two', 'firebase-session-owner-uid');
  assert.equal((await request('/me', { cookie: mismatch })).status, 401);
});

test('CSRF guard and logout apply to both session cookies', async () => {
  const { cookie } = await login('owner-uid');
  assert.equal((await request('/login', { token: 'owner-uid', header: false })).status, 403);
  const response = await request('/logout', { cookie, method: 'POST', body: {} });
  assert.equal(response.status, 200);
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.ok(response.headers.getSetCookie().every((c) => /Expires=Thu, 01 Jan 1970/i.test(c)));
});

test.after(async () => {
  mock.restoreAll();
  await new Promise((resolve) => server.close(resolve));
  assert.equal(path.dirname(dir), path.resolve(os.tmpdir()));
  fs.rmSync(dir, { recursive: true, force: true });
});
