import * as courier from './delhivery.js';
import { audit, data, save } from './store.js';
import { applyTracking } from './shipping.js';

const active = new Set();
const problem = (message, status = 409) => Object.assign(new Error(message), { status, expose: true });
export async function withShipmentLock(order, action) {
  if (active.has(order.id)) throw problem('A shipment operation is already running for this order. Refresh before trying again.');
  active.add(order.id);
  try { return await action(); } finally { active.delete(order.id); }
}

function attach(order, shipment, by) {
  if (data().orders.some((o) => o !== order && o.shipment?.waybill === shipment.waybill)) throw problem('This AWB is already attached to another order.');
  order.shipment = shipment;
  order.bookingAttempt = { ...order.bookingAttempt, state: 'complete', waybill: shipment.waybill };
  applyTracking(order, { stage: 'booked' });
  audit(by, 'shipment.created', `${order.id} · ${shipment.waybill}`);
}

export async function bookShipment(order, { manualWaybill, parcel, codAmount, by }, api = courier) {
  return withShipmentLock(order, async () => {
    if (order.shipment && !order.shipment.cancelled) throw problem('This order already has a shipment.');
    if (['cancelled', 'delivered'].includes(order.status)) throw problem('This order cannot be shipped in its current status.');
    if (order.payment !== 'cod' && order.paymentStatus !== 'paid') throw problem('Confirm that online payment has been received before booking a prepaid shipment.', 400);
    await api.checkDestination(order.customer.pin, order.payment);
    if (!manualWaybill && ['pending', 'uncertain'].includes(order.bookingAttempt?.state)) {
      throw problem('A previous booking may have reached Delhivery. Reconcile it or enter its AWB instead of booking again.');
    }
    const now = new Date().toISOString();
    if (manualWaybill) {
      if (!/^[A-Za-z0-9-]{6,30}$/.test(manualWaybill)) throw problem('Enter a valid courier AWB.', 400);
      if (data().orders.some((o) => o !== order && o.shipment?.waybill === manualWaybill)) throw problem('This AWB is already attached to another order.');
      let tracking;
      if (api.config.configured) {
        tracking = await api.track(manualWaybill);
        if (tracking.orderId && tracking.orderId !== order.id) throw problem('That AWB belongs to a different courier order.');
      }
      attach(order, { carrier: 'delhivery', waybill: manualWaybill, createdVia: 'manual', stage: 'booked', status: 'Booked', events: [], createdAt: now }, by);
      if (tracking) applyTracking(order, tracking, { checked: true });
      await save();
      return order;
    }
    if (order.payment === 'cod' && (!Number.isFinite(codAmount) || codAmount < 0)) throw problem('Enter the full cash amount to collect.', 400);
    order.bookingAttempt = { state: 'pending', startedAt: now };
    // A restart during the external request leaves a durable uncertainty marker.
    await save();
    let result;
    try { result = await api.createShipment({ order, parcel, codAmount }); }
    catch (err) {
      order.bookingAttempt.state = err.status === 422 && (!err.courierStatus || err.courierStatus < 500) ? 'rejected' : 'uncertain';
      await save();
      throw err;
    }
    attach(order, { carrier: 'delhivery', waybill: result.waybill, createdVia: 'api', stage: 'booked', status: 'Manifested', events: [], parcel, codAmount: codAmount ?? 0, createdAt: now }, by);
    await save();
    return order;
  });
}

export async function reconcileBooking(order, by, api = courier) {
  return withShipmentLock(order, async () => {
    if (order.shipment && !order.shipment.cancelled) { await save(); return { order, found: true }; }
    const tracking = await api.findShipment(order.id);
    if (!tracking) return { order, found: false };
    attach(order, { carrier: 'delhivery', waybill: tracking.waybill, createdVia: 'api', stage: 'booked', events: [], createdAt: new Date().toISOString() }, by);
    applyTracking(order, tracking, { checked: true });
    await save();
    return { order, found: true };
  });
}
