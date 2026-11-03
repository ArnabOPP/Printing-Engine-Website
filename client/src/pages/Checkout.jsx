import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, ChevronRight, Lock, Minus, PackageCheck, Plus, ShoppingBag, Trash2, Truck } from 'lucide-react';
import { useCart } from '../context/CartContext.jsx';
import { rupees } from '../studio/pricing.js';
import { readAccount, writeAccount } from '../account.js';

const payments = [
  { id: 'cod', title: 'Cash on delivery', text: 'Pay in cash when your order arrives.' },
  { id: 'upi', title: 'UPI / online payment', text: 'We send you a secure payment link once we confirm your order.' },
];

const EMPTY = { name: '', phone: '', email: '', line1: '', line2: '', city: '', state: '', pin: '', note: '' };

// Returns an error message per field that is not valid.
function validate(f) {
  const e = {};
  if (f.name.trim().length < 2) e.name = 'Enter your full name.';
  if (!/^[6-9]\d{9}$/.test(f.phone.replace(/[\s-]/g, '').replace(/^(\+91|0)/, ''))) e.phone = 'Enter a 10 digit Indian mobile number.';
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email address.';
  if (f.line1.trim().length < 5) e.line1 = 'Enter your house number and street.';
  if (f.city.trim().length < 2) e.city = 'Enter your city.';
  if (f.state.trim().length < 2) e.state = 'Enter your state.';
  if (!/^[1-9]\d{5}$/.test(f.pin.trim())) e.pin = 'Enter a 6 digit PIN code.';
  return e;
}

const orderId = () => `PE-${Date.now().toString(36).toUpperCase().slice(-6)}${Math.random().toString(36).toUpperCase().slice(2, 4)}`;

