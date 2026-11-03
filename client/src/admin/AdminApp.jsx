import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Activity, LayoutDashboard, LogOut, Package, Settings, Store, Tags, Users, UserCog } from 'lucide-react';
import { api } from '../api.js';
import './admin.css';
import Dashboard from './Dashboard.jsx';
import Orders from './Orders.jsx';
import Customers from './Customers.jsx';
import Catalog from './Catalog.jsx';
import Team from './Team.jsx';
import { ActivityLog, MyAccount } from './Misc.jsx';

function Login({ onDone }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { admin } = await api('/api/admin/login', { method: 'POST', body: { email, password } });
      onDone(admin);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ad ad-login">
      <form className="ad-login-card" onSubmit={submit}>
        <img src="/logo.jpg" alt="" width="56" height="56" />
        <h1>Admin sign in</h1>
        <p className="ad-muted">For the Printing Engine team only.</p>
        <label>Email<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p className="ad-error" role="alert">{error}</p>}
        <button className="ad-btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}

const links = [
  ['/admin', 'Dashboard', LayoutDashboard, true],
  ['/admin/orders', 'Orders', Package],
  ['/admin/customers', 'Customers', Users],
  ['/admin/catalog', 'Products & prices', Tags],
  ['/admin/team', 'Admin team', UserCog, false, 'owner'],
  ['/admin/activity', 'Activity', Activity],
  ['/admin/account', 'My account', Settings],
];

export default function AdminApp() {
  const [admin, setAdmin] = useState(undefined); // undefined: checking, null: signed out
  const navigate = useNavigate();

  // This area is for the team only: keep it out of search results.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const title = document.title;
    document.title = 'Admin – Printing Engine';
    return () => { meta.remove(); document.title = title; };
  }, []);

  useEffect(() => {
    api('/api/admin/me').then((d) => setAdmin(d.admin)).catch(() => setAdmin(null));
  }, []);

  const signOut = async () => {
    try { await api('/api/admin/logout', { method: 'POST' }); } catch { /* ignore */ }
    setAdmin(null);
    navigate('/admin');
  };

  if (admin === undefined) return <div className="ad"><p className="ad-muted ad-center">Loading…</p></div>;
  if (!admin) return <Login onDone={setAdmin} />;

  return (
    <div className="ad ad-shell">
      <aside className="ad-side">
        <div className="ad-brand"><img src="/logo.jpg" alt="" width="36" height="36" /><b>Admin</b></div>
        <nav aria-label="Admin">
          {links.filter(([, , , , need]) => !need || admin.role === need).map(([to, label, Icon, end]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'on' : '')}><Icon size={17} /> {label}</NavLink>
          ))}
        </nav>
        <div className="ad-side-foot">
          <a href="/" target="_blank" rel="noreferrer"><Store size={16} /> View website</a>
          <div className="ad-who"><b>{admin.name}</b><small>{admin.email} · {admin.role}</small></div>
          <button type="button" className="ad-btn" onClick={signOut}><LogOut size={15} /> Sign out</button>
        </div>
      </aside>
      <main className="ad-main">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<Orders admin={admin} />} />
          <Route path="customers" element={<Customers />} />
          <Route path="catalog" element={<Catalog />} />
          <Route path="team" element={admin.role === 'owner' ? <Team me={admin} /> : <Navigate to="/admin" replace />} />
          <Route path="activity" element={<ActivityLog />} />
          <Route path="account" element={<MyAccount admin={admin} />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}
