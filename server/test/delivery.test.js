import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pe-delivery-test-'));
Object.assign(process.env, { DATA_DIR: dir, NODE_ENV: 'development', JWT_SECRET: 'delivery-test-secret-at-least-32-characters', DELHIVERY_TOKEN: 'test-only', DELHIVERY_PICKUP_LOCATION: 'Test Warehouse', DELHIVERY_WEBHOOK_SECRET: 'test-webhook', R2_BUCKET: '', R2_REQUIRED: 'false' });
const listen = (app) => new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
let service = { pre_paid: 'Y', cod: 'Y', district: 'Kolkata', state_code: 'WB' };
let courierError = 0;
let createError = 0;
let cancelConfirmed = true;
let created = 0;
let releaseBooking;
let bookingArrived;
let recovered = null;
const carrier = express();
carrier.use(express.json(), express.urlencoded({ extended: false }));
carrier.get('/c/api/pin-codes/json/', (req, res) => courierError ? res.status(courierError).json({ error: 'Unavailable' }) : res.json({ delivery_codes: service ? [{ postal_code: service }] : [] }));
carrier.post('/api/cmu/create.json', async (req, res) => {
  created++;
  if (bookingArrived) { bookingArrived(); await new Promise((resolve) => { releaseBooking = resolve; }); }
  if (createError) return res.status(createError).json({ error: 'Failure' });
  const payload = JSON.parse(req.body.data);
  assert.ok(payload.pickup_location.name);
  res.json({ success: true, packages: [{ waybill: `TESTAWB${created}` }] });
});
carrier.get('/api/v1/packages/json/', (req, res) => {
  if (req.query.ref_ids) return res.json({ ShipmentData: recovered ? [{ Shipment: recovered }] : [] });
  res.json({ ShipmentData: [{ Shipment: { AWB: req.query.waybill, Status: { Status: 'Manifested', StatusType: 'UD', StatusDateTime: '2026-11-07T09:00:00+05:30' } } }] });
});
carrier.get('/api/p/packing_slip', (req, res) => res.type('pdf').send(Buffer.from('%PDF-1.4\ntest label')));
carrier.post('/api/p/edit', (req, res) => cancelConfirmed ? res.json({ status: true }) : res.status(500).json({ error: 'Unavailable' }));
carrier.post('/fm/request/new/', (req, res) => res.json({ pickup_id: 123 }));
const carrierServer = await listen(carrier);
process.env.DELHIVERY_BASE = `http://127.0.0.1:${carrierServer.address().port}`;

