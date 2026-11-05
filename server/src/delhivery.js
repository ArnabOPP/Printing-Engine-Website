// Talks to Delhivery's Express (B2C) API.
//
// Built from Delhivery's public API as documented for Delhivery One / the Express API. Their full documentation is behind
// the Delhivery One login, so confirm the details below with your account (use the staging environment first).
//
// Everything is switched on by DELHIVERY_TOKEN. Without it the shop still works: the team can type in an AWB by hand and
// customers get a link to Delhivery's own tracking page.

const ENV = (process.env.DELHIVERY_ENV || 'staging').toLowerCase();
export const BASE = (process.env.DELHIVERY_BASE || (ENV === 'production' ? 'https://track.delhivery.com' : 'https://staging-express.delhivery.com')).replace(/\/$/, '');
const TOKEN = process.env.DELHIVERY_TOKEN || '';

export const config = {
  configured: Boolean(TOKEN),
  env: ENV === 'production' ? 'production' : 'staging',
  pickupLocation: process.env.DELHIVERY_PICKUP_LOCATION || '',
  webhookReady: Boolean(process.env.DELHIVERY_WEBHOOK_SECRET),
  returnAddress: {
    name: process.env.DELHIVERY_RETURN_NAME || '',
    add: process.env.DELHIVERY_RETURN_ADDRESS || '',
    city: process.env.DELHIVERY_RETURN_CITY || '',
    state: process.env.DELHIVERY_RETURN_STATE || '',
    pin: process.env.DELHIVERY_RETURN_PIN || '',
    phone: process.env.DELHIVERY_RETURN_PHONE || '',
  },
  seller: { name: process.env.SELLER_NAME || '', gst: process.env.SELLER_GST || '' },
};

export const trackingUrl = (awb) => `https://www.delhivery.com/track-v2/package/${encodeURIComponent(awb)}`;

// `expose`: the message is safe and useful to show to the admin who triggered the call.
const fail = (msg, status = 502) => Object.assign(new Error(msg), { status, expose: true });

