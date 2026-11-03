import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { UPLOAD_DIR, audit, data, save } from '../store.js';
import { couponResult } from '../content.js';

export const catalogRouter = Router();
export const contentRouter = Router();
export const couponRouter = Router();
export const ordersRouter = Router();

// What the shop sells and charges. The website loads this when it opens (see client/src/printProducts.js).
catalogRouter.get('/', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.json(data().catalog || {});
});

// The editable parts of the website: products, home page sections, reviews, categories.
contentRouter.get('/', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.json(data().content || {});
});

// Checks a coupon code against a basket. Rate limited so codes cannot be guessed by trying many.
const couponLimit = rateLimit({ windowMs: 10 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many tries. Please wait a few minutes.' } });
couponRouter.post('/check', couponLimit, (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase().slice(0, 30);
  const subtotal = Number(req.body?.subtotal) || 0;
  const coupon = data().coupons.find((c) => c.code === code);
  const r = couponResult(coupon, subtotal);
  if (r.error) return res.status(400).json({ error: r.error });
  return res.json({ code: coupon.code, description: coupon.description, discount: r.discount });
});

/* ---------- placing an order ---------- */

const orderLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many orders from this connection. Please try again later.' } });

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

function cleanCustomer(c) {
  const out = {
    name: str(c?.name, 80), phone: str(c?.phone, 20).replace(/[\s-]/g, '').replace(/^(\+91|0)/, ''), email: str(c?.email, 120).toLowerCase(),
    line1: str(c?.line1, 160), line2: str(c?.line2, 160), city: str(c?.city, 60), state: str(c?.state, 60), pin: str(c?.pin, 6), note: str(c?.note, 600),
  };
  if (out.name.length < 2) throw bad('Enter your full name.');
  if (!/^[6-9]\d{9}$/.test(out.phone)) throw bad('Enter a 10 digit Indian mobile number.');
  if (!/^\S+@\S+\.\S+$/.test(out.email)) throw bad('Enter a valid email address.');
  if (out.line1.length < 5 || out.city.length < 2 || out.state.length < 2) throw bad('Enter your full delivery address.');
  if (!/^[1-9]\d{5}$/.test(out.pin)) throw bad('Enter a 6 digit PIN code.');
  return out;
}

// A copy of a plain object, or null if it is not one or is unreasonably big.
const smallObject = (o) => {
  if (!o || typeof o !== 'object') return null;
  const json = JSON.stringify(o);
  return json.length <= 4000 ? JSON.parse(json) : null;
};

function cleanItems(items) {
  if (!Array.isArray(items) || !items.length) throw bad('Your cart is empty.');
  if (items.length > 30) throw bad('Too many items in one order.');
  return items.map((i) => {
    const qty = Math.round(Number(i?.qty));
    const unit = i?.unit == null ? null : Number(i.unit);
    if (!(qty >= 1 && qty <= 10000)) throw bad('Check the quantities in your cart.');
    if (unit != null && !(unit >= 0 && unit <= 1_000_000)) throw bad('Check the prices in your cart.');
    return {
      name: str(i?.name, 120) || 'Item', detail: str(i?.detail, 300), img: str(i?.img, 200), qty, unit: unit == null ? null : Math.round(unit * 100) / 100,
      slug: str(i?.slug, 80), config: smallObject(i?.config),
    };
  });
}

const DATA_URL = /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,([A-Za-z0-9+/=]+)$/;
const EXT = { png: 'png', jpeg: 'jpg', webp: 'webp', gif: 'gif', 'svg+xml': 'svg' };

// Keeps the design's layers, and saves each uploaded picture as a file instead of leaving it inside the order.
function cleanDesigns(designs, orderId) {
  if (!designs || typeof designs !== 'object') return {};
  const out = {};
  let files = 0;
  let bytes = 0;
  const dir = path.join(UPLOAD_DIR, orderId);
  for (const [slug, d] of Object.entries(designs).slice(0, 10)) {
    const sides = {};
    for (const side of ['front', 'back', 'left', 'right']) {
      const layers = Array.isArray(d?.[side]) ? d[side].slice(0, 60) : [];
      sides[side] = layers.map((raw) => {
        const layer = JSON.parse(JSON.stringify(raw ?? {}));
        if (layer.type === 'image' && layer.image) {
          const m = DATA_URL.exec(String(layer.image.src || ''));
          if (!m) { layer.image = { name: str(layer.image.name, 120), nw: layer.image.nw, ratio: layer.image.ratio, file: null }; return layer; }
          const buf = Buffer.from(m[2], 'base64');
          bytes += buf.length;
          if (buf.length > 15 * 1024 * 1024 || bytes > 45 * 1024 * 1024 || files >= 40) throw bad('The artwork in this order is too large.');
          fs.mkdirSync(dir, { recursive: true });
          const name = `${crypto.randomBytes(5).toString('hex')}.${EXT[m[1]]}`;
          fs.writeFileSync(path.join(dir, name), buf);
          files += 1;
          layer.image = { name: str(layer.image.name, 120), nw: layer.image.nw, ratio: layer.image.ratio, file: name };
        }
        return layer;
      });
    }
    out[str(slug, 80)] = { ...sides, mode: d?.mode === 'full' ? 'full' : 'normal' };
  }
  return out;
}

ordersRouter.post('/', orderLimit, (req, res, next) => {
  try {
    const body = req.body || {};
    const id = `PE-${Date.now().toString(36).toUpperCase().slice(-6)}${crypto.randomBytes(1).toString('hex').toUpperCase()}`;
    const customer = cleanCustomer(body.customer);
    const items = cleanItems(body.items);
    const payment = body.payment === 'upi' ? 'upi' : 'cod';
    const subtotal = Math.round(items.reduce((n, i) => n + (i.unit == null ? 0 : i.unit * i.qty), 0) * 100) / 100; // always worked out here
    // A coupon is checked again here: the amount is never taken from the browser.
    const code = str(body.coupon, 30).toUpperCase();
    let coupon = null;
    let discount = 0;
    const found = code ? data().coupons.find((c) => c.code === code) : null;
    if (code) {
      const r = couponResult(found, subtotal);
      if (r.error) throw bad(r.error);
      discount = r.discount;
      coupon = { code: found.code, type: found.type, value: found.value, discount };
    }
    const wishlist = Array.isArray(body.wishlist) ? body.wishlist.slice(0, 30).map((w) => ({ name: str(w?.name, 120), href: str(w?.href, 200) })) : [];
    const designs = cleanDesigns(body.designs, id);
    const now = new Date().toISOString();
    const order = {
      id, createdAt: now, status: 'placed', customer, payment, items, designs, subtotal, coupon, discount, total: Math.round((subtotal - discount) * 100) / 100, unpriced: items.filter((i) => i.unit == null).length,
      wishlist, adminNote: '', history: [{ at: now, status: 'placed', by: 'customer' }],
    };
    data().orders.unshift(order);
    if (found && coupon) found.used += 1;
    audit('customer', 'order.placed', `${id} · ${customer.name}`);
    save();
    res.status(201).json({ id, placedAt: now, subtotal, discount, total: order.total, unpriced: order.unpriced });
  } catch (err) {
    next(err);
  }
});


