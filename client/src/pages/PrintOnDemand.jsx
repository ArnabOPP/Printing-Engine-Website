import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, Check, ArrowRight, ArrowUpRight, Shirt, Printer, Coffee, CreditCard, Sticker, FileText,
  ChevronRight, MousePointerClick, Upload, PackageCheck,
} from 'lucide-react';
import { printGroups, fromBase, printFrom } from '../printProducts.js';
import { fmtRate } from '../studio/pricing.js';
import { productIcons as icons } from '../productIcons.js';

const groupVisual = {
  't-shirts': { img: '/cat-tee.jpeg', icon: Shirt },
  'printing-services': { icon: Printer },
  'customised-products': { img: '/cat-mug.jpeg', icon: Coffee },
  'cards-identification': { icon: CreditCard },
  'stickers-labels': { img: '/cat-sticker.jpeg', icon: Sticker },
  'business-printing': { icon: FileText },
};

const words = ['T-shirts', 'mugs', 'stickers', 'keychains', 'tote bags', 'visiting cards', 'photo frames'];

const steps = [
  [MousePointerClick, 'Choose a product'],
  [Upload, 'Add your design'],
  [PackageCheck, 'We print & deliver'],
];

const collage = ['/cat-tee.jpeg', '/cat-mug.jpeg', '/cat-key.jpeg', '/cat-tote.jpeg', '/cat-sticker.jpeg', '/cat-frame.jpeg'];

function RotatingWord() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const t = setInterval(() => setI((n) => (n + 1) % words.length), 2200);
    return () => clearInterval(t);
  }, []);
  return <span key={i} className="pod-rot">{words[i]}</span>;
}

function ProductCard({ item, index, selected, onSelect }) {
  const Icon = icons[item.icon] || Shirt;
  return (
    <button
      type="button"
      className={`pod-card${selected ? ' on' : ''}`}
      style={{ '--i': index }}
      aria-pressed={selected}
      onClick={() => onSelect(item)}
    >
      <span className="pod-card-img">
        {item.img ? (
          <img src={item.img} alt="" loading="lazy" />
        ) : (
          <span className="pod-icon"><Icon size={44} strokeWidth={1.5} /></span>
        )}
        {selected ? (
          <span className="pod-check"><Check size={16} strokeWidth={3} /></span>
        ) : (
          <span className="pod-go">Customise <ArrowUpRight size={14} /></span>
        )}
      </span>
      <span className="pod-card-body">
        <strong>{item.name}</strong>
        {item.spec && <small>{item.spec}</small>}
        {item.colors.length > 0 && (
          <span className="pod-colors" role="img" aria-label={`Colours: ${item.colors.map((c) => c.name).join(', ')}`}>
            {item.colors.slice(0, 6).map((c) => (
              <i key={c.name} title={c.name} style={{ background: c.hex }} />
            ))}
            {item.colors.length > 6 && <em>+{item.colors.length - 6}</em>}
          </span>
        )}
        {item.pricing && <span className="pod-price">From <b>₹{fromBase(item.pricing)}</b> <small>+ print from ₹{fmtRate(printFrom(item.pricing))}/sq in</small></span>}
        {item.fabric && (
          <span className="pod-fabric">
            <b>Material</b>
            {item.fabric.material && <span className="pod-fabric-name">{item.fabric.material}</span>}
            {item.fabric.options.length > 0 && (
              <span className="pod-quals">
                {item.fabric.options.map((o) => <i key={o}>{o}</i>)}
              </span>
            )}
          </span>
        )}
      </span>
    </button>
  );
}

