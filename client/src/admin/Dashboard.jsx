import { Link } from 'react-router-dom';
import { IndianRupee, Package, Timer, Users, AlertCircle, CalendarDays } from 'lucide-react';
import { Loading, PageHead, STATUS_LABEL, StatusBadge, fmtTime, rupees, useLoad } from './ui.jsx';

function Tile({ icon: Icon, label, value, hint }) {
  return (
    <div className="ad-tile">
      <span className="ad-tile-ico"><Icon size={18} /></span>
      <div><small>{label}</small><b>{value}</b>{hint && <em>{hint}</em>}</div>
    </div>
  );
}

export default function Dashboard() {
  const { data, error, loading, reload } = useLoad('/api/admin/stats');
  if (!data) return <><PageHead title="Dashboard" /><Loading error={error} loading={loading} /></>;
  const { totals, byStatus, days, top, recent } = data;
  const peak = Math.max(1, ...days.map((d) => d.orders));

  return (
    <>
      <PageHead title="Dashboard"><button type="button" className="ad-btn" onClick={reload}>Refresh</button></PageHead>

      <div className="ad-tiles">
        <Tile icon={Package} label="Orders" value={totals.orders} hint={`${totals.open} open`} />
        <Tile icon={CalendarDays} label="Today" value={totals.today} hint={rupees(totals.todayRevenue)} />
        <Tile icon={IndianRupee} label="Revenue (priced items)" value={rupees(totals.revenue)} hint={totals.discounts ? `after ${rupees(totals.discounts)} of coupons` : 'cancelled orders left out'} />
        <Tile icon={Users} label="Customers" value={totals.customers} />
        <Tile icon={AlertCircle} label="Need a price" value={totals.needsPrice} hint="orders with unpriced items" />
      </div>

      <div className="ad-grid2">
        <section className="ad-card">
          <h2>Orders, last 14 days</h2>
          <div className="ad-bars" role="img" aria-label="Orders per day for the last 14 days">
            {days.map((d) => (
              <div key={d.date} className="ad-bar" title={`${d.date}: ${d.orders} orders, ${rupees(d.revenue)}`}>
                <i style={{ height: `${(d.orders / peak) * 100}%` }} />
                <small>{d.date.slice(8)}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="ad-card">
          <h2>By status</h2>
          <ul className="ad-statuslist">
            {Object.entries(byStatus).map(([s, n]) => (
              <li key={s}><Link to={`/admin/orders?status=${s}`}><StatusBadge status={s} /> <b>{n}</b></Link></li>
            ))}
          </ul>
        </section>
      </div>

      <div className="ad-grid2">
        <section className="ad-card">
          <h2>Latest orders</h2>
          {recent.length === 0 ? <p className="ad-muted">No orders yet.</p> : (
            <table className="ad-table">
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id}>
                    <td><Link to={`/admin/orders?open=${o.id}`}><b>{o.id}</b></Link><small>{fmtTime(o.createdAt)}</small></td>
                    <td>{o.customer.name}<small>{o.customer.city}</small></td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className="num">{o.unpriced ? `${rupees(o.total ?? o.subtotal)}+` : rupees(o.total ?? o.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="ad-card">
          <h2>Best sellers</h2>
          {top.length === 0 ? <p className="ad-muted">Nothing sold yet.</p> : (
            <ol className="ad-top">
              {top.map((t) => <li key={t.name}><span>{t.name}</span><b>{t.qty}</b></li>)}
            </ol>
          )}
          <p className="ad-muted ad-foot"><Timer size={13} /> Status flow: {Object.values(STATUS_LABEL).slice(0, 5).join(' → ')}</p>
        </section>
      </div>
    </>
  );
}
