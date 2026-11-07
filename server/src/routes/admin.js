import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  checkLogin, endSession, hashPassword, passwordProblem, publicAdmin, requireAdmin, requireOwner, startSession,
} from '../auth.js';
import crypto from 'node:crypto';
import { PUBLIC_DIR, audit, data, newId, save } from '../store.js';
import { deleteArtwork, readArtwork } from '../files.js';
import { cleanContent, cleanCoupon } from '../content.js';
import * as delhivery from '../delhivery.js';
import { pollActive, refreshOrder } from '../shipping.js';
import { bookShipment, reconcileBooking, withShipmentLock } from '../booking.js';
import { firebaseLogin } from '../firebaseLogin.js';
import { firebaseAdminMode, firebaseAccessStore } from '../firebaseAdmin.js';
import { ADMIN_COLLECTION } from '../firebaseAccess.js';

const router = Router();

export const STATUSES = ['placed', 'confirmed', 'printing', 'ready', 'shipped', 'delivered', 'cancelled'];

// What the customer pays: the items minus any coupon. Orders from before coupons existed have no `total`.
const amount = (o) => o.total ?? o.subtotal;

const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/* ---------- sign in ---------- */

const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' } });

router.post('/login', loginLimit, async (req, res, next) => {
  try {
    if (req.get('x-admin-request') !== '1') throw bad('Request blocked.', 403);
    if (firebaseAdminMode()) {
      const { admin, sessionCookie } = await firebaseLogin(req.body?.idToken);
      startSession(res, admin, { firebaseSession: sessionCookie });
      return res.json({ admin: publicAdmin(admin) });
    }
    const admin = await checkLogin(req.body?.email ?? '', req.body?.password ?? '');
    if (!admin) return res.status(401).json({ error: 'Wrong email or password.' });
    admin.lastLoginAt = new Date().toISOString();
    audit(admin.email, 'login');
    await save();
    startSession(res, admin);
    return res.json({ admin: publicAdmin(admin) });
  } catch (err) {
    return next(err);
  }
});

router.post('/logout', (req, res) => {
  if (req.get('x-admin-request') !== '1') return res.status(403).json({ error: 'Request blocked.' });
  endSession(res); res.json({ ok: true });
});

// Everything below needs a signed-in admin.
router.use(requireAdmin);

router.get('/me', (req, res) => res.json({ admin: publicAdmin(req.admin), statuses: STATUSES }));