export default function PrintOnDemand() {
  const navigate = useNavigate();
  const listRef = useRef(null);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);

  const q = query.trim().toLowerCase();
  const groups = useMemo(
    () =>
      printGroups
        .filter((g) => category === 'all' || g.id === category)
        .map((g) => ({
          ...g,
          items: g.items.filter((it) => !q || `${it.name} ${it.spec || ''} ${g.name}`.toLowerCase().includes(q)),
        }))
        .filter((g) => g.items.length),
    [category, q],
  );

  const total = printGroups.reduce((n, g) => n + g.items.length, 0);

  const pickCategory = (id) => {
    setCategory(id);
    setQuery('');
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  // Keep the last selection around so the bar's text doesn't vanish while it slides away.
  const lastSelected = useRef(null);
  if (selected) lastSelected.current = selected;
  const shown = selected || lastSelected.current;
  const SelIcon = shown ? icons[shown.icon] || Shirt : Shirt;

  return (
    <div className="pod">
      <section className="pod-hero">
        <div className="wrap pod-hero-in">
          <div className="pod-hero-copy">
            <nav className="pd-crumbs" aria-label="Breadcrumb">
              <Link to="/">Home</Link><ChevronRight size={12} /><b>Print on Demand</b>
            </nav>
            <span className="pill"><i /> PRINT ON DEMAND</span>
            <h1>What do you want to<br /><span>customise?</span></h1>
            <p className="pod-make">Make your own <RotatingWord /></p>
            <p className="pod-sub">Choose a product to start. {total} products across T-shirts, gifts, cards, stickers and business printing.</p>
            <ol className="pod-steps" aria-label="How it works">
              {steps.map(([I, label], n) => (
                <li key={label} className={n === 0 ? 'on' : ''}>
                  <span><I size={16} /></span>{label}
                </li>
              ))}
            </ol>
          </div>
          <div className="pod-collage" aria-hidden="true">
            {collage.map((src, n) => (
              <img key={src} src={src} alt="" className={`c${n + 1}`} />
            ))}
          </div>
        </div>
      </section>

      <div className="wrap">
        <div className="pod-tiles">
          {printGroups.map((g, n) => {
            const v = groupVisual[g.id];
            const Ic = v.icon;
            return (
              <button key={g.id} type="button" className={`pod-tile${v.img ? ' photo' : ''}`} style={{ '--i': n }} onClick={() => pickCategory(g.id)}>
                {v.img ? <img src={v.img} alt="" loading="lazy" /> : <span className="pod-tile-icon"><Ic size={54} strokeWidth={1.4} /></span>}
                <span className="pod-tile-shade" />
                <span className="pod-tile-text">
                  <small>{g.number}</small>
                  <strong>{g.name}</strong>
                  <em>{g.items.length} products <ArrowRight size={13} /></em>
                </span>
              </button>
            );
          })}
        </div>

        <div className="pod-toolbar" ref={listRef}>
          <div className="pod-chips" role="tablist" aria-label="Product categories">
            <button role="tab" aria-selected={category === 'all'} className={category === 'all' ? 'on' : ''} onClick={() => setCategory('all')}>
              All <small>{total}</small>
            </button>
            {printGroups.map((g) => (
              <button key={g.id} role="tab" aria-selected={category === g.id} className={category === g.id ? 'on' : ''} onClick={() => setCategory(g.id)}>
                {g.name} <small>{g.items.length}</small>
              </button>
            ))}
          </div>
          <label className="pod-search">
            <Search size={16} />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products…" aria-label="Search products" />
          </label>
        </div>

        {groups.length === 0 && <p className="pod-empty">No products match “{query}”. Try a different word or category.</p>}

        {groups.map((g) => (
          <section className="pod-group" key={`${g.id}-${category}`} aria-labelledby={`g-${g.id}`}>
            <div className="pod-group-head">
              <span className="pod-num">{g.number}</span>
              <div>
                <h2 id={`g-${g.id}`}>{g.name}</h2>
                <p>{g.blurb}</p>
              </div>
            </div>
            <div className="pod-grid">
              {g.items.map((it, n) => (
                <ProductCard
                  key={it.slug}
                  item={it}
                  index={n}
                  selected={selected?.slug === it.slug}
                  onSelect={(item) => setSelected((cur) => (cur?.slug === item.slug ? null : item))}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className={`pod-bar${selected ? ' show' : ''}`} aria-hidden={!selected}>
        <div className="wrap pod-bar-in">
          <div className="pod-bar-sel">
            <span className="pod-bar-thumb">
              {shown?.img ? <img src={shown.img} alt="" /> : <SelIcon size={22} />}
            </span>
            <div>
              <small>Selected · step 1 of 3 · tap again to deselect</small>
              <strong>{shown ? `${shown.name}${shown.spec ? ` — ${shown.spec}` : ''}` : ''}</strong>
            </div>
          </div>
          <button className="btn btn-lime-solid" tabIndex={selected ? 0 : -1} onClick={() => navigate(`/customise/${selected.slug}`)}>
            Continue <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
