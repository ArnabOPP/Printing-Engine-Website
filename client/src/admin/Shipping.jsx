import { useEffect, useState } from 'react';
import { Download, ExternalLink, RefreshCw, Truck } from 'lucide-react';
import { api, fileUrl } from '../api.js';
import { fmtTime, rupees, useLoad } from './ui.jsx';

const STAGE = { booked: 'Booked', in_transit: 'In transit', out_for_delivery: 'Out for delivery', delivered: 'Delivered', returned: 'Returned', cancelled: 'Cancelled' };
const KEY = 'ship-defaults';
const readDefaults = () => { try { return { weight: '300', length: '25', width: '20', height: '4', ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { weight: '300', length: '25', width: '20', height: '4' }; } };

// The Shipping part of an order: book it with Delhivery (or record an AWB you booked yourself), then follow it.
export function ShippingSection({ order: o, onChanged }) {
  const { data: cfg } = useLoad('/api/admin/shipping');
  const [pin, setPin] = useState(null);
  const [mode, setMode] = useState('create');
  const [f, setF] = useState({ ...readDefaults(), waybill: '', description: '', codAmount: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const s = o.shipment && !o.shipment.cancelled ? o.shipment : null;
  const set = (k) => (e) => setF((c) => ({ ...c, [k]: e.target.value }));

  useEffect(() => {
    if (!cfg?.configured) return;
    api(`/api/admin/shipping/check?pin=${o.customer.pin}`).then(setPin).catch(() => {});
  }, [cfg?.configured, o.customer.pin]);

  const run = async (fn, ok) => {
    setBusy(true);
    setMsg('');
    try { await fn(); await onChanged(); if (ok) setMsg(ok); } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };
  const base = `/api/admin/orders/${o.id}/shipment`;

  const book = (e) => {
    e.preventDefault();
    if (mode === 'create') { try { localStorage.setItem(KEY, JSON.stringify({ weight: f.weight, length: f.length, width: f.width, height: f.height })); } catch { /* ignore */ } }
    run(() => api(base, { method: 'POST', body: mode === 'manual' ? { mode: 'manual', waybill: f.waybill } : { ...f, mode: 'create' } }), mode === 'manual' ? 'AWB saved.' : 'Booked with Delhivery.');
  };

  const openLabel = async () => {
    setBusy(true);
    setMsg('');
    try { window.open(await fileUrl(`${base}/label`), '_blank', 'noopener'); } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };

  const needsCod = o.payment === 'cod' && o.unpriced > 0;

  return (
    <section>
      <h3><Truck size={13} /> Shipping · Delhivery</h3>
      {cfg && !cfg.configured && (
        <p className="ad-note">Delhivery is not connected on the server yet, so you cannot book from here and tracking will not update by itself. You can still book on Delhivery’s own site and type the AWB below; customers get a link to Delhivery’s tracking page.</p>
      )}
      {cfg?.configured && cfg.env === 'staging' && <p className="ad-warn">Delhivery is in <b>staging</b> (test) mode. Parcels booked now are not real.</p>}
      {pin && <p className="ad-muted">PIN {o.customer.pin}: {pin.serviceable ? `Delhivery delivers here${pin.cod ? ', cash on delivery available' : o.payment === 'cod' ? ', but NOT cash on delivery' : ''}.` : 'Delhivery does not serve this PIN code.'}</p>}

      {s ? (
        <>
          <div className="ad-ship">
            <div><small>AWB</small><b className="ad-mono">{s.waybill}</b></div>
            <div><small>Status</small><b>{STAGE[s.stage] || s.stage}{s.status ? ` · ${s.status}` : ''}</b></div>
            {s.location && <div><small>Last location</small><b>{s.location}</b></div>}
            {s.updatedAt && <div><small>Updated</small><b>{fmtTime(s.updatedAt)}</b></div>}
            {s.expectedDelivery && <div><small>Expected</small><b>{fmtTime(s.expectedDelivery)}</b></div>}
            {s.codAmount > 0 && <div><small>Collect on delivery</small><b>{rupees(s.codAmount)}</b></div>}
          </div>
          <div className="ad-statusrow">
            <button type="button" className="ad-btn" disabled={busy || !cfg?.configured} onClick={() => run(() => api(`${base}/refresh`, { method: 'POST' }), 'Tracking updated.')}><RefreshCw size={14} /> Refresh tracking</button>
            {s.createdVia === 'api' && <button type="button" className="ad-btn" disabled={busy} onClick={openLabel}><Download size={14} /> Shipping label</button>}
            <a className="ad-btn" href={`https://www.delhivery.com/track-v2/package/${s.waybill}`} target="_blank" rel="noreferrer noopener"><ExternalLink size={14} /> Delhivery page</a>
            <button type="button" className="ad-btn danger" disabled={busy} onClick={() => window.confirm(`Cancel the Delhivery shipment ${s.waybill}?`) && run(() => api(`${base}/cancel`, { method: 'POST' }), 'Shipment cancelled.')}>Cancel shipment</button>
          </div>
          {s.events?.length > 0 && (
            <ul className="ad-history">
              {s.events.slice(0, 8).map((e, i) => <li key={i}><b>{e.text}</b> <small>{[fmtTime(e.at), e.location].filter(Boolean).join(' · ')}</small></li>)}
            </ul>
          )}
        </>
      ) : (
        <form onSubmit={book} className="ad-shipform">
          {o.shipment?.cancelled && <p className="ad-warn">The earlier shipment ({o.shipment.waybill}) was cancelled. You can book again.</p>}
          <div className="ad-filters">
            <button type="button" className={`ad-chip${mode === 'create' ? ' on' : ''}`} onClick={() => setMode('create')} disabled={!cfg?.configured}>Book with Delhivery</button>
            <button type="button" className={`ad-chip${mode === 'manual' ? ' on' : ''}`} onClick={() => setMode('manual')}>I already booked it (enter AWB)</button>
          </div>
          {mode === 'manual' || !cfg?.configured ? (
            <label className="ad-field">AWB / waybill number<input value={f.waybill} onChange={set('waybill')} required minLength={6} /></label>
          ) : (
            <>
              <div className="ad-fields">
                <label className="ad-field">Weight (grams)<input type="number" min="1" max="50000" value={f.weight} onChange={set('weight')} required /></label>
                <label className="ad-field">Length (cm)<input type="number" min="1" max="200" value={f.length} onChange={set('length')} required /></label>
                <label className="ad-field">Width (cm)<input type="number" min="1" max="200" value={f.width} onChange={set('width')} required /></label>
                <label className="ad-field">Height (cm)<input type="number" min="1" max="200" value={f.height} onChange={set('height')} required /></label>
              </div>
              {o.payment === 'cod' && (
                <label className="ad-field">Cash to collect on delivery (₹){needsCod ? ' — some items have no price, enter the full amount' : ''}
                  <input type="number" min="0" value={f.codAmount} onChange={set('codAmount')} placeholder={needsCod ? 'required' : String(o.total ?? o.subtotal)} required={needsCod} />
                </label>
              )}
              <label className="ad-field">What is in the parcel (optional)<input value={f.description} onChange={set('description')} maxLength={200} placeholder={o.items.map((i) => i.name).join(', ').slice(0, 60)} /></label>
              <p className="ad-muted">Pickup location: <b>{cfg?.pickupLocation || 'not set (DELHIVERY_PICKUP_LOCATION)'}</b></p>
            </>
          )}
          <button className="ad-btn primary" disabled={busy}>{busy ? 'Working…' : mode === 'manual' || !cfg?.configured ? 'Save AWB' : 'Book shipment'}</button>
        </form>
      )}
      {msg && <p className={/booked|saved|updated|cancelled/i.test(msg) ? 'ad-note' : 'ad-error'} role="status">{msg}</p>}
    </section>
  );
}

// Top of the orders page: connection status, refresh every parcel, and ask Delhivery to collect parcels.
export function DelhiveryTools() {
  const { data: cfg, reload } = useLoad('/api/admin/shipping');
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(true);
  const [busy, setBusy] = useState(false);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [p, setP] = useState({ date: tomorrow, time: '15:00', count: '1' });

  const run = async (fn) => {
    setBusy(true);
    setMsg('');
    try { setMsg(await fn()); setOk(true); reload(); } catch (e) { setMsg(e.message); setOk(false); } finally { setBusy(false); }
  };

  if (!cfg) return null;
  return (
    <section className="ad-card">
      <div className="ad-toolsrow">
        <div>
          <b><Truck size={15} /> Delhivery</b>{' '}
          {cfg.configured ? <span className={`ad-pill ${cfg.env === 'production' ? 'lime' : ''}`}>{cfg.env === 'production' ? 'Connected (live)' : 'Connected (staging / test)'}</span> : <span className="ad-pill red">Not connected</span>}
          {cfg.configured && <small className="ad-muted"> · {cfg.onTheWay} parcel{cfg.onTheWay === 1 ? '' : 's'} on the way{cfg.webhookReady ? ' · live updates on' : ' · live updates off (checking every 30 min)'}</small>}
        </div>
        {cfg.configured && (
          <div className="ad-statusrow">
            <button type="button" className="ad-btn" disabled={busy} onClick={() => run(async () => { const r = await api('/api/admin/shipping/refresh-all', { method: 'POST' }); return `Checked ${r.checked} parcel(s)${r.failed ? `, ${r.failed} failed` : ''}.`; })}><RefreshCw size={14} /> Refresh all</button>
            <button type="button" className="ad-btn" onClick={() => setOpen((v) => !v)}>Schedule a pickup</button>
          </div>
        )}
      </div>
      {!cfg.configured && <p className="ad-muted">Add your Delhivery details to the server settings to book parcels and track them automatically. See ADMIN.md.</p>}
      {open && (
        <form className="ad-fields ad-pickup" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/api/admin/shipping/pickup', { method: 'POST', body: p }); setOpen(false); return 'Pickup requested from Delhivery.'; }); }}>
          <label className="ad-field">Date<input type="date" min={tomorrow.slice(0, 8) + '01'} value={p.date} onChange={(e) => setP({ ...p, date: e.target.value })} required /></label>
          <label className="ad-field">Time<input type="time" value={p.time} onChange={(e) => setP({ ...p, time: e.target.value })} required /></label>
          <label className="ad-field">Parcels<input type="number" min="1" max="500" value={p.count} onChange={(e) => setP({ ...p, count: e.target.value })} required /></label>
          <div className="ad-field"><span>&nbsp;</span><button className="ad-btn primary" disabled={busy}>Request pickup</button></div>
        </form>
      )}
      {msg && <p className={ok ? 'ad-note' : 'ad-error'} role="status">{msg}</p>}
    </section>
  );
}