router.post('/me/password', async (req, res, next) => {
  try {
    if (firebaseAdminMode()) throw bad('Use the Firebase password-reset email to change your password.');
    const { current, next: pw } = req.body || {};
    if (!(await checkLogin(req.admin.email, current ?? ''))) throw bad('Your current password is wrong.');
    const problem = passwordProblem(pw);
    if (problem) throw bad(problem);
    req.admin.passHash = await hashPassword(pw);
    req.admin.tokenVersion = (req.admin.tokenVersion || 0) + 1; // signs out every other session
    audit(req.admin.email, 'password.changed');
    await save();
    startSession(res, req.admin);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* ---------- orders ---------- */

const orderRow = (o) => ({
  id: o.id, createdAt: o.createdAt, status: o.status, customer: { name: o.customer.name, phone: o.customer.phone, city: o.customer.city },
  pieces: o.items.reduce((n, i) => n + i.qty, 0), subtotal: o.subtotal, total: amount(o), discount: o.discount || 0, unpriced: o.unpriced, payment: o.payment, hasArtwork: Object.keys(o.designs || {}).length > 0, awb: o.shipment?.waybill || '', shipStage: o.shipment?.cancelled ? 'cancelled' : o.shipment?.stage || '',
});

router.get('/orders', (req, res) => {
  const status = str(req.query.status, 20);
  const q = str(req.query.q, 80).toLowerCase();
  let list = data().orders;
  if (STATUSES.includes(status)) list = list.filter((o) => o.status === status);
  if (q) {
    list = list.filter((o) => [o.id, o.customer.name, o.customer.phone, o.customer.email, o.customer.city].some((v) => String(v).toLowerCase().includes(q)));
  }
  res.json({ total: list.length, orders: list.slice(0, 300).map(orderRow) });
});

const findOrder = (id) => {
  const o = data().orders.find((x) => x.id === id);
  if (!o) throw bad('Order not found.', 404);
  return o;
};

router.get('/orders/:id', async (req, res, next) => {
  try { res.json({ order: findOrder(req.params.id) }); } catch (err) { next(err); }
});

router.post('/orders/:id/payment', async (req, res, next) => {
  try {
    const o = findOrder(req.params.id);
    await withShipmentLock(o, async () => {
      if (o.payment === 'cod' || o.status === 'cancelled') throw bad('This order cannot be marked as prepaid.');
      if (o.paymentStatus === 'paid') { await save(); return; }
      const paid = Number(req.body?.amount);
      const reference = str(req.body?.reference, 120);
      if (!Number.isFinite(paid) || paid <= 0 || paid > 1_000_000 || reference.length < 4) throw bad('Enter the final amount received and the payment reference (at least 4 characters).');
      const previous = { paymentStatus: o.paymentStatus, confirmedTotal: o.confirmedTotal, paymentReceipt: o.paymentReceipt };
      o.paymentStatus = 'paid';
      o.confirmedTotal = Math.round(paid * 100) / 100;
      o.paymentReceipt = { amount: o.confirmedTotal, reference, confirmedBy: req.admin.email, confirmedAt: new Date().toISOString() };
      audit(req.admin.email, 'payment.confirmed', o.id);
      try { await save(); } catch (err) { Object.assign(o, previous); throw err; }
    });
    res.json({ order: o });
  } catch (err) { next(err); }
});

router.post('/orders/:id/shipment/reconcile', async (req, res, next) => {
  try { res.json(await reconcileBooking(findOrder(req.params.id), req.admin.email)); }
  catch (err) { next(err); }
});

router.post('/orders/:id/shipment/reset-attempt', requireOwner, async (req, res, next) => {
  try {
    const o = findOrder(req.params.id);
    await withShipmentLock(o, async () => {
      if (o.shipment && !o.shipment.cancelled) throw bad('This order already has a shipment.');
      if (req.body?.reviewedNoShipment !== true) throw bad('Confirm in the Delhivery portal that no shipment exists before resetting.');
      if (await delhivery.findShipment(o.id)) throw bad('Delhivery found an existing shipment. Reconcile it instead.');
      o.bookingAttempt = { state: 'reset', reviewedBy: req.admin.email, reviewedAt: new Date().toISOString() };
      audit(req.admin.email, 'shipment.booking-reset', o.id);
      await save();
    });
    res.json({ order: o });
  } catch (err) { next(err); }
});

router.patch('/orders/:id', async (req, res, next) => {
  try {
    const o = findOrder(req.params.id);
    await withShipmentLock(o, async () => {
      const { status, adminNote } = req.body || {};
      if (status !== undefined) {
        if (!STATUSES.includes(status)) throw bad('Unknown status.');
        if (status !== o.status) {
          o.status = status;
          o.history.push({ at: new Date().toISOString(), status, by: req.admin.email });
          audit(req.admin.email, 'order.status', `${o.id} → ${status}`);
        }
      }
      if (adminNote !== undefined) { o.adminNote = str(adminNote, 2000); audit(req.admin.email, 'order.note', o.id); }
      await save();
    });
    res.json({ order: o });
  } catch (err) {
    next(err);
  }
});

router.delete('/orders/:id', requireOwner, async (req, res, next) => {
  try {
    const o = findOrder(req.params.id);
    await withShipmentLock(o, async () => {
      await deleteArtwork(o.id);
      data().orders = data().orders.filter((x) => x !== o);
      audit(req.admin.email, 'order.deleted', o.id);
      await save();
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Customers' uploaded artwork. Only signed-in admins can open it, and it is always served as a plain download-safe image.
router.get('/orders/:id/files/:name', async (req, res, next) => {
  try {
    const o = findOrder(req.params.id);
    const name = path.basename(req.params.name);
    if (o.assetsDeletedAt) throw bad('Artwork was removed after courier-confirmed dispatch.', 410);
    const known = Object.values(o.designs || {}).some((d) => ['front', 'back', 'left', 'right'].some((s) => d.mockups?.[s]?.file === name || (d[s] || []).some((l) => l.image?.file === name)));
    const file = known ? await readArtwork(o.id, name) : null;
    if (!file) throw bad('File not found.', 404);
    res.set({ 'Content-Type': file.type, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'private, max-age=300' });
    res.send(file.body);
  } catch (err) {
    next(err);
  }
});

/* ---------- shipping with Delhivery ---------- */

router.get('/shipping', (req, res) => {
  const { configured, env, pickupLocation, webhookReady } = delhivery.config;
  res.json({ configured, env, pickupLocation, webhookReady, onTheWay: data().orders.filter((o) => o.shipment?.waybill && !o.shipment.cancelled && !['delivered', 'returned'].includes(o.shipment.stage || '')).length });
});

router.get('/shipping/check', async (req, res, next) => {
  try {
    const pin = String(req.query.pin || '').trim();
    if (!/^[1-9]\d{5}$/.test(pin)) throw bad('Enter a 6 digit PIN code.');
    res.json(await delhivery.serviceability(pin));
  } catch (err) {
    next(err);
  }
});

router.post('/shipping/refresh-all', async (req, res, next) => {
  try {
    if (!delhivery.config.configured) throw bad('Delhivery is not set up yet.', 503);
    res.json(await pollActive({ olderThanMs: 0 }));
  } catch (err) {
    next(err);
  }
});

router.post('/shipping/pickup', async (req, res, next) => {
  try {
    const date = str(req.body?.date, 10);
    const time = str(req.body?.time, 8);
    const count = Math.round(Number(req.body?.count));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw bad('Choose the pickup date.');
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(time)) throw bad('Choose the pickup time.');
    if (!(count >= 1 && count <= 500)) throw bad('Enter how many parcels (1 to 500).');
    const when = Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time}+05:30`);
    if (!Number.isFinite(when) || when <= Date.now() || Number(time.slice(0, 2)) > 23 || Number(time.slice(3, 5)) > 59) throw bad('Choose a valid future pickup date and time in India time.');
    const r = await delhivery.requestPickup({ date, time: time.length === 5 ? `${time}:00` : time, count });
    audit(req.admin.email, 'pickup.requested', `${date} ${time} · ${count} parcels`);
    await save();
    res.json({ ok: true, id: r.id });
  } catch (err) {
    next(err);
  }
});

const nums = (b) => {
  const n = (v, label, lo, hi) => {
    const x = Number(v);
    if (!Number.isFinite(x) || x < lo || x > hi) throw bad(`${label} must be between ${lo} and ${hi}.`);
    return x;
  };
  return { weight: n(b.weight, 'Weight (grams)', 1, 50000), length: n(b.length, 'Length (cm)', 1, 200), width: n(b.width, 'Width (cm)', 1, 200), height: n(b.height, 'Height (cm)', 1, 200) };
};

// Book the parcel with Delhivery (or, if it was already booked on Delhivery's own site, just record its AWB).
router.post('/orders/:id/shipment', async (req, res, next) => {
  try {
    const o = findOrder(req.params.id);
    const manual = req.body?.mode === 'manual';
    if (manual && !/^[A-Za-z0-9-]{6,30}$/.test(str(req.body?.waybill, 30))) throw bad('Enter the AWB from the courier portal.');
    const parcel = manual ? null : { ...nums(req.body || {}), description: str(req.body?.description, 200), declaredValue: o.confirmedTotal ?? o.total ?? o.subtotal };
    const codAmount = o.payment === 'cod' ? (req.body?.codAmount === undefined || req.body.codAmount === '' ? (o.unpriced ? NaN : (o.total ?? o.subtotal)) : Number(req.body.codAmount)) : undefined;
    await bookShipment(o, { manualWaybill: manual ? str(req.body?.waybill, 30) : undefined, parcel, codAmount, by: req.admin.email });
    if (delhivery.config.configured) { try { await refreshOrder(o); } catch { /* tracking appears once Delhivery has the parcel */ } }
    res.status(201).json({ order: o });
  } catch (err) {
    next(err);
  }
});

router.post('/orders/:id/shipment/refresh', async (req, res, next) => {
  try {
    const o = findOrder(req.params.id);
    if (!o.shipment?.waybill) throw bad('This order has no shipment.');
    await refreshOrder(o);
    res.json({ order: o });
  } catch (err) {
    next(err);
  }
});

router.post('/orders/:id/shipment/cancel', async (req, res, next) => {
  try {
    const o = findOrder(req.params.id);
    await withShipmentLock(o, async () => {
      const s = o.shipment;
      if (!s?.waybill || s.cancelled) throw bad('There is no active shipment to cancel.');
      if (['delivered', 'returned', 'returning'].includes(s.stage)) throw bad('A completed or returning shipment cannot be cancelled.');
      await delhivery.cancelShipment(s.waybill);
      s.cancelled = true;
      s.stage = 'cancelled';
      audit(req.admin.email, 'shipment.cancelled', `${o.id} · AWB ${s.waybill}`);
      await save();
    });
    res.json({ order: o });
  } catch (err) {
    next(err);
  }
});

router.get('/orders/:id/shipment/label', async (req, res, next) => {
  try {
    const o = findOrder(req.params.id);
    if (!o.shipment?.waybill || o.shipment.cancelled) throw bad('This order has no active shipment.');
    const { pdf } = await delhivery.label(o.shipment.waybill);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="label-${o.shipment.waybill}.pdf"`, 'X-Content-Type-Options': 'nosniff' });
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

/* ---------- customers (built from their orders) ---------- */

function customers() {
  const map = new Map();
  for (const o of data().orders) {
    const key = o.customer.email || o.customer.phone;
    const c = map.get(key) || { key, name: o.customer.name, phone: o.customer.phone, email: o.customer.email, city: o.customer.city, state: o.customer.state, orders: 0, spent: 0, firstOrderAt: o.createdAt, lastOrderAt: o.createdAt, saved: new Map(), orderIds: [] };
    c.orders += 1;
    if (o.status !== 'cancelled') c.spent += amount(o);
    if (o.createdAt < c.firstOrderAt) c.firstOrderAt = o.createdAt;
    if (o.createdAt > c.lastOrderAt) { c.lastOrderAt = o.createdAt; c.name = o.customer.name; c.phone = o.customer.phone; c.city = o.customer.city; c.state = o.customer.state; }
    for (const w of o.wishlist || []) c.saved.set(w.href || w.name, w);
    c.orderIds.push(o.id);
    map.set(key, c);
  }
  return [...map.values()].map((c) => ({ ...c, saved: [...c.saved.values()], spent: Math.round(c.spent * 100) / 100 })).sort((a, b) => (a.lastOrderAt < b.lastOrderAt ? 1 : -1));
}

router.get('/customers', (req, res) => {
  const q = str(req.query.q, 80).toLowerCase();
  let list = customers();
  if (q) list = list.filter((c) => [c.name, c.phone, c.email, c.city].some((v) => String(v).toLowerCase().includes(q)));
  res.json({ total: list.length, customers: list.slice(0, 300) });
});

/* ---------- dashboard ---------- */

router.get('/stats', (req, res) => {
  const orders = data().orders;
  const live = orders.filter((o) => o.status !== 'cancelled');
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, orders.filter((o) => o.status === s).length]));
  const days = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString('en-CA'); // YYYY-MM-DD in the server's time zone
    const day = live.filter((o) => new Date(o.createdAt).toLocaleDateString('en-CA') === key);
    days.push({ date: key, orders: day.length, revenue: Math.round(day.reduce((n, o) => n + amount(o), 0)) });
  }
  const top = new Map();
  live.forEach((o) => o.items.forEach((i) => top.set(i.name, (top.get(i.name) || 0) + i.qty)));
  const today = days[days.length - 1];
  res.json({
    totals: {
      orders: orders.length,
      open: orders.filter((o) => ['placed', 'confirmed', 'printing', 'ready'].includes(o.status)).length,
      revenue: Math.round(live.reduce((n, o) => n + amount(o), 0)),
      discounts: Math.round(live.reduce((n, o) => n + (o.discount || 0), 0)),
      customers: customers().length,
      today: today.orders,
      todayRevenue: today.revenue,
      needsPrice: live.filter((o) => o.unpriced > 0 && !['delivered'].includes(o.status)).length,
    },
    byStatus,
    days,
    top: [...top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, qty]) => ({ name, qty })),
    recent: orders.slice(0, 8).map(orderRow),
  });
});

router.get('/activity', (req, res) => res.json({ activity: data().audit.slice(0, 100) }));

/* ---------- shop catalogue: prices and what is shown ---------- */

const num = (v, label, max = 1_000_000) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) throw bad(`${label} must be a number from 0 to ${max}.`);
  return Math.round(n * 100) / 100;
};
const list = (v, label) => {
  if (!Array.isArray(v) || v.length > 100 || v.some((x) => typeof x !== 'string' || x.length > 80)) throw bad(`${label} is not valid.`);
  return v;
};

