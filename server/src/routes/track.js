import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { data } from '../store.js';
import * as delhivery from '../delhivery.js';
import { applyPush, isActive, refreshOrder } from '../shipping.js';

// Public: order tracking for customers, PIN code checks, and Delhivery's status pushes.
export const trackRouter = Router();
export const shippingRouter = Router();
export const webhookRouter = Router();

const limit = (windowMs, max, message) => rateLimit({ windowMs, limit: max, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: message } });
const digits = (v) => String(v || '').replace(/\D/g, '').slice(-10);

const NOT_FOUND = { error: 'We could not find an order with these details. Check the order number and the mobile number used at checkout.' };

// Customers look an order up with the order number AND the mobile number they ordered with, so order numbers cannot be guessed.
// It is a POST so the phone number does not end up in links or logs.
trackRouter.post('/', limit(10 * 60 * 1000, 25, 'Too many tries. Please wait a few minutes.'), async (req, res, next) => {
  try {
    const id = String(req.body?.order || '').trim().toUpperCase();
    const phone = digits(req.body?.phone);
    const order = data().orders.find((o) => o.id === id);
    if (!order || phone.length < 10 || digits(order.customer.phone) !== phone) return res.status(404).json(NOT_FOUND);

    // Show fresh tracking when the parcel is on its way and our copy is a little old.
    let note = '';
    if (isActive(order) && delhivery.config.configured && Date.now() - (Date.parse(order.shipment.lastCheckedAt) || 0) > 10 * 60 * 1000) {
      try { await refreshOrder(order); } catch { note = 'Live tracking is busy right now. This is the latest we have.'; }
    }
    const s = order.shipment;
    return res.json({
      order: {
        id: order.id, placedAt: order.createdAt, status: order.status, city: order.customer.city,
        history: order.history.map((h) => ({ status: h.status, at: h.at })),
        items: order.items.map((i) => ({ name: i.name, qty: i.qty })),
      },
      shipment: s && !s.cancelled ? {
        carrier: 'Delhivery', waybill: s.waybill, url: delhivery.trackingUrl(s.waybill), stage: s.stage || 'booked', status: s.status || '', location: s.location || '',
        updatedAt: s.updatedAt || '', expectedDelivery: s.expectedDelivery || '', events: (s.events || []).map(({ at, text, detail, location }) => ({ at, text, detail, location })),
      } : null,
      note,
    });
  } catch (err) {
    return next(err);
  }
});

/* ---------- can we deliver to this PIN code? ---------- */

const cache = new Map(); // PIN -> { at, value }
shippingRouter.get('/check', limit(10 * 60 * 1000, 120, 'Too many checks. Please wait a few minutes.'), async (req, res) => {
  const pin = String(req.query.pin || '').trim();
  if (!/^[1-9]\d{5}$/.test(pin)) return res.status(400).json({ error: 'Enter a 6 digit PIN code.' });
  if (!delhivery.config.configured) return res.json({ configured: false });
  const hit = cache.get(pin);
  if (hit && Date.now() - hit.at < 6 * 3600 * 1000) return res.json({ configured: true, ...hit.value });
  try {
    const value = await delhivery.serviceability(pin);
    cache.set(pin, { at: Date.now(), value });
    return res.json({ configured: true, ...value });
  } catch {
    return res.status(503).json({ error: 'Delivery availability could not be checked. Please try again shortly.' });
  }
});

/* ---------- Delhivery pushes a status update here ---------- */

// Give Delhivery this address: https://YOUR-SERVER/api/webhooks/delhivery?key=YOUR_DELHIVERY_WEBHOOK_SECRET
webhookRouter.post('/delhivery', async (req, res) => {
  const secret = process.env.DELHIVERY_WEBHOOK_SECRET || '';
  if (!secret) return res.status(503).json({ error: 'Webhook not enabled.' });
  const given = Buffer.from(String(req.query.key || req.get('x-webhook-key') || ''));
  const want = Buffer.from(secret);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return res.status(401).json({ error: 'Not allowed.' });
  try { await applyPush(req.body); } catch (err) {
    console.error('Delhivery push failed:', err.message);
    return res.status(503).json({ error: 'Update could not be saved. Please retry.' });
  }
  return res.json({ ok: true }); // Delhivery wants a 200 for every push
});