export default function Checkout() {
  const { items, setQty, remove, clear } = useCart();
  const [form, setForm] = useState(() => ({ ...EMPTY, ...readAccount() }));
  const [keep, setKeep] = useState(true); // save these details to the account
  const [touched, setTouched] = useState({});
  const [pay, setPay] = useState('cod');
  const [placed, setPlaced] = useState(null);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [placed]);

  const errors = useMemo(() => validate(form), [form]);
  const priced = items.filter((i) => i.unit != null);
  const unpriced = items.length - priced.length;
  const subtotal = priced.reduce((n, i) => n + i.unit * i.qty, 0);
  const pieces = items.reduce((n, i) => n + i.qty, 0);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const blur = (key) => () => setTouched((t) => ({ ...t, [key]: true }));
  const err = (key) => touched[key] && errors[key];

  const place = (e) => {
    e.preventDefault();
    if (Object.keys(errors).length) {
      setTouched(Object.fromEntries(Object.keys(EMPTY).map((k) => [k, true])));
      document.querySelector('.co-field.bad input, .co-field.bad textarea')?.focus();
      return;
    }
    const order = {
      id: orderId(),
      placedAt: new Date().toISOString(),
      customer: form,
      payment: pay,
      items,
      subtotal,
      unpriced,
    };
    // There is no server to send orders to yet, so the order is kept on this device.
    try {
      const all = JSON.parse(localStorage.getItem('orders') || '[]');
      localStorage.setItem('orders', JSON.stringify([order, ...(Array.isArray(all) ? all : [])].slice(0, 50)));
    } catch { /* ignore */ }
    if (keep) { const { note, ...details } = form; writeAccount(details); }
    clear();
    setPlaced(order);
  };

  const field = (key, label, props = {}) => (
    <label className={`co-field${err(key) ? ' bad' : ''}${props.wide ? ' wide' : ''}`}>
      <span>{label}</span>
      {props.area
        ? <textarea rows={2} value={form[key]} onChange={set(key)} onBlur={blur(key)} placeholder={props.ph} />
        : <input type={props.type || 'text'} inputMode={props.mode} autoComplete={props.auto} maxLength={props.max} value={form[key]} onChange={set(key)} onBlur={blur(key)} placeholder={props.ph} aria-invalid={!!err(key)} />}
      {err(key) && <small role="alert">{errors[key]}</small>}
    </label>
  );

  if (placed) {
    return (
      <div className="wrap co">
        <div className="co-done">
          <span className="co-done-ico"><PackageCheck size={30} /></span>
          <h1>Thank you, {placed.customer.name.split(' ')[0]}!</h1>
          <p className="co-lead">Your order <b>{placed.id}</b> is placed. We will contact you on {placed.customer.phone} to confirm the details{placed.unpriced ? ', the final price' : ''} and delivery.</p>
          <dl className="co-done-dl">
            <dt>Deliver to</dt>
            <dd>{[placed.customer.line1, placed.customer.line2, placed.customer.city, placed.customer.state].filter(Boolean).join(', ')} – {placed.customer.pin}</dd>
            <dt>Payment</dt>
            <dd>{payments.find((p) => p.id === placed.payment)?.title}</dd>
            <dt>Items</dt>
            <dd>{placed.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</dd>
            <dt>Estimated total</dt>
            <dd><b>{rupees(placed.subtotal)}</b>{placed.unpriced ? ` + ${placed.unpriced} item${placed.unpriced > 1 ? 's' : ''} priced at confirmation` : ''} (shipping confirmed with you)</dd>
          </dl>
          <p className="co-note">Online payment is not connected yet, so nothing has been charged.</p>
          <div className="co-done-links">
            <Link to="/print-on-demand" className="btn btn-lime-solid">Design another product</Link>
            <Link to="/" className="btn btn-ghost">Back to home</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="wrap co">
        <div className="co-done">
          <span className="co-done-ico"><ShoppingBag size={30} /></span>
          <h1>Your cart is empty</h1>
          <p className="co-lead">Add a product or design your own, then come back here to check out.</p>
          <div className="co-done-links">
            <Link to="/print-on-demand" className="btn btn-lime-solid">Customise a product</Link>
            <Link to="/" className="btn btn-ghost">Back to home</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap co">
      <nav className="pd-crumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link><ChevronRight size={12} /><b>Checkout</b>
      </nav>
      <h1>Checkout</h1>

      <form className="co-layout" onSubmit={place} noValidate>
        <div className="co-main">
          <section className="co-card" aria-labelledby="co-contact">
            <h2 id="co-contact"><span>1</span> Contact</h2>
            <div className="co-grid">
              {field('name', 'Full name', { auto: 'name', ph: 'As on your ID' })}
              {field('phone', 'Mobile number', { type: 'tel', mode: 'tel', auto: 'tel', max: 14, ph: '98765 43210' })}
              {field('email', 'Email', { type: 'email', auto: 'email', wide: true, ph: 'you@example.com' })}
            </div>
          </section>

          <section className="co-card" aria-labelledby="co-ship">
            <h2 id="co-ship"><span>2</span> Delivery address</h2>
            <div className="co-grid">
              {field('line1', 'House no., street, area', { auto: 'address-line1', wide: true })}
              {field('line2', 'Landmark (optional)', { auto: 'address-line2', wide: true })}
              {field('city', 'City', { auto: 'address-level2' })}
              {field('state', 'State', { auto: 'address-level1' })}
              {field('pin', 'PIN code', { mode: 'numeric', auto: 'postal-code', max: 6, ph: '700001' })}
            </div>
            <label className="co-keep"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> Save these details to my account for next time</label>
            {field('note', 'Note for us (optional)', { area: true, ph: 'Anything we should know about your design or delivery' })}
          </section>

          <section className="co-card" aria-labelledby="co-pay">
            <h2 id="co-pay"><span>3</span> Payment</h2>
            <div className="co-pays" role="radiogroup" aria-label="Payment method">
              {payments.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={pay === p.id} className={`co-pay${pay === p.id ? ' on' : ''}`} onClick={() => setPay(p.id)}>
                  <strong>{p.title}</strong>
                  <small>{p.text}</small>
                  {pay === p.id && <span className="co-tick"><Check size={13} strokeWidth={3} /></span>}
                </button>
              ))}
            </div>
            <p className="co-note"><Lock size={13} /> Online payment is not connected yet. You will not be charged now.</p>
          </section>
        </div>

        <aside className="co-summary" aria-label="Order summary">
          <h2>Your order <small>{pieces} {pieces === 1 ? 'piece' : 'pieces'}</small></h2>
          <ul className="co-items">
            {items.map((i) => (
              <li key={i.id}>
                {i.img ? <img src={i.img} alt="" /> : <span className="co-noimg"><ShoppingBag size={18} /></span>}
                <div className="co-item-info">
                  <strong>{i.name}</strong>
                  {i.detail && <small>{i.detail}</small>}
                  <div className="co-item-row">
                    <div className="co-step">
                      <button type="button" onClick={() => setQty(i.id, i.qty - 1)} disabled={i.qty <= 1} aria-label={`Fewer ${i.name}`}><Minus size={13} /></button>
                      <output aria-label={`${i.name} quantity`}>{i.qty}</output>
                      <button type="button" onClick={() => setQty(i.id, i.qty + 1)} aria-label={`More ${i.name}`}><Plus size={13} /></button>
                    </div>
                    <button type="button" className="co-remove" onClick={() => remove(i.id)} aria-label={`Remove ${i.name}`}><Trash2 size={14} /></button>
                  </div>
                </div>
                <b>{i.unit != null ? rupees(i.unit * i.qty) : 'At confirmation'}</b>
              </li>
            ))}
          </ul>

          <dl className="co-totals">
            <div><dt>Subtotal</dt><dd>{rupees(subtotal)}</dd></div>
            <div><dt><Truck size={13} /> Shipping</dt><dd>Confirmed with you</dd></div>
            {unpriced > 0 && <div className="note"><dt>{unpriced} item{unpriced > 1 ? 's' : ''} priced when we confirm</dt><dd /></div>}
            <div className="total"><dt>Estimated total</dt><dd>{rupees(subtotal)}</dd></div>
          </dl>

          <button type="submit" className="btn btn-lime-solid co-go">Place order</button>
          {Object.keys(errors).length > 0 && Object.keys(touched).length > 0 && <p className="co-alert" role="alert">Please fix the highlighted fields.</p>}
          <Link to="/print-on-demand" className="opt-back"><ArrowLeft size={14} /> Keep shopping</Link>
        </aside>
      </form>
    </div>
  );
}
