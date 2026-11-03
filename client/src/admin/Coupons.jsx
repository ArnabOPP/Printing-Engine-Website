import { useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from '../api.js';
import { Loading, PageHead, fmtDate, rupees, useLoad } from './ui.jsx';

const blank = () => ({ id: '', code: '', description: '', type: 'percent', value: '10', minOrder: '', maxDiscount: '', startsAt: '', endsAt: '', usageLimit: '', active: true });
const day = (iso) => (iso ? iso.slice(0, 10) : '');

const label = (c) => (c.type === 'percent' ? `${c.value}% off${c.maxDiscount ? ` (up to ${rupees(c.maxDiscount)})` : ''}` : `${rupees(c.value)} off`);
const state = (c) => {
  if (!c.active) return ['Off', 'red'];
  if (c.endsAt && new Date(c.endsAt) < new Date()) return ['Expired', 'red'];
  if (c.startsAt && new Date(c.startsAt) > new Date()) return ['Scheduled', ''];
  if (c.usageLimit != null && c.used >= c.usageLimit) return ['Used up', 'red'];
  return ['Live', 'lime'];
};

function Editor({ coupon, onSaved, onCancel }) {
  const [c, setC] = useState({ ...coupon, minOrder: coupon.minOrder || '', maxDiscount: coupon.maxDiscount ?? '', usageLimit: coupon.usageLimit ?? '', startsAt: day(coupon.startsAt), endsAt: day(coupon.endsAt) });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setC((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      // The coupon ends at the end of its last day.
      const body = { ...c, endsAt: c.endsAt ? `${c.endsAt}T23:59:59` : '', startsAt: c.startsAt ? `${c.startsAt}T00:00:00` : '' };
      await (coupon.id ? api(`/api/admin/coupons/${coupon.id}`, { method: 'PUT', body }) : api('/api/admin/coupons', { method: 'POST', body }));
      onSaved();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="ad-card ad-editor" onSubmit={submit}>
      <div className="ad-editor-head">
        <h2>{coupon.id ? `Edit ${coupon.code}` : 'New coupon'}</h2>
        <button type="button" className="ad-icon" onClick={onCancel} aria-label="Close"><X size={18} /></button>
      </div>
      <div className="ad-fields">
        <label className="ad-field">Code<input value={c.code} onChange={(e) => setC((x) => ({ ...x, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') }))} required minLength={3} maxLength={30} placeholder="WELCOME10" /></label>
        <label className="ad-field">Discount type
          <select value={c.type} onChange={set('type')}><option value="percent">Percentage off</option><option value="flat">Fixed amount off</option></select>
        </label>
        <label className="ad-field">{c.type === 'percent' ? 'Percent off' : 'Amount off'}
          <span className="ad-money">{c.type === 'percent' ? '%' : '₹'}<input type="number" min="1" max={c.type === 'percent' ? 100 : undefined} step="1" value={c.value} onChange={set('value')} required /></span>
        </label>
        {c.type === 'percent' && <label className="ad-field">Most it can take off (optional)<span className="ad-money">₹<input type="number" min="1" value={c.maxDiscount} onChange={set('maxDiscount')} /></span></label>}
        <label className="ad-field">Minimum order (optional)<span className="ad-money">₹<input type="number" min="0" value={c.minOrder} onChange={set('minOrder')} /></span></label>
        <label className="ad-field">Total times it can be used (optional)<input type="number" min="1" value={c.usageLimit} onChange={set('usageLimit')} placeholder="no limit" /></label>
        <label className="ad-field">Starts on (optional)<input type="date" value={c.startsAt} onChange={set('startsAt')} /></label>
        <label className="ad-field">Ends on (optional)<input type="date" value={c.endsAt} onChange={set('endsAt')} /></label>
      </div>
      <label className="ad-field">Note shown to the customer (optional)<input value={c.description} onChange={set('description')} maxLength={140} placeholder="e.g. Welcome offer" /></label>
      <label className="ad-check"><input type="checkbox" checked={c.active} onChange={(e) => setC((x) => ({ ...x, active: e.target.checked }))} /> Active</label>
      {err && <p className="ad-error" role="alert">{err}</p>}
      <div className="ad-editor-foot">
        <button type="button" className="ad-btn" onClick={onCancel}>Cancel</button>
        <button className="ad-btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save coupon'}</button>
      </div>
    </form>
  );
}

export default function Coupons() {
  const { data, error, loading, reload } = useLoad('/api/admin/coupons');
  const [edit, setEdit] = useState(null); // coupon object, or {} for a new one
  const [msg, setMsg] = useState('');

  const toggle = async (c) => {
    try { await api(`/api/admin/coupons/${c.id}`, { method: 'PUT', body: { ...c, active: !c.active } }); reload(); } catch (e) { setMsg(e.message); }
  };
  const remove = async (c) => {
    if (!window.confirm(`Delete coupon ${c.code}?`)) return;
    try { await api(`/api/admin/coupons/${c.id}`, { method: 'DELETE' }); reload(); } catch (e) { setMsg(e.message); }
  };

  return (
    <>
      <PageHead title="Coupons & offers">
        <button type="button" className="ad-btn primary" onClick={() => setEdit(blank())}><Plus size={15} /> New coupon</button>
      </PageHead>
      <p className="ad-muted">Customers type a code at checkout. To advertise one, add an “Offer strip” under Home page &amp; content, or put it in the announcement bar. For a sale price on a single product, set its “Original price” under Shop products.</p>
      {msg && <p className="ad-error" role="alert">{msg}</p>}

      {edit && <Editor key={edit.id || 'new'} coupon={edit} onCancel={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}

      <section className="ad-card flush">
        {!data ? <Loading error={error} loading={loading} /> : data.coupons.length === 0 ? <p className="ad-muted pad">No coupons yet.</p> : (
          <div className="ad-scroll">
            <table className="ad-table">
              <thead><tr><th>Code</th><th>Discount</th><th>Rules</th><th>Valid</th><th>Used</th><th>Status</th><th /></tr></thead>
              <tbody>
                {data.coupons.map((c) => {
                  const [s, cls] = state(c);
                  return (
                    <tr key={c.id}>
                      <td><b className="ad-mono">{c.code}</b>{c.description && <small>{c.description}</small>}</td>
                      <td>{label(c)}</td>
                      <td>{c.minOrder ? `Min ${rupees(c.minOrder)}` : 'No minimum'}</td>
                      <td>{c.startsAt || c.endsAt ? `${c.startsAt ? fmtDate(c.startsAt) : 'Now'} → ${c.endsAt ? fmtDate(c.endsAt) : 'No end'}` : 'Always'}</td>
                      <td>{c.used}{c.usageLimit != null ? ` / ${c.usageLimit}` : ''}</td>
                      <td><span className={`ad-pill ${cls}`}>{s}</span></td>
                      <td className="ad-rowtools">
                        <button type="button" className="ad-btn" onClick={() => toggle(c)}>{c.active ? 'Turn off' : 'Turn on'}</button>
                        <button type="button" className="ad-btn" onClick={() => setEdit(c)}><Pencil size={14} /> Edit</button>
                        <button type="button" className="ad-btn danger" onClick={() => remove(c)} aria-label={`Delete ${c.code}`}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
