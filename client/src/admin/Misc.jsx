import { useState } from 'react';
import { api } from '../api.js';
import { Loading, PageHead, fmtTime, useLoad } from './ui.jsx';
import { resetAdminPassword } from './firebaseAuth.js';
import { authMessage } from '../firebase.js';

export function ActivityLog() {
  const { data, error, loading, reload } = useLoad('/api/admin/activity');
  return (
    <>
      <PageHead title="Activity"><button type="button" className="ad-btn" onClick={reload}>Refresh</button></PageHead>
      <p className="ad-muted">A record of who did what: new orders, status changes, price edits and sign-ins.</p>
      <section className="ad-card flush">
        {!data ? <Loading error={error} loading={loading} /> : (
          <div className="ad-scroll">
            <table className="ad-table">
              <thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr></thead>
              <tbody>
                {data.activity.map((a, i) => <tr key={i}><td>{fmtTime(a.at)}</td><td>{a.by}</td><td><span className="ad-pill">{a.action}</span></td><td>{a.detail}</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export function MyAccount({ admin }) {
  const [form, setForm] = useState({ current: '', next: '', again: '' });
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  if (admin.authProvider === 'firebase') return (
    <>
      <PageHead title="My account" />
      <section className="ad-card"><h2>{admin.name}</h2><p className="ad-muted">{admin.email} · {admin.role}</p>
        <p>Your sign-in is managed by Firebase Authentication.</p>
        <button className="ad-btn" disabled={busy || !admin.email} onClick={async () => {
          setBusy(true); setMsg('');
          try { await resetAdminPassword(admin.email); setOk(true); setMsg('A password-reset link has been requested for your Firebase account.'); }
          catch (err) { setOk(false); setMsg(err.code ? authMessage(err) : err.message); }
          finally { setBusy(false); }
        }}>Send password-reset email</button>
        {msg && <p className={ok ? 'ad-note' : 'ad-error'} role="status">{msg}</p>}
      </section>
    </>
  );

  const submit = async (e) => {
    e.preventDefault();
    setMsg('');
    if (form.next !== form.again) { setOk(false); setMsg('The two new passwords do not match.'); return; }
    setBusy(true);
    try {
      await api('/api/admin/me/password', { method: 'POST', body: { current: form.current, next: form.next } });
      setOk(true);
      setMsg('Password changed. Your other sign-ins were ended.');
      setForm({ current: '', next: '', again: '' });
    } catch (err) {
      setOk(false);
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title="My account" />
      <section className="ad-card">
        <h2>{admin.name}</h2>
        <p className="ad-muted">{admin.email} · {admin.role}</p>
      </section>
      <section className="ad-card">
        <h2>Change password</h2>
        <form className="ad-fields" onSubmit={submit}>
          <label className="ad-field">Current password<input type="password" autoComplete="current-password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} required /></label>
          <label className="ad-field">New password<input type="password" autoComplete="new-password" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} required minLength={10} /></label>
          <label className="ad-field">New password again<input type="password" autoComplete="new-password" value={form.again} onChange={(e) => setForm({ ...form, again: e.target.value })} required /></label>
          <div className="ad-field"><span>&nbsp;</span><button className="ad-btn primary" disabled={busy}>Change password</button></div>
        </form>
        {msg && <p className={ok ? 'ad-note' : 'ad-error'} role="status">{msg}</p>}
        <p className="ad-muted">Use at least 10 characters with letters and a number.</p>
      </section>
    </>
  );
}
