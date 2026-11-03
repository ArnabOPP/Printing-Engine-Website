import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Copy } from 'lucide-react';
import { products, sections } from '../data.js';

// Sections the team adds from the admin panel. `page` is which page, `slot` is where on it
// (on the home page: after which built-in section; on other pages: 'top' or 'bottom').

const price = (n) => `₹${n}`;

function Button({ s }) {
  if (!s.buttonText || !s.buttonLink) return null;
  const inner = <>{s.buttonText} <ArrowRight size={14} /></>;
  return s.buttonLink.startsWith('/')
    ? <Link to={s.buttonLink} className="btn btn-lime-solid">{inner}</Link>
    : <a href={s.buttonLink} className="btn btn-lime-solid" {...(s.buttonLink.startsWith('http') ? { target: '_blank', rel: 'noreferrer noopener' } : {})}>{inner}</a>;
}

function Head({ s }) {
  if (!s.title && !s.subtitle) return null;
  return (
    <div className="sec-head">
      <div>{s.title && <h2>{s.title}</h2>}{s.subtitle && <p>{s.subtitle}</p>}</div>
    </div>
  );
}

function CopyCode({ code }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* ignore */ }
  };
  return (
    <button type="button" className="cs-code" onClick={copy} aria-label={`Copy code ${code}`}>
      <b>{code}</b>{done ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

function One({ s }) {
  if (s.type === 'banner') {
    return (
      <section className="wrap cs">
        <div className="cs-banner" style={s.image ? { backgroundImage: `url("${s.image}")` } : undefined}>
          <div>
            {s.title && <h2>{s.title}</h2>}
            {s.subtitle && <p className="cs-sub">{s.subtitle}</p>}
            {s.body && <p>{s.body}</p>}
            {s.code && <CopyCode code={s.code} />}
            <Button s={s} />
          </div>
        </div>
      </section>
    );
  }
  if (s.type === 'offer') {
    return (
      <section className="wrap cs">
        <div className="cs-offer">
          <div>
            {s.title && <h3>{s.title}</h3>}
            {(s.subtitle || s.body) && <p>{s.subtitle || s.body}</p>}
          </div>
          {s.code && <CopyCode code={s.code} />}
          <Button s={s} />
        </div>
      </section>
    );
  }
  if (s.type === 'products') {
    const items = s.productIds.map((id) => products.find((p) => p.id === id)).filter(Boolean);
    if (!items.length) return null;
    return (
      <section className="wrap section cs">
        <Head s={s} />
        <div className="cs-products">
          {items.map((p) => (
            <Link key={p.id} to={`/product/${p.slug}`} className="cs-product">
              <span className="cs-product-img"><img src={p.img} alt={p.name} loading="lazy" /></span>
              <b>{p.name}</b>
              <span>{price(p.price)}{p.comparePrice ? <s>{price(p.comparePrice)}</s> : null}</span>
            </Link>
          ))}
        </div>
        <Button s={s} />
      </section>
    );
  }
  if (s.type === 'gallery') {
    if (!s.images.length) return null;
    return (
      <section className="wrap section cs">
        <Head s={s} />
        <div className="cs-gallery">
          {s.images.map((src, i) => <img key={i} src={src} alt="" loading="lazy" />)}
        </div>
        <Button s={s} />
      </section>
    );
  }
  // text
  return (
    <section className="wrap section cs">
      <div className="cs-text">
        <Head s={s} />
        {s.body.split(/\n{2,}/).filter(Boolean).map((para, i) => <p key={i}>{para}</p>)}
        <Button s={s} />
      </div>
    </section>
  );
}

export default function CustomSections({ page, slot }) {
  const list = sections.filter((s) => s.active !== false && s.page === page && s.after === slot);
  if (!list.length) return null;
  return list.map((s) => <One key={s.id} s={s} />);
}
