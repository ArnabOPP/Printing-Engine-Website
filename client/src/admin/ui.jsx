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
