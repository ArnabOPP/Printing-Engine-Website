import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Search, Trash2, X } from 'lucide-react';
import { api, fileUrl } from '../api.js';
import { DelhiveryTools, ShippingSection } from './Shipping.jsx';
import { Loading, PAY_LABEL, PageHead, STATUS_LABEL, StatusBadge, fmtDate, fmtTime, rupees, useLoad } from './ui.jsx';

const STATUS_ORDER = Object.keys(STATUS_LABEL);
const SIDE_LABEL = { front: 'Front', back: 'Back', left: 'Left sleeve', right: 'Right sleeve' };

// A customer's uploaded picture, fetched with the admin's login.
function Artwork({ orderId, image }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    if (!image.file) return undefined;
    let url = '';
    fileUrl(`/api/admin/orders/${orderId}/files/${image.file}`).then((u) => { url = u; setSrc(u); }).catch(() => {});
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [orderId, image.file]);
  if (!image.file) return <span className="ad-muted">No file received</span>;
  return (
    <figure className="ad-art">
      {src ? <img src={src} alt={image.name} /> : <div className="ad-art-ph" />}
      <figcaption>
        <span title={image.name}>{image.name || 'image'}</span>
        {src && <a href={src} download={image.name || image.file} aria-label={`Download ${image.name}`}><Download size={14} /></a>}
      </figcaption>
    </figure>
  );
}