const { data, save, UPLOAD_DIR } = await import('../src/store.js');
const { default: admin } = await import('../src/routes/admin.js');
const { ordersRouter } = await import('../src/routes/public.js');
const { trackRouter, shippingRouter, webhookRouter } = await import('../src/routes/track.js');
const { applyTracking, scanTime, pollActive } = await import('../src/shipping.js');
const { cleanupOrderAssets } = await import('../src/assetRetention.js');
const courier = await import('../src/delhivery.js');
data().admins.push({ id: 'test-owner', email: 'owner@example.com', name: 'Owner', role: 'owner', tokenVersion: 0 });
const cookie = `pe_admin=${jwt.sign({ sub: 'test-owner', tv: 0 }, process.env.JWT_SECRET)}`;
const app = express();
app.use(express.json(), cookieParser());
app.use('/admin', admin);
app.use('/orders', ordersRouter);
app.use('/track', trackRouter);
app.use('/shipping', shippingRouter);
app.use('/webhooks', webhookRouter);
app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
const server = await listen(app);
const url = `http://127.0.0.1:${server.address().port}`;
async function request(route, body, { authenticated = true, method = body === undefined ? 'GET' : 'POST' } = {}) {
  return fetch(url + route, { method, headers: { 'Content-Type': 'application/json', ...(authenticated ? { Cookie: cookie, 'X-Admin-Request': '1' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
}
const customer = { name: 'Test Customer', phone: '9876543210', email: 'test@example.com', line1: '123 Test Street', city: 'Kolkata', state: 'West Bengal', pin: '700001' };
const parcel = { weight: 300, length: 25, width: 20, height: 4 };
async function order(payment = 'cod') {
  const r = await request('/orders', { customer, payment, items: [{ name: 'Test tee', qty: 1, unit: 500 }] });
  assert.equal(r.status, 201, await r.clone().text());
  return data().orders[0];
}
// Header secret avoids putting credentials into request URLs or logs.
async function webhook(o, status, at, type = 'UD', secret = 'test-webhook') {
  return fetch(`${url}/webhooks/delhivery`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-webhook-key': secret }, body: JSON.stringify({ Shipment: { AWB: o.shipment.waybill, Status: { Status: status, StatusType: type, StatusDateTime: at } } }) });
}

test('checkout enforces courier serviceability and payment capabilities', async () => {
  service.cod = 'N';
  assert.equal((await request('/orders', { customer, payment: 'cod', items: [{ name: 'Tee', qty: 1, unit: 500 }] })).status, 400);
  service.cod = 'Y';
  service.pre_paid = 'N';
  assert.equal((await request('/orders', { customer, payment: 'upi', items: [{ name: 'Tee', qty: 1, unit: 500 }] })).status, 400);
  service.pre_paid = 'Y';
  courierError = 500;
  await assert.rejects(courier.serviceability('700001'), /500/);
  assert.equal((await request('/shipping/check?pin=700001')).status, 503);
  courierError = 0;
});

test('prepaid booking requires authenticated payment confirmation', async () => {
  const o = await order('upi');
  const route = `/admin/orders/${o.id}`;
  assert.equal((await request(`${route}/shipment`, parcel)).status, 400);
  assert.equal((await request(`${route}/payment`, { amount: 500, reference: 'UTR-TEST' }, { authenticated: false })).status, 401);
  assert.equal((await request(`${route}/payment`, { amount: 0, reference: 'UTR-TEST' })).status, 400);
  assert.equal((await request(`${route}/payment`, { amount: 550, reference: 'UTR-TEST' })).status, 200);
  assert.equal(o.confirmedTotal, 550);
  assert.equal((await request(`${route}/shipment`, parcel)).status, 201);
  assert.equal((await request(`${route}/shipment/label`)).headers.get('content-type'), 'application/pdf');
  assert.equal(o.shipment.parcel.declaredValue, 550);
});

test('parallel booking is serialized and a second shipment is refused', async () => {
  const o = await order();
  const route = `/admin/orders/${o.id}/shipment`;
  const before = created;
  const arrived = new Promise((resolve) => { bookingArrived = resolve; });
  const first = request(route, parcel);
  await arrived;
  assert.equal((await request(route, parcel)).status, 409);
  releaseBooking();
  assert.equal((await first).status, 201);
  bookingArrived = null;
  assert.equal(created - before, 1);
  assert.equal((await request(route, parcel)).status, 409);
});

test('lost courier response blocks retry and reconciliation recovers its AWB', async () => {
  const o = await order();
  const route = `/admin/orders/${o.id}/shipment`;
  createError = 500;
  assert.equal((await request(route, parcel)).status, 502);
  createError = 0;
  assert.equal(o.bookingAttempt.state, 'uncertain');
  assert.equal((await request(route, parcel)).status, 409);
  recovered = { AWB: 'RECOVERED123', ReferenceNo: o.id, Status: { Status: 'Manifested', StatusType: 'UD', StatusDateTime: '2026-11-07T09:00:00+05:30' } };
  assert.equal((await request(`${route}/reconcile`, {})).status, 200);
  assert.equal(o.shipment.waybill, 'RECOVERED123');
  recovered = null;
});

test('manual AWB cannot be reused on another order', async () => {
  const o = await order();
  const other = data().orders.find((x) => x !== o && x.shipment);
  assert.equal((await request(`/admin/orders/${o.id}/shipment`, { mode: 'manual', waybill: other.shipment.waybill })).status, 409);
  assert.equal((await request(`/admin/orders/${o.id}/shipment`, { mode: 'manual', waybill: '' })).status, 400);
});

test('webhooks require secret, retain historical scans, prevent regression and delete only after persistence', async () => {
  const o = await order();
  assert.equal((await request(`/admin/orders/${o.id}/shipment`, parcel)).status, 201);
  const folder = path.join(UPLOAD_DIR, o.id);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'art.png'), 'test');
  o.designs = { test: { front: [{ type: 'image', image: { file: 'art.png' } }] } };
  await save();
  assert.equal((await webhook(o, 'Pending', '2026-11-07T10:00:00+05:30', 'UD', 'wrong')).status, 401);
  assert.equal(fs.existsSync(folder), true);
  const rename = fs.promises.rename;
  fs.promises.rename = async () => { throw new Error('Simulated disk outage'); };
  try { assert.equal((await webhook(o, 'Pending', '2026-11-07T10:00:00+05:30')).status, 503); }
  finally { fs.promises.rename = rename; }
  assert.equal(fs.existsSync(folder), true);
  assert.equal((await webhook(o, 'Pending', '2026-11-07T10:00:00+05:30')).status, 200);
  assert.equal(o.shipment.stage, 'in_transit');
  for (let i = 0; i < 50 && !o.assetsDeletedAt; i++) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(fs.existsSync(folder), false);
  assert.equal((await request(`/admin/orders/${o.id}/files/art.png`)).status, 410);
  await webhook(o, 'Delivered', '2026-11-08T15:00:00+05:30', 'DL');
  await webhook(o, 'In Transit', '2026-11-07T11:00:00+05:30');
  assert.equal(o.shipment.stage, 'delivered');
  assert.equal(o.status, 'delivered');
  const count = o.shipment.events.length;
  await webhook(o, 'In Transit', '2026-11-07T11:00:00+05:30');
  assert.equal(o.shipment.events.length, count);
  assert.ok(o.shipment.events.some((e) => e.text === 'In Transit'));
  assert.equal((await request('/track', { order: o.id, phone: '9876543210' }, { authenticated: false })).status, 200);
  assert.equal((await request('/track', { order: o.id, phone: '9876543211' }, { authenticated: false })).status, 404);
});

test('failed cancellation keeps shipment active; confirmed cancellation permits rebooking', async () => {
  const o = await order();
  const route = `/admin/orders/${o.id}/shipment`;
  await request(route, parcel);
  cancelConfirmed = false;
  assert.equal((await request(`${route}/cancel`, {})).status, 502);
  assert.ok(!o.shipment.cancelled);
  cancelConfirmed = true;
  assert.equal((await request(`${route}/cancel`, {})).status, 200);
  assert.equal(o.shipment.stage, 'cancelled');
  assert.equal((await request(route, parcel)).status, 201);
});

test('pickup rejects past dates and accepts a future India-time request', async () => {
  assert.equal((await request('/admin/shipping/pickup', { date: '2020-01-01', time: '15:00', count: 1 })).status, 400);
  assert.equal((await request('/admin/shipping/pickup', { date: '2099-01-01', time: '15:00', count: 1 })).status, 200);
});

test('polling checks shipments without previous timestamps; status parsing handles carrier Pending and soft hyphens', async () => {
  const o = await order();
  o.shipment = { waybill: 'POLLTEST123', stage: 'booked', events: [] };
  const result = await pollActive({ olderThanMs: 0 });
  assert.ok(result.checked >= 1);
  assert.ok(o.shipment.lastCheckedAt);
  assert.equal(courier.stageOf('Pending', 'UD'), 'in_transit');
  assert.equal(courier.stageOf('In\u00ad Transit', 'UD'), 'in_transit');
  assert.equal(courier.stageOf('In Transit', 'RT'), 'returning');
  assert.equal(courier.stageOf('RTO', 'DL'), 'returned');
  assert.equal(scanTime('2026-11-07T10:00:00'), scanTime('2026-11-07T04:30:00Z'));
});

test('cleanup never removes artwork before durable dispatch; persistence can recover', async () => {
  const o = { id: 'durability-test', dispatchedAt: new Date().toISOString() };
  await assert.rejects(cleanupOrderAssets(o, { persist: async () => { throw new Error('disk outage'); }, remove: () => assert.fail('must not remove') }), /disk outage/);
  const rename = fs.promises.rename;
  fs.promises.rename = async () => { throw new Error('disk outage'); };
  try { await assert.rejects(save(), /disk outage/); } finally { fs.promises.rename = rename; }
  await save();
  assert.ok(JSON.parse(fs.readFileSync(path.join(dir, 'db.json'), 'utf8')).orders.length);
});

test('single-writer lock prevents a second process from using the same database', async () => {
  const { acquireStoreLock } = await import('../src/processLock.js');
  const release = acquireStoreLock();
  try { assert.throws(acquireStoreLock, /Another server/); }
  finally { release(); }
  const again = acquireStoreLock();
  again();
});

test.after(async () => {
  await save();
  await Promise.all([new Promise((resolve) => server.close(resolve)), new Promise((resolve) => carrierServer.close(resolve))]);
  assert.equal(path.dirname(dir), path.resolve(os.tmpdir()));
  fs.rmSync(dir, { recursive: true, force: true });
});
