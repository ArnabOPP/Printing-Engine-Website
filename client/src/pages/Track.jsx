import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ChevronRight, Copy, ExternalLink, MapPin, PackageCheck, Truck } from 'lucide-react';
import { api } from '../api.js';

const STEPS = [
  ['placed', 'Order placed'], ['confirmed', 'Confirmed'], ['printing', 'Printing'], ['ready', 'Ready to ship'],
  ['shipped', 'On its way'], ['out', 'Out for delivery'], ['delivered', 'Delivered'],
];

const fmt = (iso, withTime = true) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : { year: 'numeric' }) });
};

// Where the order is on the 7 steps (0 to 6).
function stepOf(order, shipment) {
  if (order.status === 'delivered' || shipment?.stage === 'delivered') return 6;
  if (shipment?.stage === 'out_for_delivery') return 5;
  const i = STEPS.findIndex(([k]) => k === order.status);
  return Math.max(0, i);
}

const headline = (order, shipment, step) => {
  if (order.status === 'cancelled') return 'This order was cancelled.';
  if (shipment?.stage === 'returning') return 'The parcel is being returned to us. We will contact you.';
  if (shipment?.stage === 'returned') return 'The parcel was returned to us. We will contact you.';
  if (shipment?.stage === 'cancelled') return 'This shipment was cancelled. We will contact you about the next steps.';
  return ({
    0: 'We have your order and will confirm it shortly.', 1: 'Your order is confirmed.', 2: 'Your order is being printed.',
    3: 'Printed and packed. Waiting for the courier.', 4: 'Your parcel is on its way.', 5: 'Your parcel is out for delivery today.', 6: 'Delivered. Thank you!',
  })[step];
};

function readSaved() {
  try { const o = JSON.parse(localStorage.getItem('orders') || '[]'); return Array.isArray(o) ? o : []; } catch { return []; }
}

export default function Track() {
  const [params, setParams] = useSearchParams();
  const saved = useMemo(readSaved, []);
  const [form, setForm] = useState({ order: params.get('order') || '', phone: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const lookup = useCallback(async (order, phone) => {
    setBusy(true);
    setError('');
    try {
      setResult(await api('/api/track', { method: 'POST', body: { order, phone } }));
    } catch (e) {
      setResult(null);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, []);

  // Opened from "My orders" or the order confirmation: if the order was placed on this device, its phone number is known.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const id = (params.get('order') || '').toUpperCase();
    const mine = saved.find((o) => o.id === id);
    if (mine) { setForm({ order: mine.id, phone: mine.customer.phone }); lookup(mine.id, mine.customer.phone); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e) => {
    e.preventDefault();
    if (!form.order.trim() || !form.phone.trim()) { setError('Enter your order number and mobile number.'); return; }
    setParams({ order: form.order.trim().toUpperCase() }, { replace: true });
    lookup(form.order.trim(), form.phone.trim());
  };

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };

  const o = result?.order;
  const s = result?.shipment;
  const step = o ? stepOf(o, s) : 0;
  const stepTime = (key) => o?.history.find((h) => h.status === key)?.at;
  const cancelled = o?.status === 'cancelled';

  return (
    <div className="wrap tk">
      <nav className="pd-crumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link><ChevronRight size={12} /><b>Track order</b>
      </nav>
      <h1>Track your order</h1>
      <p className="co-lead">Enter your order number (it looks like PE-1A2B3C) and the mobile number you used at checkout.</p>

      <form className="tk-form" onSubmit={submit} noValidate>
        <label className="co-field"><span>Order number</span>
          <input value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value.toUpperCase() })} placeholder="PE-1A2B3C" autoComplete="off" />
        </label>
        <label className="co-field"><span>Mobile number</span>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" autoComplete="tel" placeholder="98765 43210" maxLength={14} />
        </label>
        <button className="btn btn-lime-solid" disabled={busy}>{busy ? 'Checking…' : 'Track'}</button>
      </form>
      {error && <p className="co-alert tk-error" role="alert">{error}</p>}

      {!o && saved.length > 0 && (
        <div className="tk-saved">
          <small>Orders placed on this device</small>
          {saved.slice(0, 6).map((x) => (
            <button key={x.id} type="button" className="ac-tag" onClick={() => { setForm({ order: x.id, phone: x.customer.phone }); setParams({ order: x.id }, { replace: true }); lookup(x.id, x.customer.phone); }}>{x.id}</button>
          ))}
        </div>
      )}

      {o && (
        <div className="tk-result">
          <section className="co-card">
            <div className="tk-top">
              <div><small>Order</small><h2>{o.id}</h2><small>Placed {fmt(o.placedAt)} · {o.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</small></div>
              <p className={`tk-headline${cancelled ? ' bad' : ''}`}>{headline(o, s, step)}</p>
            </div>

            {cancelled ? null : (
              <ol className="tk-steps" aria-label="Order progress">
                {STEPS.map(([key, label], i) => (
                  <li key={key} className={i < step ? 'done' : i === step ? 'now' : ''}>
                    <span>{i <= step ? <Check size={13} strokeWidth={3} /> : i + 1}</span>
                    <b>{label}</b>
                    <small>{fmt(i === 4 ? s?.events?.length ? s.events[s.events.length - 1].at : stepTime('shipped') : stepTime(key))}</small>
                  </li>
                ))}
              </ol>
            )}
            {s?.expectedDelivery && step < 6 && !cancelled && !['returning', 'returned', 'cancelled'].includes(s.stage) && <p className="tk-eta"><Truck size={15} /> Expected delivery <b>{fmt(s.expectedDelivery, false)}</b></p>}
            {result.note && <p className="co-note">{result.note}</p>}
          </section>

          <section className="co-card">
            <h2><span><PackageCheck size={13} /></span> Courier</h2>
            {s ? (
              <>
                <div className="tk-courier">
                  <div><small>Courier</small><b>{s.carrier}</b></div>
                  <div><small>AWB number</small>
                    <b className="tk-awb">{s.waybill} <button type="button" onClick={() => copy(s.waybill)} aria-label="Copy AWB number">{copied ? <Check size={14} /> : <Copy size={14} />}</button></b>
                  </div>
                  {s.status && <div><small>Latest status</small><b>{s.status}</b></div>}
                  {s.location && <div><small>Last location</small><b><MapPin size={13} /> {s.location}</b></div>}
                  {s.updatedAt && <div><small>Updated</small><b>{fmt(s.updatedAt)}</b></div>}
                </div>
                <a className="btn btn-ghost tk-ext" href={s.url} target="_blank" rel="noreferrer noopener">Track on Delhivery <ExternalLink size={14} /></a>
                {s.events.length > 0 && (
                  <ul className="tk-events">
                    {s.events.map((e, i) => (
                      <li key={i} className={i === 0 ? 'first' : ''}>
                        <i aria-hidden="true" />
                        <div><b>{e.text}</b>{e.detail && <small>{e.detail}</small>}<small>{[fmt(e.at), e.location].filter(Boolean).join(' · ')}</small></div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="co-lead">{cancelled ? 'No courier booking for this order.' : 'Your parcel has not been handed to the courier yet. Delhivery tracking appears here as soon as it ships.'}</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