function Layers({ orderId, design }) {
  const sides = ['front', 'back', 'left', 'right'].filter((s) => design[s]?.length);
  if (!sides.length && !Object.keys(design.mockups || {}).length) return <p className="ad-muted">No artwork on this design.</p>;
  return (
    <>
      {design.mode === 'full' && <p className="ad-pill">Full body print</p>}
      {Object.entries(design.mockups || {}).map(([side, image]) => (
        <div key={side}><h4>{SIDE_LABEL[side]} mockup</h4><Artwork orderId={orderId} image={image} /></div>
      ))}
      {sides.map((s) => (
        <div key={s} className="ad-side-block">
          <h4>{SIDE_LABEL[s]}</h4>
          <ul className="ad-layers">
            {design[s].map((l, i) => (
              <li key={i}>
                {l.type === 'image' && <Artwork orderId={orderId} image={l.image || {}} />}
                {l.type === 'text' && <span><b>Text:</b> “{l.text?.value}” <small>{l.text?.font?.split(',')[0]?.replace(/'/g, '')} · <i className="ad-dot" style={{ background: l.text?.color }} /> {l.text?.color}{l.text?.bold ? ' · bold' : ''}{l.text?.italic ? ' · italic' : ''}</small></span>}
                {l.type === 'shape' && <span><b>Shape:</b> {l.shape?.kind} <small><i className="ad-dot" style={{ background: l.shape?.fill }} /> {l.shape?.fill}</small></span>}
                <small className="ad-muted">{l.flip ? 'flipped across · ' : ''}{l.flipV ? 'flipped down · ' : ''}{l.repeat ? `repeated${l.count ? ` ×${l.count}` : ' to fill the sheet'} · ` : ''}rotated {l.rot || 0}°</small>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

function OrderPanel({ id, admin, onClose, onChanged }) {
  const { data, error, loading, reload } = useLoad(`/api/admin/orders/${id}`);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const o = data?.order;

  useEffect(() => { if (o) setNote(o.adminNote || ''); }, [o?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = async (body, done) => {
    setBusy(true);
    setMsg('');
    try {
      await api(`/api/admin/orders/${id}`, { method: 'PATCH', body });
      reload();
      onChanged();
      if (done) setMsg(done);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete order ${id} and its artwork for good? This cannot be undone.`)) return;
    try {
      await api(`/api/admin/orders/${id}`, { method: 'DELETE' });
      onChanged();
      onClose();
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <div className="ad-drawer-wrap" role="dialog" aria-modal="true" aria-label={`Order ${id}`}>
      <button type="button" className="ad-drawer-bg" aria-label="Close" onClick={onClose} />
      <aside className="ad-drawer">
        <header>
          <div><h2>{id}</h2>{o && <small>{fmtTime(o.createdAt)}</small>}</div>
          <button type="button" className="ad-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        {!o ? <Loading error={error} loading={loading} /> : (
          <div className="ad-drawer-body">
            <section>
              <h3>Status</h3>
              <div className="ad-statusrow">
                {STATUS_ORDER.map((s) => (
                  <button key={s} type="button" disabled={busy} className={`ad-chip st-${s}${o.status === s ? ' on' : ''}`} onClick={() => o.status !== s && patch({ status: s })}>{STATUS_LABEL[s]}</button>
                ))}
              </div>
              <ul className="ad-history">
                {[...o.history].reverse().map((h, i) => <li key={i}><StatusBadge status={h.status} /> <small>{fmtTime(h.at)} · {h.by}</small></li>)}
              </ul>
            </section>

            <section>
              <h3>Customer</h3>
              <p><b>{o.customer.name}</b><br />
                <a href={`tel:${o.customer.phone}`}>{o.customer.phone}</a> · <a href={`mailto:${o.customer.email}`}>{o.customer.email}</a></p>
              <p>{[o.customer.line1, o.customer.line2, o.customer.city, o.customer.state].filter(Boolean).join(', ')} – {o.customer.pin}</p>
              {o.customer.note && <p className="ad-quote">“{o.customer.note}”</p>}
              <p className="ad-muted">Payment: {PAY_LABEL[o.payment] || o.payment}</p>
            </section>

            <section>
              <h3>Items</h3>
              <table className="ad-table">
                <tbody>
                  {o.items.map((i, n) => (
                    <tr key={n}>
                      <td><b>{i.name}</b>{i.detail && <small>{i.detail}</small>}</td>
                      <td className="num">× {i.qty}</td>
                      <td className="num">{i.unit != null ? rupees(i.unit * i.qty) : <span className="ad-warn">needs a price</span>}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td>Priced items</td><td /><td className="num">{rupees(o.subtotal)}</td></tr>
                  {o.coupon && <tr><td>Coupon <b>{o.coupon.code}</b></td><td /><td className="num">− {rupees(o.discount)}</td></tr>}
                  <tr><td>Customer pays</td><td /><td className="num"><b>{rupees(o.total ?? o.subtotal)}</b></td></tr>
                </tfoot>
              </table>
              <p className="ad-muted">Prices are the customer’s estimate at checkout. Confirm the final price and shipping with them.</p>
            </section>

            <ShippingSection order={o} owner={admin.role === 'owner'} onChanged={async () => { await reload(); onChanged(); }} />

            {Object.entries(o.designs || {}).map(([slug, d]) => {
              const cfg = o.items.find((i) => (i.designId || i.slug) === slug)?.config;
              return (
                <section key={slug}>
                  <h3>Design · {cfg?.product || slug}</h3>
                  {cfg && <p className="ad-muted">{[cfg.methodLabel, cfg.material, cfg.colour, cfg.sheet && `${cfg.sheet.label} sheet (${cfg.sheet.w} × ${cfg.sheet.h} mm)`, cfg.audience].filter(Boolean).join(' · ')}</p>}
                  {o.assetsDeletedAt ? <p className="ad-muted">Artwork and mockups removed after courier-confirmed dispatch on {fmtTime(o.assetsDeletedAt)}.</p> : <Layers orderId={o.id} design={d} />}
                </section>
              );
            })}

            {o.wishlist?.length > 0 && (
              <section>
                <h3>Also saved by this customer</h3>
                <p className="ad-muted">{o.wishlist.map((w) => w.name).join(', ')}</p>
              </section>
            )}

            <section>
              <h3>Team note</h3>
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Only the team sees this." />
              <button type="button" className="ad-btn" disabled={busy || note === (o.adminNote || '')} onClick={() => patch({ adminNote: note }, 'Note saved.')}>Save note</button>
              {msg && <span className="ad-muted"> {msg}</span>}
            </section>

            {admin.role === 'owner' && (
              <section className="ad-dangerzone">
                <button type="button" className="ad-btn danger" onClick={remove}><Trash2 size={15} /> Delete order</button>
              </section>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

export default function Orders({ admin }) {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const open = params.get('open') || '';
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const { data, error, loading, reload } = useLoad(`/api/admin/orders?status=${status}&q=${encodeURIComponent(term)}`);

  useEffect(() => { const t = setTimeout(() => setTerm(q), 300); return () => clearTimeout(t); }, [q]);

  const set = (key, value) => { const p = new URLSearchParams(params); if (value) p.set(key, value); else p.delete(key); setParams(p, { replace: true }); };

  return (
    <>
      <PageHead title="Orders">
        <label className="ad-search"><Search size={15} /><input type="search" placeholder="Search order, name, phone, city" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" /></label>
      </PageHead>
      <DelhiveryTools />
      <div className="ad-filters" role="tablist" aria-label="Filter by status">
        <button type="button" role="tab" aria-selected={!status} className={`ad-chip${!status ? ' on' : ''}`} onClick={() => set('status', '')}>All</button>
        {STATUS_ORDER.map((s) => (
          <button key={s} type="button" role="tab" aria-selected={status === s} className={`ad-chip st-${s}${status === s ? ' on' : ''}`} onClick={() => set('status', s)}>{STATUS_LABEL[s]}</button>
        ))}
      </div>

      <section className="ad-card flush">
        {!data ? <Loading error={error} loading={loading} /> : data.orders.length === 0 ? <p className="ad-muted pad">No orders found.</p> : (
          <div className="ad-scroll">
            <table className="ad-table hover">
              <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Pieces</th><th>Payment</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {data.orders.map((o) => (
                  <tr key={o.id} tabIndex={0} onClick={() => set('open', o.id)} onKeyDown={(e) => e.key === 'Enter' && set('open', o.id)}>
                    <td><b>{o.id}</b><small>{fmtDate(o.createdAt)}</small></td>
                    <td>{o.customer.name}<small>{o.customer.phone} · {o.customer.city}</small></td>
                    <td><StatusBadge status={o.status} />{o.awb && <small className={o.shipStage === 'cancelled' ? '' : 'ad-mono'}>AWB {o.awb}</small>}{o.hasArtwork && <small>has artwork</small>}</td>
                    <td>{o.pieces}</td>
                    <td>{PAY_LABEL[o.payment]}</td>
                    <td className="num">{rupees(o.total ?? o.subtotal)}{o.discount ? <small>coupon −{rupees(o.discount)}</small> : null}{o.unpriced ? <small className="ad-warn">+ unpriced</small> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <p className="ad-muted pad">Showing {data.orders.length} of {data.total}.</p>}
      </section>

      {open && <OrderPanel key={open} id={open} admin={admin} onClose={() => set('open', '')} onChanged={reload} />}
    </>
  );
}
