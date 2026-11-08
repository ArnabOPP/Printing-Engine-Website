import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Activity, BadgePercent, Home, LayoutDashboard, LogOut, Package, Settings, Shirt, ShoppingBag, Store, Tags, Users, UserCog, MessageSquare } from 'lucide-react';
import { api } from '../api.js';
import './admin.css';
import Dashboard from './Dashboard.jsx';
import Orders from './Orders.jsx';
import Customers from './Customers.jsx';
import Catalog from './Catalog.jsx';
import CustomProducts from './CustomProducts.jsx';
import Products from './Products.jsx';
import Reviews from './Reviews.jsx';
import ImageStorage from './ImageStorage.jsx';
import HomePage from './HomePage.jsx';
import Coupons from './Coupons.jsx';
import Team from './Team.jsx';
import { ActivityLog, MyAccount } from './Misc.jsx';
import { adminGoogleIdToken, adminIdToken, resetAdminPassword } from './firebaseAuth.js';
import { authMessage, firebaseReady } from '../firebase.js';

function Login({ onDone, customOnly = false }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNote('');
    try {
      const idToken = await adminIdToken(email, password);
      const { admin } = await api('/api/admin/login', { method: 'POST', body: { idToken } });
      onDone(admin);
    } catch (err) {
      setError(err.code ? authMessage(err) : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ad ad-login">
      <form className="ad-login-card" onSubmit={submit}>
        <img src="/logo.jpg" alt="" width="56" height="56" />
        <h1>{customOnly ? 'Custom Admin sign in' : 'Admin sign in'}</h1>
        <p className="ad-muted">Sign in with your Firebase account. Access is limited to approved team members.</p>
        <label>Email<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p className="ad-error" role="alert">{error}</p>}
        {note && <p className="ad-note" role="status">{note}</p>}
        {!firebaseReady && <p className="ad-error">Firebase sign-in is not configured on this website.</p>}
        <button className="ad-btn primary" disabled={busy || !firebaseReady}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <button type="button" className="ad-btn" disabled={busy || !firebaseReady} onClick={async () => {
          setBusy(true); setError(''); setNote('');
          try {
            const idToken = await adminGoogleIdToken();
            const { admin } = await api('/api/admin/login', { method: 'POST', body: { idToken } });
            onDone(admin);
          } catch (err) { setError(err.code ? authMessage(err) : err.message); }
          finally { setBusy(false); }
        }}>Continue with Google</button>
        <button type="button" className="ad-btn" disabled={busy || !firebaseReady} onClick={async () => {
          setError(''); setNote('');
          if (!email.trim()) { setError('Enter your email address first.'); return; }
          setBusy(true);
          try { await resetAdminPassword(email); setNote('If this email has an account, a password-reset link is on its way.'); }
          catch (err) { setError(err.code ? authMessage(err) : err.message); }
          finally { setBusy(false); }
        }}>Forgot password?</button>
      </form>
    </div>
  );
}

const links = [
  ['/admin', 'Dashboard', LayoutDashboard, true],
  ['/admin/orders', 'Orders', Package],
  ['/admin/customers', 'Customers', Users],
  ['/admin/home', 'Home page & content', Home],
  ['/admin/products', 'Shop products', ShoppingBag],
  ['/admin/reviews', 'Product reviews', MessageSquare],
  ['/admin/image-storage', 'Image storage', Store],
  ['/admin/coupons', 'Coupons & offers', BadgePercent],
  ['/admin/team', 'Admin team', UserCog, false, 'owner'],
  ['/admin/activity', 'Activity', Activity],
  ['/admin/account', 'My account', Settings],
];

const customLinks = [
  ['/custom-admin', 'Custom orders', Package, true],
  ['/custom-admin/products', 'Custom products', Shirt],
  ['/custom-admin/catalog', 'Global print rates', Tags],
  ['/custom-admin/account', 'My account', Settings],
];

export default function AdminApp({ customOnly = false }) {
  const [admin, setAdmin] = useState(undefined); // undefined: checking, null: signed out
  const navigate = useNavigate();
  const location = useLocation();
  const base = customOnly ? '/custom-admin' : '/admin';

  // This area is for the team only: keep it out of search results.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const title = document.title;
    document.title = customOnly ? 'Custom Admin – Printing Engine' : 'Admin – Printing Engine';
    return () => { meta.remove(); document.title = title; };
  }, [customOnly]);

  useEffect(() => {
    api('/api/admin/me').then((d) => setAdmin(d.admin)).catch(() => setAdmin(null));
  }, []);

  const signOut = async () => {
    try { await api('/api/admin/logout', { method: 'POST' }); } catch { /* ignore */ }
    setAdmin(null);
    navigate(base);
  };

  if (admin === undefined) return <div className="ad"><p className="ad-muted ad-center">Loading…</p></div>;
  if (!admin) return <Login onDone={setAdmin} customOnly={customOnly} />;

  return (
    <div className="ad ad-shell">
      <aside className="ad-side">
        <div className="ad-brand"><img src="/logo.jpg" alt="" width="36" height="36" /><b>{customOnly ? 'Custom Admin' : 'Admin'}</b></div>
        <nav aria-label="Admin">
          {(customOnly ? customLinks : links).filter(([, , , , need]) => !need || admin.role === need).map(([to, label, Icon, end]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'on' : '')}><Icon size={17} /> {label}</NavLink>
          ))}
        </nav>
        <div className="ad-side-foot">
          <a href={customOnly ? '/print-on-demand' : '/'} target="_blank" rel="noreferrer"><Store size={16} /> {customOnly ? 'View customisation page' : 'View website'}</a>
          <div className="ad-who"><b>{admin.name}</b><small>{admin.email} · {admin.role}</small></div>
          <button type="button" className="ad-btn" onClick={signOut}><LogOut size={15} /> Sign out</button>
        </div>
      </aside>
      <main className="ad-main">
        {customOnly ? <Routes>
          <Route index element={<Orders key="custom" admin={admin} customOnly />} />
          <Route path="orders" element={<Navigate to={base} replace />} />
          <Route path="products" element={<CustomProducts />} />
          <Route path="catalog" element={<Catalog title="Global print rates" />} />
          <Route path="account" element={<MyAccount admin={admin} />} />
          <Route path="*" element={<Navigate to={base} replace />} />
        </Routes> : <Routes>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<Orders key="all" admin={admin} />} />
          <Route path="custom-orders" element={<Navigate to={`/custom-admin${location.search}`} replace />} />
          <Route path="customers" element={<Customers />} />
          <Route path="catalog" element={<Navigate to="/custom-admin/catalog" replace />} />
          <Route path="home" element={<HomePage />} />
          <Route path="products" element={<Products />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="image-storage" element={<ImageStorage />} />
          <Route path="coupons" element={<Coupons />} />
          <Route path="team" element={admin.role === 'owner' ? <Team me={admin} /> : <Navigate to="/admin" replace />} />
          <Route path="activity" element={<ActivityLog />} />
          <Route path="account" element={<MyAccount admin={admin} />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>}
      </main>
    </div>
  );
}
