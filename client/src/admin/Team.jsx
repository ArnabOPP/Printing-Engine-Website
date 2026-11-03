import { useState } from 'react';
import { KeyRound, UserMinus, UserPlus } from 'lucide-react';
import { api } from '../api.js';
import { Loading, PageHead, fmtDate, fmtTime, useLoad } from './ui.jsx';

export default function Team({ me }) {
  const { data, error, loading, reload } = useLoad('/api/admin/admins');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn, ok) => {
    setBusy(true);
    setMsg('');
    try { await fn(); setMsg(ok); reload(); } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };

  const add = (e) => {
    e.preventDefault();
    run(async () => { await api('/api/admin/admins', { method: 'POST', body: form }); setForm({ name: '', email: '', password: '' }); }, 'Admin added. Share the password with them privately.');
  };

  const resetPw = (a) => {
    const password = window.prompt(`New password for ${a.email} (10+ characters, letters and a number):`);
    if (password) run(() => api(`/api/admin/admins/${a.id}`, { method: 'PATCH', body: { password } }), 'Password changed. They are signed out everywhere.');
  };

  return (
    <>
      <PageHead title="Admin team" />
      <p className="ad-muted">Everyone here can manage orders, customers, prices and products. Only the owner can add or remove admins and delete orders.</p>
      {msg && <p className="ad-note" role="status">{msg}</p>}

      <section className="ad-card flush">
        {!data ? <Loading error={error} loading={loading} /> : (
          <div className="ad-scroll">
            <table className="ad-table">
              <thead><tr><th>Name</th><th>Role</th><th>Last sign-in</th><th>Added</th><th /></tr></thead>
              <tbody>
                {data.admins.map((a) => (
                  <tr key={a.id}>
                    <td><b>{a.name}</b><small>{a.email}</small></td>
                    <td><span className={`ad-pill${a.role === 'owner' ? ' lime' : ''}`}>{a.role}</span>{a.disabled && <span className="ad-pill red">disabled</span>}</td>
                    <td>{a.lastLoginAt ? fmtTime(a.lastLoginAt) : 'Never'}</td>
                    <td>{fmtDate(a.createdAt)}</td>
                    <td className="ad-rowtools">
                      {a.role !== 'owner' && (
                        <>
                          <button type="button" className="ad-btn" disabled={busy} onClick={() => resetPw(a)}><KeyRound size={14} /> Password</button>
                          <button type="button" className="ad-btn" disabled={busy} onClick={() => run(() => api(`/api/admin/admins/${a.id}`, { method: 'PATCH', body: { disabled: !a.disabled } }), a.disabled ? 'Admin enabled.' : 'Admin disabled and signed out.')}>{a.disabled ? 'Enable' : 'Disable'}</button>
                          <button type="button" className="ad-btn danger" disabled={busy} onClick={() => window.confirm(`Remove ${a.email}?`) && run(() => api(`/api/admin/admins/${a.id}`, { method: 'DELETE' }), 'Admin removed.')}><UserMinus size={14} /></button>
                        </>
                      )}
                      {a.id === me.id && a.role === 'owner' && <small className="ad-muted">This is you</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="ad-card">
        <h2><UserPlus size={16} /> Add an admin</h2>
        <form className="ad-fields" onSubmit={add}>
          <label className="ad-field">Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label className="ad-field">Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
          <label className="ad-field">Password<input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={10} /></label>
          <div className="ad-field"><span>&nbsp;</span><button className="ad-btn primary" disabled={busy}>Add admin</button></div>
        </form>
      </section>
    </>
  );
}