function cleanCatalog(c) {
  const out = {};
  if (c.hiddenGroups !== undefined) out.hiddenGroups = list(c.hiddenGroups, 'Hidden categories');
  if (c.hiddenProducts !== undefined) out.hiddenProducts = list(c.hiddenProducts, 'Hidden products');
  for (const key of ['dtf', 'sublimation']) {
    if (c[key]) out[key] = { normalPerSqIn: num(c[key].normalPerSqIn, `${key} normal rate`, 10000), fullPerSqIn: num(c[key].fullPerSqIn, `${key} full body rate`, 10000) };
  }
  if (c.sheetPrices) {
    out.sheetPrices = {};
    for (const [name, p] of Object.entries(c.sheetPrices).slice(0, 10)) {
      out.sheetPrices[str(name, 60)] = p.a4 !== undefined ? { a4: num(p.a4, `${name} A4 price`) } : { rate: num(p.rate, `${name} rate`, 10000) };
    }
  }
  if (c.bases) {
    out.bases = {};
    for (const [name, v] of Object.entries(c.bases).slice(0, 40)) {
      out.bases[str(name, 60)] = typeof v === 'object' && v ? Object.fromEntries(Object.entries(v).slice(0, 10).map(([m, p]) => [str(m, 40), num(p, `${name} ${m} price`)])) : num(v, `${name} price`);
    }
  }
  return out;
}

