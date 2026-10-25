import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Star, ZoomIn, ZoomOut, Minus, Plus, ShoppingBag, Zap, Check, Printer, Leaf, Banknote, RotateCcw, Ruler, ChevronRight,
} from 'lucide-react';
import { products } from '../data.js';
import { useCart } from '../context/CartContext.jsx';
import NotFound from './NotFound.jsx';

const perks = [
  [Printer, 'Premium DTF Print'],
  [Leaf, '100% Cotton (180 GSM)'],
  [Banknote, 'Cash on Delivery Available'],
  [RotateCcw, 'Easy Returns'],
];

const tabs = ['Description', 'Fabric & Care', 'Shipping', 'Reviews'];

function Gallery({ product }) {
  const views = [
    { label: 'Front', src: product.img },
    { label: 'Print detail', src: product.img, crop: true },
    { label: 'Close up', src: product.img, crop: true, alt: true },
  ];
  const [idx, setIdx] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');
  const v = views[idx];

  const onMove = (e) => {
    if (!zoomed) return;
    const r = e.currentTarget.getBoundingClientRect();
    setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
  };

  const baseScale = v.crop ? (v.alt ? 2.2 : 1.7) : 1;
  const scale = zoomed ? baseScale * 1.6 : baseScale;

  return (
    <div className="pd-gallery">
      <div className="pd-thumbs">
        {views.map((x, i) => (
          <button key={x.label} className={i === idx ? 'on' : ''} onClick={() => { setIdx(i); setZoomed(false); }} aria-label={`Show ${x.label}`}>
            <img src={x.src} alt="" style={x.crop ? { transform: `scale(${x.alt ? 2.2 : 1.7})` } : undefined} />
          </button>
        ))}
      </div>
      <div className="pd-main" onMouseMove={onMove} onMouseLeave={() => setOrigin('50% 50%')}>
        <img
          src={v.src}
          alt={`${product.name} – ${v.label}`}
          style={{ transform: `scale(${scale})`, transformOrigin: zoomed ? origin : '50% 45%' }}
        />
        <button className="pd-zoom" onClick={() => setZoomed((z) => !z)} aria-label={zoomed ? 'Zoom out' : 'Zoom in'}>
          {zoomed ? <ZoomOut size={18} /> : <ZoomIn size={18} />}
        </button>
      </div>
    </div>
  );
}

export default function Product() {
  const { slug } = useParams();
  const product = products.find((p) => p.slug === slug);
  const { add } = useCart();

  const [color, setColor] = useState(0);
  const [size, setSize] = useState(null);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState(0);
  const [note, setNote] = useState('');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setColor(0); setSize(null); setQty(1); setTab(0); setNote('');
    if (product) document.title = `${product.name} – Printing Engine`;
    return () => { document.title = 'Printing Engine – Your Ideas. Our Prints.'; };
  }, [slug, product]);

  useEffect(() => {
    if (!note) return undefined;
    const t = setTimeout(() => setNote(''), 2600);
    return () => clearTimeout(t);
  }, [note]);

  if (!product) return <NotFound />;

  const needSize = () => {
    if (size) return false;
    setNote('Please choose a size first.');
    return true;
  };
  const addToCart = () => {
    if (needSize()) return;
    add(qty);
    setNote(`Added ${qty} × ${product.name} (${size}) to your cart.`);
  };
  const buyNow = () => {
    if (needSize()) return;
    add(qty);
    setNote('Added to cart. Checkout is not connected yet.');
  };

  return (
    <div className="wrap pd">
      <nav className="pd-crumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link><ChevronRight size={12} />
        <a href="/#categories">T-Shirts</a><ChevronRight size={12} />
        <a href="/#originals">{product.brand}</a><ChevronRight size={12} />
        <b>{product.name}</b>
      </nav>

      <div className="pd-top">
        <Gallery key={product.slug} product={product} />

        <div className="pd-info">
          <h1>{product.name}</h1>
          <span className="pd-brand">{product.brand}</span>
          <div className="pd-price-row">
            <span className="pd-price">₹{product.price}</span>
            <span className="pd-rating"><Star size={15} fill="currentColor" /> {product.rating} <small>({product.reviewCount} reviews)</small></span>
          </div>
          <p className="pd-blurb">{product.blurb}</p>

          <div className="pd-label">Colour</div>
          <div className="pd-colors" role="radiogroup" aria-label="Colour">
            {product.colors.map((c, i) => (
              <button key={c} role="radio" aria-checked={i === color} aria-label={`Colour ${i + 1}`}
                className={i === color ? 'on' : ''} style={{ background: c }} onClick={() => setColor(i)} />
            ))}
          </div>

          <div className="pd-label">Size</div>
          <div className="pd-sizes" role="radiogroup" aria-label="Size">
            {product.sizes.map((s) => (
              <button key={s} role="radio" aria-checked={s === size} className={s === size ? 'on' : ''} onClick={() => setSize(s)}>{s}</button>
            ))}
          </div>
          <a className="pd-guide" href="/#footer"><Ruler size={14} /> Size Guide</a>

          <div className="pd-qty-row">
            <div className="pd-qty">
              <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Decrease quantity"><Minus size={14} /></button>
              <span>{qty}</span>
              <button onClick={() => setQty(qty + 1)} aria-label="Increase quantity"><Plus size={14} /></button>
            </div>
            <span className="pd-total">₹{product.price * qty}</span>
          </div>

          <button className="btn btn-lime-solid pd-cta" onClick={addToCart}><ShoppingBag size={18} /> Add to Cart</button>
          <button className="btn pd-buy" onClick={buyNow}><Zap size={18} /> Buy Now</button>
          <p className="pd-note" role="status" aria-live="polite">{note}</p>
        </div>
      </div>

      <ul className="pd-perks">
        {perks.map(([I, t]) => <li key={t}><I size={20} />{t}</li>)}
      </ul>

      <section className="pd-tabs-card">
        <div className="pd-tabs" role="tablist">
          {tabs.map((t, i) => (
            <button key={t} role="tab" aria-selected={i === tab} className={i === tab ? 'on' : ''} onClick={() => setTab(i)}>
              {i === 3 ? `${t} (${product.reviewCount})` : t}
            </button>
          ))}
        </div>

        <div className="pd-panel" role="tabpanel">
          {tab === 0 && (
            <div className="pd-desc">
              <div>
                <p>{product.description}</p>
                <ul className="pd-checks">
                  {product.features.map((f) => <li key={f}><Check size={16} />{f}</li>)}
                </ul>
              </div>
              <div className="pd-detail" aria-hidden="true"><img src={product.img} alt="" /></div>
            </div>
          )}
          {tab === 1 && (
            <ul className="pd-checks">
              {product.care.map((f) => <li key={f}><Check size={16} />{f}</li>)}
            </ul>
          )}
          {tab === 2 && (
            <ul className="pd-checks">
              {product.shipping.map((f) => <li key={f}><Check size={16} />{f}</li>)}
            </ul>
          )}
          {tab === 3 && <p className="pd-muted">Customer reviews will appear here once reviews are connected to the store.</p>}
        </div>
      </section>
    </div>
  );
}
