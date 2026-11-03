import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, Heart, ShoppingBag, Trash2 } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext.jsx';
import { rupees } from '../studio/pricing.js';

export default function Wishlist() {
  const { items, remove } = useWishlist();

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, []);

  return (
    <div className="wrap wl">
      <nav className="pd-crumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link><ChevronRight size={12} /><b>Wishlist</b>
      </nav>
      <div className="wl-head">
        <h1>Your wishlist</h1>
        {items.length > 0 && <span>{items.length} saved {items.length === 1 ? 'item' : 'items'}</span>}
      </div>

      {items.length === 0 ? (
        <div className="co-done">
          <span className="co-done-ico"><Heart size={30} /></span>
          <h2 className="wl-empty-title">Nothing saved yet</h2>
          <p className="co-lead">Tap the heart on any design to keep it here for later.</p>
          <div className="co-done-links">
            <Link to="/#trending" className="btn btn-lime-solid">Browse designs</Link>
            <Link to="/print-on-demand" className="btn btn-ghost">Create your own</Link>
          </div>
        </div>
      ) : (
        <ul className="wl-grid">
          {items.map((i) => (
            <li key={i.id} className="wl-card">
              <Link to={i.href} className="wl-img" aria-label={`View ${i.name}`}>
                {i.img ? <img src={i.img} alt={i.name} loading="lazy" /> : <ShoppingBag size={28} />}
              </Link>
              <div className="wl-body">
                <h3><Link to={i.href}>{i.name}</Link></h3>
                <p>{i.price != null ? rupees(i.price) : 'Price at confirmation'}</p>
                <div className="wl-actions">
                  <Link to={i.href} className="btn btn-lime-solid">Choose options <ArrowRight size={14} /></Link>
                  <button type="button" className="wl-remove" onClick={() => remove(i.id)} aria-label={`Remove ${i.name} from wishlist`}><Trash2 size={16} /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