router.get('/catalog', (req, res) => res.json({ catalog: data().catalog || {} }));

router.put('/catalog', async (req, res, next) => {
  try {
    data().catalog = cleanCatalog(req.body?.catalog || {});
    audit(req.admin.email, 'catalog.updated');
    await save();
    res.json({ catalog: data().catalog });
  } catch (err) {
    next(err);
  }
});

/* ---------- website content: products, home page sections, reviews ---------- */

router.get('/content', (req, res) => res.json({ content: data().content || {} }));

router.put('/content', async (req, res, next) => {
  try {
    data().content = cleanContent(req.body?.content || {});
    audit(req.admin.email, 'content.updated');
    await save();
    res.json({ content: data().content });
  } catch (err) {
    next(err);
  }
});

// Pictures for the website (products, banners, reviews). They are public once uploaded, so only safe image types are allowed.
const IMG = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/;
router.post('/uploads', async (req, res, next) => {
  try {
    const m = IMG.exec(String(req.body?.data || ''));
    if (!m) throw bad('Upload a PNG, JPG, WebP or GIF picture.');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 8 * 1024 * 1024) throw bad('That picture is over 8 MB. Please use a smaller one.');
    const name = `${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
    fs.writeFileSync(path.join(PUBLIC_DIR, name), buf);
    audit(req.admin.email, 'upload', name);
    await save();
    res.status(201).json({ url: `/uploads/${name}` });
  } catch (err) {
    next(err);
  }
});

/* ---------- coupons and offers ---------- */

router.get('/coupons', (req, res) => res.json({ coupons: data().coupons }));

router.post('/coupons', async (req, res, next) => {
  try {
    const c = cleanCoupon(req.body || {});
    if (data().coupons.some((x) => x.code === c.code)) throw bad('A coupon with this code already exists.');
    data().coupons.unshift(c);
    audit(req.admin.email, 'coupon.created', c.code);
    await save();
    res.status(201).json({ coupon: c });
  } catch (err) {
    next(err);
  }
});

router.put('/coupons/:id', async (req, res, next) => {
  try {
    const i = data().coupons.findIndex((x) => x.id === req.params.id);
    if (i < 0) throw bad('Coupon not found.', 404);
    const c = cleanCoupon(req.body || {}, data().coupons[i]);
    if (data().coupons.some((x) => x.code === c.code && x.id !== c.id)) throw bad('A coupon with this code already exists.');
    data().coupons[i] = c;
    audit(req.admin.email, 'coupon.updated', c.code);
    await save();
    res.json({ coupon: c });
  } catch (err) {
    next(err);
  }
});

router.delete('/coupons/:id', async (req, res, next) => {
  try {
    const c = data().coupons.find((x) => x.id === req.params.id);
    if (!c) throw bad('Coupon not found.', 404);
    data().coupons = data().coupons.filter((x) => x !== c);
    audit(req.admin.email, 'coupon.deleted', c.code);
    await save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* ---------- admin team (owner only) ---------- */

router.get('/admins', requireOwner, async (req, res, next) => {
  try {
    if (firebaseAdminMode()) {
      const records = await firebaseAccessStore().collection(ADMIN_COLLECTION).limit(100).get();
      return res.json({ admins: records.docs.map((doc) => ({ id: doc.id, firebaseUid: doc.id, ...doc.data() })), managedInFirebase: true });
    }
    res.json({ admins: data().admins.map(publicAdmin) });
  } catch (err) { next(err); }
});

router.post('/admins', requireOwner, async (req, res, next) => {
  try {
    if (firebaseAdminMode()) throw bad('Manage adminAccess records in the Firebase Console.');
    const email = str(req.body?.email, 120).toLowerCase();
    const name = str(req.body?.name, 80);
    if (!/^\S+@\S+\.\S+$/.test(email)) throw bad('Enter a valid email address.');
    if (name.length < 2) throw bad('Enter the admin’s name.');
    if (data().admins.some((a) => a.email === email)) throw bad('An admin with this email already exists.');
    const problem = passwordProblem(req.body?.password);
    if (problem) throw bad(problem);
    const admin = { id: newId('a_'), email, name, role: 'admin', passHash: await hashPassword(req.body.password), disabled: false, tokenVersion: 0, createdAt: new Date().toISOString() };
    data().admins.push(admin);
    audit(req.admin.email, 'admin.created', email);
    await save();
    res.status(201).json({ admin: publicAdmin(admin) });
  } catch (err) {
    next(err);
  }
});

router.patch('/admins/:id', requireOwner, async (req, res, next) => {
  try {
    if (firebaseAdminMode()) throw bad('Manage adminAccess records in the Firebase Console.');
    const a = data().admins.find((x) => x.id === req.params.id);
    if (!a) throw bad('Admin not found.', 404);
    if (a.id === req.admin.id && req.body?.disabled) throw bad('You cannot disable your own account.');
    if (a.role === 'owner' && a.id !== req.admin.id) throw bad('The owner account cannot be changed by others.', 403);
    if (req.body?.disabled !== undefined) { a.disabled = !!req.body.disabled; a.tokenVersion = (a.tokenVersion || 0) + 1; audit(req.admin.email, a.disabled ? 'admin.disabled' : 'admin.enabled', a.email); }
    if (req.body?.password !== undefined) {
      const problem = passwordProblem(req.body.password);
      if (problem) throw bad(problem);
      a.passHash = await hashPassword(req.body.password);
      a.tokenVersion = (a.tokenVersion || 0) + 1;
      audit(req.admin.email, 'admin.password.reset', a.email);
    }
    await save();
    res.json({ admin: publicAdmin(a) });
  } catch (err) {
    next(err);
  }
});

router.delete('/admins/:id', requireOwner, async (req, res, next) => {
  try {
    if (firebaseAdminMode()) throw bad('Manage adminAccess records in the Firebase Console.');
    const a = data().admins.find((x) => x.id === req.params.id);
    if (!a) throw bad('Admin not found.', 404);
    if (a.role === 'owner') throw bad('The owner account cannot be removed.');
    data().admins = data().admins.filter((x) => x !== a);
    audit(req.admin.email, 'admin.removed', a.email);
    await save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
