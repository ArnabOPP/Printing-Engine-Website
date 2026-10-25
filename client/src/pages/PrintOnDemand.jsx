import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, Check, ArrowRight, Shirt, Printer, Coffee, KeyRound, NotebookPen, Pen, Folder, ShoppingBag, BadgeCheck,
  GlassWater, Frame, CreditCard, Contact, IdCard, Sticker, Tag, FileText, Receipt, Stamp, Layers, Image, Scissors,
  HardHat, Droplets, ChevronRight,
} from 'lucide-react';
import { printGroups } from '../printProducts.js';

const icons = {
  Shirt, Printer, Coffee, KeyRound, NotebookPen, Pen, Folder, ShoppingBag, BadgeCheck, GlassWater, Frame, CreditCard,
  Contact, IdCard, Sticker, Tag, FileText, Receipt, Stamp, Layers, Image, Scissors, HardHat, Droplets,
};

function ProductCard({ item, selected, onSelect }) {
  const Icon = icons[item.icon] || Shirt;
  return (
    <button
      type="button"
      className={`pod-card${selected ? ' on' : ''}`}
      aria-pressed={selected}
      onClick={() => onSelect(item)}
    >
      <span className="pod-card-img">
        {item.img ? (
          <img src={item.img} alt="" loading="lazy" />
        ) : (
          <span className="pod-icon"><Icon size={44} strokeWidth={1.5} /></span>
        )}
        {selected && <span className="pod-check"><Check size={16} strokeWidth={3} /></span>}
      </span>
      <span className="pod-card-body">
        <strong>{item.name}</strong>
        {item.spec && <small>{item.spec}</small>}
      </span>
    </button>
  );
}

export default function PrintOnDemand() {
  const navigate = useNavigate();
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

  return (
    <div className="pod">
      <section className="pod-hero">
        <div className="wrap">
          <nav className="pd-crumbs" aria-label="Breadcrumb">
            <Link to="/">Home</Link><ChevronRight size={12} /><b>Print on Demand</b>
          </nav>
          <span className="pill"><i /> PRINT ON DEMAND</span>
          <h1>What do you want to<br /><span>customise?</span></h1>
          <p>Choose a product to start. Pick from {total} products across T-shirts, gifts, cards, stickers and business printing.</p>
        </div>
      </section>

      <div className="wrap">
        <div className="pod-toolbar">
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
          <section className="pod-group" key={g.id} aria-labelledby={`g-${g.id}`}>
            <div className="pod-group-head">
              <span className="pod-num">{g.number}</span>
              <div>
                <h2 id={`g-${g.id}`}>{g.name}</h2>
                <p>{g.blurb}</p>
              </div>
            </div>
            <div className="pod-grid">
              {g.items.map((it) => (
                <ProductCard key={it.slug} item={it} selected={selected?.slug === it.slug} onSelect={setSelected} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className={`pod-bar${selected ? ' show' : ''}`} aria-hidden={!selected}>
        <div className="wrap pod-bar-in">
          <div>
            <small>Selected</small>
            <strong>{selected ? `${selected.name}${selected.spec ? ` — ${selected.spec}` : ''}` : ''}</strong>
          </div>
          <button className="btn btn-lime-solid" tabIndex={selected ? 0 : -1} onClick={() => navigate(`/customise/${selected.slug}`)}>
            Continue <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
