import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, Heart, MapPin, Package, ShieldAlert, Trash2, User } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext.jsx';
import { EMPTY_ACCOUNT, readAccount, readOrders, validateDetails, writeAccount } from '../account.js';
import { rupees } from '../studio/pricing.js';

const payLabel = { cod: 'Cash on delivery', upi: 'UPI / online payment' };
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function Account() {
  const { count: saved } = useWishlist();
  const [form, setForm] = useState(readAccount);
  const [touched, setTouched] = useState({});
  const [savedNote, setSavedNote] = useState('');
  const [orders, setOrders] = useState(readOrders);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, []);
  useEffect(() => {
    if (!savedNote) return undefined;
    const t = setTimeout(() => setSavedNote(''), 3000);
    return () => clearTimeout(t);
  }, [savedNote]);

  // Fields can be left empty here; anything filled in must still be valid.
  const errors = useMemo(() => validateDetails(form, { optional: true }), [form]);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const err = (key) => touched[key] && errors[key];

  const save = (e) => {
    e.preventDefault();
    if (Object.keys(errors).length) {
      setTouched(Object.fromEntries(Object.keys(EMPTY_ACCOUNT).map((k) => [k, true])));
      return;
    }
    writeAccount(form);
    setSavedNote('Details saved on this device. They will fill in at checkout.');
  };

  const clearAll = () => {
    try { ['account', 'orders', 'wishlist', 'cart-items'].forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
    window.location.reload();
  };

  const field = (key, label, props = {}) => (
    <label className={`co-field${err(key) ? ' bad' : ''}${props.wide ? ' wide' : ''}`}>
      <span>{label}</span>
      <input
        type={props.type || 'text'} inputMode={props.mode} autoComplete={props.auto} maxLength={props.max}
        value={form[key]} onChange={set(key)} onBlur={() => setTouched((t) => ({ ...t, [key]: true }))}
        placeholder={props.ph} aria-invalid={!!err(key)}
      />
      {err(key) && <small role="alert">{errors[key]}</small>}
    </label>
  );

  return (
    <div className="wrap co ac">
      <nav className="pd-crumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link><ChevronRight size={12} /><b>My account</b>
      </nav>
      <div className="ac-head">
        <span className="ac-avatar" aria-hidden="true">{form.name.trim() ? form.name.trim()[0].toUpperCase() : <User size={26} />}</span>
        <div>
          <h1>{form.name.trim() ? `Hi, ${form.name.trim().split(' ')[0]}` : 'My account'}</h1>
          <p className="co-lead">Keep your details here so checkout is quick. Sign-in is not set up yet, so everything is saved on this device only.</p>
        </div>
      </div>

      <div className="ac-quick">
        <Link to="/wishlist"><Heart size={18} /><b>{saved}</b><span>Saved items</span></Link>
        <a href="#orders"><Package size={18} /><b>{orders.length}</b><span>Orders</span></a>
        <Link to="/checkout"><MapPin size={18} /><b>{form.pin ? form.pin : '—'}</b><span>Delivery PIN</span></Link>
      </div>

      <form className="co-main" onSubmit={save} noValidate>
        <section className="co-card" aria-labelledby="ac-profile">
          <h2 id="ac-profile"><span><User size={13} /></span> Your details</h2>
          <div className="co-grid">
            {field('name', 'Full name', { auto: 'name' })}
            {field('phone', 'Mobile number', { type: 'tel', mode: 'tel', auto: 'tel', max: 14, ph: '98765 43210' })}
            {field('email', 'Email', { type: 'email', auto: 'email', wide: true, ph: 'you@example.com' })}
          </div>
        </section>

        <section className="co-card" aria-labelledby="ac-address">
          <h2 id="ac-address"><span><MapPin size={13} /></span> Default delivery address</h2>
          <div className="co-grid">
            {field('line1', 'House no., street, area', { auto: 'address-line1', wide: true })}
            {field('line2', 'Landmark (optional)', { auto: 'address-line2', wide: true })}
            {field('city', 'City', { auto: 'address-level2' })}
            {field('state', 'State', { auto: 'address-level1' })}
            {field('pin', 'PIN code', { mode: 'numeric', auto: 'postal-code', max: 6, ph: '700001' })}
          </div>
          <div className="ac-save">
            <button type="submit" className="btn btn-lime-solid">Save details</button>
            {savedNote && <span className="ac-ok" role="status"><Check size={14} strokeWidth={3} /> {savedNote}</span>}
          </div>
        </section>
      </form>

      <section className="co-card ac-orders" id="orders" aria-labelledby="ac-orders">
        <h2 id="ac-orders"><span><Package size={13} /></span> Your orders</h2>
        {orders.length === 0 ? (
          <p className="co-lead">No orders yet. <Link to="/print-on-demand" className="ac-link">Design something</Link> and it will show up here.</p>
        ) : (
          <ul className="ac-list">
            {orders.map((o) => (
              <li key={o.id}>
                <div className="ac-order-top">
                  <b>{o.id}</b>
                  <Link className="ac-status" to={`/track?order=${o.id}`}>Track order →</Link>
                  <small>{fmtDate(o.placedAt)}</small>
                </div>
                <ul className="ac-lines">
                  {o.items.map((i) => (
                    <li key={i.id}>
                      <span>{i.name} × {i.qty}{i.detail ? <small> {i.detail}</small> : null}</span>
                      <b>{i.unit != null ? rupees(i.unit * i.qty) : 'At confirmation'}</b>
                    </li>
                  ))}
                </ul>
                <div className="ac-order-foot">
                  <span>{payLabel[o.payment] || o.payment}</span>
                  <b>{rupees(o.total ?? o.subtotal)}{o.unpriced ? ' + more at confirmation' : ''}</b>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="co-card ac-danger" aria-labelledby="ac-data">
        <h2 id="ac-data"><span><ShieldAlert size={13} /></span> Data on this device</h2>
        <p className="co-lead">Your details, orders, wishlist and cart are stored in this browser. Clearing them cannot be undone.</p>
        {confirmClear ? (
          <div className="ac-save">
            <button type="button" className="btn ac-del" onClick={clearAll}><Trash2 size={15} /> Yes, clear everything</button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmClear(false)}>Cancel</button>
          </div>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => setConfirmClear(true)}><Trash2 size={15} /> Clear my data</button>
        )}
      </section>
    </div>
  );
}
