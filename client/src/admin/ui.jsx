import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

export const rupees = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
export const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtTime = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export const STATUS_LABEL = {
  placed: 'New', confirmed: 'Confirmed', printing: 'Printing', ready: 'Ready to ship', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
};
export const PAY_LABEL = { cod: 'Cash on delivery', upi: 'UPI / online' };

export const StatusBadge = ({ status }) => <span className={`ad-badge st-${status}`}>{STATUS_LABEL[status] || status}</span>;

// Loads data from the admin API and keeps it fresh. `reload()` fetches again.
export function useLoad(path) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    api(path)
      .then((data) => setState({ data, error: '', loading: false }))
      .catch((e) => setState({ data: null, error: e.message, loading: false }));
  }, [path]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

export const Loading = ({ error, loading }) => {
  if (error) return <p className="ad-error" role="alert">{error}</p>;
  return loading ? <p className="ad-muted">Loading…</p> : null;
};

export function PageHead({ title, children }) {
  return (
    <div className="ad-pagehead">
      <h1>{title}</h1>
      <div className="ad-pagehead-tools">{children}</div>
    </div>
  );
}

/* ---------- editing website content ---------- */

import { assetUrl } from '../api.js';
import { Trash2, Upload, ArrowUp, ArrowDown } from 'lucide-react';

// Sends one picture to the server and returns the address to store (for example /uploads/abc.jpg).
export function uploadImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') { reject(new Error('Choose a PNG, JPG, WebP or GIF picture.')); return; }
    if (file.size > 8 * 1024 * 1024) { reject(new Error(`${file.name} is over 8 MB. Please use a smaller picture.`)); return; }
    const reader = new FileReader();
    reader.onload = () => api('/api/admin/uploads', { method: 'POST', body: { data: reader.result } }).then((r) => resolve(r.url), reject);
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

// Saves some parts of the website content without overwriting the other parts another admin may just have changed.
export async function saveContent(partial) {
  const { content } = await api('/api/admin/content');
  const { content: saved } = await api('/api/admin/content', { method: 'PUT', body: { content: { ...content, ...partial } } });
  return saved;
}

// Pictures for one thing (a product, a section). `max` is how many are allowed. The first one is the main picture.
export function ImageList({ value, onChange, max = 6, label = 'Pictures', main = true }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const add = async (files) => {
    setBusy(true);
    setErr('');
    try {
      const urls = [];
      for (const f of [...files].slice(0, max - value.length)) urls.push(await uploadImage(f));
      onChange([...value, ...urls]);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const move = (i, d) => { const c = [...value]; [c[i], c[i + d]] = [c[i + d], c[i]]; onChange(c); };

  return (
    <div className="ad-images">
      <span className="ad-lbl">{label}</span>
      <div className="ad-thumbs">
        {value.map((src, i) => (
          <figure key={`${src}${i}`} className="ad-thumb">
            <img src={assetUrl(src)} alt="" />
            {main && i === 0 && <em>Main</em>}
            <figcaption>
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move earlier"><ArrowUp size={13} /></button>
              <button type="button" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label="Move later"><ArrowDown size={13} /></button>
              <button type="button" onClick={() => onChange(value.filter((_, k) => k !== i))} aria-label="Remove picture"><Trash2 size={13} /></button>
            </figcaption>
          </figure>
        ))}
        {value.length < max && (
          <label className="ad-add">
            <Upload size={18} /><span>{busy ? 'Uploading…' : 'Add'}</span>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple={max > 1} hidden disabled={busy} onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
          </label>
        )}
      </div>
      {err && <p className="ad-error" role="alert">{err}</p>}
    </div>
  );
}
