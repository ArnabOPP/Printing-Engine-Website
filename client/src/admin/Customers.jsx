import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Loading, PageHead, fmtDate, rupees, useLoad } from './ui.jsx';

export default function Customers() {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState('');
  const { data, error, loading } = useLoad(`/api/admin/customers?q=${encodeURIComponent(term)}`);

  useEffect(() => { const t = setTimeout(() => setTerm(q), 300); return () => clearTimeout(t); }, [q]);

  return (
    <>
      <PageHead title="Customers">
        <label className="ad-search"><Search size={15} /><input type="search" placeholder="Search name, phone, email, city" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" /></label>
      </PageHead>
      <p className="ad-muted">Customers are built from their orders: the same email (or phone) is one customer. Shoppers do not have logins yet.</p>

      <section className="ad-card flush">
        {!data ? <Loading error={error} loading={loading} /> : data.customers.length === 0 ? <p className="ad-muted pad">No customers yet.</p> : (
          <div className="ad-scroll">
            <table className="ad-table hover">
              <thead><tr><th>Customer</th><th>Contact</th><th>City</th><th>Orders</th><th className="num">Spent</th><th>Last order</th></tr></thead>
              <tbody>
                {data.customers.map((c) => (
                  <Fragment key={c.key}>
                    <tr tabIndex={0} onClick={() => setOpen(open === c.key ? '' : c.key)} onKeyDown={(e) => e.key === 'Enter' && setOpen(open === c.key ? '' : c.key)}>
                      <td><b>{c.name}</b></td>
                      <td>{c.phone}<small>{c.email}</small></td>
                      <td>{c.city}, {c.state}</td>
                      <td>{c.orders}</td>
                      <td className="num">{rupees(c.spent)}</td>
                      <td>{fmtDate(c.lastOrderAt)}</td>
                    </tr>
                    {open === c.key && (
                      <tr className="ad-expand">
                        <td colSpan={6}>
                          <div className="ad-expand-in">
                            <div><h4>Orders</h4>{c.orderIds.map((id) => <Link key={id} className="ad-tag" to={`/admin/orders?open=${id}`}>{id}</Link>)}</div>
                            <div><h4>Wishlist (saved at checkout)</h4>{c.saved.length ? c.saved.map((w) => <span key={w.href || w.name} className="ad-tag">{w.name}</span>) : <span className="ad-muted">Nothing saved.</span>}</div>
                            <div><h4>Customer since</h4><span>{fmtDate(c.firstOrderAt)}</span> · <a href={`mailto:${c.email}`}>Email</a> · <a href={`tel:${c.phone}`}>Call</a></div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
