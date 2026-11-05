import { audit, data, save } from './store.js';
import * as delhivery from './delhivery.js';

// Keeps each order's shipment up to date from Delhivery's tracking, and moves the order's own status forward to match.

const TERMINAL = ['delivered', 'returned', 'cancelled'];
const ORDER_FLOW = ['placed', 'confirmed', 'printing', 'ready', 'shipped', 'delivered'];

const setStatus = (order, status, by) => {
  if (order.status === status || order.status === 'cancelled') return;
  order.status = status;
  order.history.push({ at: new Date().toISOString(), status, by });
  audit(by, 'order.status', `${order.id} → ${status}`);
};

// An order only moves forward on its own (never back, never out of a delivered or cancelled state).
function advance(order, stage) {
  const at = ORDER_FLOW.indexOf(order.status);
  if (at < 0) return;
  const target = { booked: 'ready', in_transit: 'shipped', out_for_delivery: 'shipped', delivered: 'delivered' }[stage];
  if (target && ORDER_FLOW.indexOf(target) > at) setStatus(order, target, 'delhivery');
}

const sameEvent = (a, b) => a.at === b.at && a.text === b.text;

// `t` is tracking in our shape (see delhivery.normaliseTracking). Events are merged so a push never loses earlier scans.
export function applyTracking(order, t) {
  const s = order.shipment;
  if (!s) return;
  const events = [...(t.events || []), ...(s.events || []).filter((old) => !(t.events || []).some((n) => sameEvent(n, old)))].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 80);
  Object.assign(s, {
    status: t.status || s.status, statusType: t.statusType || s.statusType, stage: t.stage || s.stage, location: t.location ?? s.location,
    updatedAt: t.updatedAt || s.updatedAt, instructions: t.instructions ?? s.instructions, expectedDelivery: t.expectedDelivery || s.expectedDelivery,
    events, lastCheckedAt: new Date().toISOString(),
  });
  advance(order, s.stage);
}

export async function refreshOrder(order) {
  if (!order.shipment?.waybill) return null;
  const t = await delhivery.track(order.shipment.waybill);
  applyTracking(order, t);
  await save();
  return order.shipment;
}

export const isActive = (order) => order.shipment?.waybill && !order.shipment.cancelled && !TERMINAL.includes(order.shipment.stage || '');

// Checks every parcel that is still on its way. Runs now and then in the background and from the admin panel.
export async function pollActive({ olderThanMs = 20 * 60 * 1000 } = {}) {
  if (!delhivery.config.configured) return { checked: 0, failed: 0 };
  const due = data().orders.filter((o) => isActive(o) && Date.now() - Date.parse(o.shipment.lastCheckedAt || 0) > olderThanMs);
  let checked = 0;
  let failed = 0;
  for (const o of due) {
    try { applyTracking(o, await delhivery.track(o.shipment.waybill)); checked += 1; } catch { failed += 1; }
  }
  if (checked) await save();
  return { checked, failed };
}

// Delhivery's push ("webhook") sends one scan at a time: { Shipment: { AWB, Status: { Status, StatusType, StatusDateTime, StatusLocation, Instructions } } }.
// The shape is read loosely, because accounts can be set up with slightly different payloads.
export function applyPush(body) {
  const list = Array.isArray(body) ? body : [body];
  let updated = 0;
  for (const item of list) {
    const sh = item?.Shipment || item?.shipment || item;
    const awb = String(sh?.AWB || sh?.awb || sh?.waybill || '');
    const order = awb && data().orders.find((o) => o.shipment?.waybill === awb);
    if (!order) continue;
    const st = sh.Status || sh.status || {};
    const status = typeof st === 'string' ? st : st.Status || '';
    const type = typeof st === 'string' ? '' : st.StatusType || '';
    const at = (typeof st === 'object' && (st.StatusDateTime || st.ScanDateTime)) || new Date().toISOString();
    const location = (typeof st === 'object' && st.StatusLocation) || '';
    const instructions = (typeof st === 'object' && st.Instructions) || '';
    applyTracking(order, {
      status, statusType: type, stage: delhivery.stageOf(status, type), location, updatedAt: at, instructions,
      expectedDelivery: sh.ExpectedDeliveryDate || '', events: [{ at, text: status, detail: instructions, location, code: (typeof st === 'object' && st.StatusCode) || '' }],
    });
    updated += 1;
  }
  if (updated) save();
  return updated;
}