async function call(path, { method = 'GET', body, form, query, raw = false } = {}) {
  if (!TOKEN) throw fail('Delhivery is not set up yet.', 503);
  const url = new URL(BASE + path);
  Object.entries(query || {}).forEach(([k, v]) => url.searchParams.set(k, v));
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const res = await fetch(url, {
      method,
      signal: ctl.signal,
      headers: {
        Authorization: `Token ${TOKEN}`,
        Accept: 'application/json',
        ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: form || (body ? JSON.stringify(body) : undefined),
    });
    if (raw) {
      if (!res.ok) throw fail(`Delhivery answered ${res.status}.`);
      return res;
    }
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = null; }
    if (res.status === 401 || res.status === 403) throw fail('Delhivery rejected the API token. Check DELHIVERY_TOKEN and whether it matches the environment (staging or production).', 502);
    if (!res.ok && !json) throw fail(`Delhivery answered ${res.status}.`);
    return json ?? {};
  } catch (err) {
    if (err.name === 'AbortError') throw fail('Delhivery took too long to answer. Try again.', 504);
    if (err.status) throw err;
    throw fail('Could not reach Delhivery.', 502);
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- is this PIN code served? ---------- */

export async function serviceability(pin) {
  const json = await call('/c/api/pin-codes/json/', { query: { filter_codes: pin } });
  const p = json?.delivery_codes?.[0]?.postal_code;
  if (!p) return { serviceable: false };
  const yes = (v) => String(v).toUpperCase() === 'Y';
  return {
    serviceable: yes(p.pre_paid) || yes(p.cod),
    prepaid: yes(p.pre_paid),
    cod: yes(p.cod),
    city: p.district || p.city || '',
    state: p.state_code || p.inc || '',
  };
}

/* ---------- tracking ---------- */

// The customer-friendly stage of a parcel, from Delhivery's status words and codes.
export function stageOf(status = '', type = '') {
  const s = String(status).toLowerCase();
  const t = String(type).toUpperCase();
  if (t === 'DL' || (/delivered/.test(s) && !/undelivered/.test(s))) return 'delivered';
  if (t === 'RT' || /rto|return/.test(s)) return 'returned';
  if (t === 'CN' || /cancel/.test(s)) return 'cancelled';
  if (/out for delivery|dispatched/.test(s)) return 'out_for_delivery';
  if (/manifest|pickup (pending|scheduled|requested)|not picked|awaiting/.test(s) || t === 'PP') return 'booked';
  return 'in_transit';
}

export function normaliseTracking(json) {
  const sh = json?.ShipmentData?.[0]?.Shipment;
  if (!sh) return null;
  const st = sh.Status || {};
  const events = (sh.Scans || []).map((x) => x.ScanDetail || x).map((d) => ({
    at: d.ScanDateTime || d.StatusDateTime || '',
    text: d.Scan || d.Instructions || '',
    detail: d.Instructions && d.Instructions !== d.Scan ? d.Instructions : '',
    location: d.ScannedLocation || '',
    code: d.StatusCode || '',
  })).filter((e) => e.text).sort((a, b) => (a.at < b.at ? 1 : -1));
  return {
    status: st.Status || '',
    statusType: st.StatusType || '',
    stage: stageOf(st.Status, st.StatusType),
    location: st.StatusLocation || '',
    updatedAt: st.StatusDateTime || events[0]?.at || '',
    instructions: st.Instructions || '',
    expectedDelivery: sh.ExpectedDeliveryDate || sh.PromisedDeliveryDate || '',
    events,
  };
}

export async function track(awb) {
  const json = await call('/api/v1/packages/json/', { query: { waybill: awb } });
  const t = normaliseTracking(json);
  if (!t) throw fail('Delhivery has no tracking for this AWB yet.', 404);
  return t;
}

/* ---------- booking ---------- */

export async function createShipment({ order, parcel, codAmount }) {
  if (!config.pickupLocation) throw fail('Set DELHIVERY_PICKUP_LOCATION to the exact pickup location name from your Delhivery account.', 503);
  const c = order.customer;
  const qty = order.items.reduce((n, i) => n + i.qty, 0);
  const cod = order.payment === 'cod';
  const total = order.total ?? order.subtotal;
  const r = config.returnAddress;
  const shipment = {
    name: c.name, add: [c.line1, c.line2].filter(Boolean).join(', '), pin: c.pin, city: c.city, state: c.state, country: 'India', phone: c.phone,
    order: order.id, payment_mode: cod ? 'COD' : 'Prepaid', cod_amount: cod ? String(codAmount ?? total) : '0', total_amount: String(parcel.declaredValue ?? total),
    products_desc: parcel.description || order.items.map((i) => i.name).join(', ').slice(0, 200), quantity: String(qty),
    weight: String(parcel.weight), shipment_length: String(parcel.length), shipment_width: String(parcel.width), shipment_height: String(parcel.height),
    order_date: order.createdAt, shipping_mode: 'Surface',
    ...(config.seller.name ? { seller_name: config.seller.name } : {}), ...(config.seller.gst ? { seller_gst_tin: config.seller.gst } : {}),
    ...(r.add ? { return_name: r.name, return_add: r.add, return_city: r.city, return_state: r.state, return_pin: r.pin, return_phone: r.phone, return_country: 'India' } : {}),
  };
  const data = { shipments: [shipment], pickup_location: { name: config.pickupLocation } };
  const json = await call('/api/cmu/create.json', { method: 'POST', form: `format=json&data=${encodeURIComponent(JSON.stringify(data))}` });
  const pkg = json?.packages?.[0];
  if (!json?.success || !pkg?.waybill) {
    const why = [json?.rmk, ...[].concat(pkg?.remarks || [])].filter(Boolean).join(' ') || 'Delhivery did not accept the shipment.';
    throw fail(`Delhivery: ${why}`, 422);
  }
  return { waybill: String(pkg.waybill), sortCode: pkg.sort_code || '' };
}

export async function cancelShipment(awb) {
  const json = await call('/api/p/edit', { method: 'POST', body: { waybill: awb, cancellation: 'true' } });
  if (json?.status === false || json?.success === false) throw fail(`Delhivery: ${json.error || json.message || 'could not cancel this shipment.'}`, 422);
  return true;
}

export async function requestPickup({ date, time, count }) {
  if (!config.pickupLocation) throw fail('Set DELHIVERY_PICKUP_LOCATION first.', 503);
  const json = await call('/fm/request/new/', { method: 'POST', body: { pickup_time: time, pickup_date: date, pickup_location: config.pickupLocation, expected_package_count: count } });
  if (json?.pickup_id == null && !json?.incoming_center_name) throw fail(`Delhivery: ${json?.error || json?.message || 'could not schedule the pickup.'}`, 422);
  return { id: json.pickup_id ?? null };
}

// The shipping label (a PDF) for an AWB.
export async function label(awb) {
  const res = await call('/api/p/packing_slip', { query: { wbns: awb, pdf: 'true' }, raw: true });
  const type = res.headers.get('content-type') || '';
  if (type.includes('pdf')) return { pdf: Buffer.from(await res.arrayBuffer()) };
  const json = await res.json().catch(() => ({}));
  const link = json?.packages?.[0]?.pdf_download_link;
  if (link && /^https:\/\//.test(link)) {
    const pdf = await fetch(link);
    if (pdf.ok) return { pdf: Buffer.from(await pdf.arrayBuffer()) };
  }
  throw fail('Delhivery did not return a label for this AWB yet.', 404);
}
