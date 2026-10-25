import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Minus, Plus, User, Users, Baby, Shirt } from 'lucide-react';
import { printProducts } from '../printProducts.js';
import { productIcons } from '../productIcons.js';
import NotFound from './NotFound.jsx';

const audiences = [
  { id: 'men', label: 'Men', hint: 'Regular adult fit', icon: User, sizes: ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'] },
  { id: 'women', label: 'Women', hint: 'Adult sizes, women’s range', icon: User, sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
  { id: 'unisex', label: 'Unisex', hint: 'One fit for everyone', icon: Users, sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] },
  { id: 'kids', label: 'Kids', hint: 'Ages 2 to 13', icon: Baby, sizes: ['2-3 yrs', '4-5 yrs', '6-7 yrs', '8-9 yrs', '10-11 yrs', '12-13 yrs'] },
];

const quickQty = [1, 10, 25, 50, 100];

function gsmNote(option) {
  const m = /^(\d+)\s*GSM$/i.exec(option);
  if (!m) return '';
  const n = Number(m[1]);
  if (n <= 140) return 'Light and breathable';
  if (n <= 170) return 'Soft, everyday weight';
  if (n <= 200) return 'Balanced and durable';
  return 'Heavy, premium feel';
}

// A transparent white-tee photo, tinted to the chosen colour: the colour fills the tee's silhouette
// (via the photo's own alpha as a mask) and the photo is multiplied on top to keep the folds and shading.
function TeePhoto({ src, colour, alt }) {
  return (
    <div className="tee-photo" style={{ '--tint': colour, '--mask': `url("${src}")` }}>
      <i className="tee-tint" />
      <img src={src} alt={alt} />
    </div>
  );
}

function StepHead({ n, title, hint, done }) {
  return (
    <div className="opt-head">
      <span className={`opt-n${done ? ' done' : ''}`}>{done ? <Check size={14} strokeWidth={3} /> : n}</span>
      <div>
        <h2>{title}</h2>
        {hint && <p>{hint}</p>}
      </div>
    </div>
  );
}

export default function Customise() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const product = printProducts.find((p) => p.slug === slug);

  const [material, setMaterial] = useState(null);
  const [colour, setColour] = useState(null);
  const [audience, setAudience] = useState(null);
  const [sizeQty, setSizeQty] = useState({});
  const [qty, setQty] = useState(1);
  const [view, setView] = useState('front');

  const isApparel = product?.category === 'T-Shirts';
  const materials = product?.fabric?.options || [];
  const colours = product?.colors || [];
  const aud = audiences.find((a) => a.id === audience);
  const PreviewIcon = productIcons[product?.icon] || Shirt;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setMaterial(product?.fabric?.options?.[0] ?? null);
    setColour(product?.colors?.[0]?.name ?? null);
    setAudience(null);
    setSizeQty({});
    setQty(1);
    setView('front');
  }, [slug, product]);

  const total = isApparel ? Object.values(sizeQty).reduce((a, b) => a + b, 0) : qty;
  const colourObj = colours.find((c) => c.name === colour);

  const steps = useMemo(() => {
    const s = [];
    if (materials.length) s.push('material');
    if (colours.length) s.push('colour');
    if (isApparel) s.push('audience', 'sizes');
    else s.push('quantity');
    return s;
  }, [materials.length, colours.length, isApparel]);

  if (!product) return <NotFound />;

  const missing = [];
  if (materials.length && !material) missing.push('a material quality');
  if (colours.length && !colour) missing.push('a colour');
  if (isApparel && !audience) missing.push('who it is for');
  if (total < 1) missing.push(isApparel ? 'at least one size' : 'a quantity');
  const ready = missing.length === 0;

  const setSize = (size, delta) =>
    setSizeQty((cur) => {
      const next = Math.max(0, (cur[size] || 0) + delta);
      const copy = { ...cur, [size]: next };
      if (!next) delete copy[size];
      return copy;
    });

  const pickAudience = (id) => {
    if (id !== audience) setSizeQty({});
    setAudience(id);
  };

  const label = `${product.name}${product.spec ? ` — ${product.spec}` : ''}`;
  const sizeSummary = Object.entries(sizeQty).map(([s, n]) => `${s} × ${n}`).join(', ');
  const stepNo = (id) => steps.indexOf(id) + 1;

  const goOn = () => {
    if (!ready) return;
    navigate(`/design/${product.slug}`, {
      state: { product: label, category: product.category, material, colour, audience, sizes: sizeQty, quantity: total },
    });
  };

  return (
    <div className="wrap opt">
      <nav className="pd-crumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link><ChevronRight size={12} />
        <Link to="/print-on-demand">Print on Demand</Link><ChevronRight size={12} />
        <b>{label}</b>
      </nav>

      <ol className="opt-progress" aria-label="Progress">
        <li className="done"><span><Check size={14} strokeWidth={3} /></span>Choose product</li>
        <li className="on"><span>2</span>Choose options</li>
        <li><span>3</span>Add your design</li>
      </ol>

      <div className="opt-layout">
        <div className="opt-main">
          <h1>Set up your {product.name}</h1>
          <p className="opt-lead">Pick the options below. You can change everything again before you order.</p>

          {materials.length > 0 && (
            <section className="opt-card" aria-labelledby="o-material">
              <StepHead n={stepNo('material')} title="Material quality" hint={product.fabric.material} done={!!material} />
              <div className="opt-grid" role="radiogroup" aria-label="Material quality">
                {materials.map((m) => (
                  <button key={m} role="radio" aria-checked={m === material} className={`opt-choice${m === material ? ' on' : ''}`} onClick={() => setMaterial(m)}>
                    <strong>{m}</strong>
                    {gsmNote(m) && <small>{gsmNote(m)}</small>}
                    {m === material && <span className="opt-tick"><Check size={13} strokeWidth={3} /></span>}
                  </button>
                ))}
              </div>
            </section>
          )}

          {colours.length > 0 && (
            <section className="opt-card" aria-labelledby="o-colour">
              <StepHead n={stepNo('colour')} title="Colour" hint={colour ? `Selected: ${colour}` : 'Choose a colour'} done={!!colour} />
              <div className="opt-swatches" role="radiogroup" aria-label="Colour">
                {colours.map((c) => (
                  <button key={c.name} role="radio" aria-checked={c.name === colour} className={c.name === colour ? 'on' : ''} onClick={() => setColour(c.name)}>
                    <i style={{ background: c.hex }} />
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {isApparel && (
            <section className="opt-card" aria-labelledby="o-for">
              <StepHead n={stepNo('audience')} title="Who is it for?" hint="This decides the fit and the sizes you can choose." done={!!audience} />
              <div className="opt-aud" role="radiogroup" aria-label="Made for">
                {audiences.map((a) => {
                  const I = a.icon;
                  return (
                    <button key={a.id} role="radio" aria-checked={a.id === audience} className={`opt-choice aud${a.id === audience ? ' on' : ''}`} onClick={() => pickAudience(a.id)}>
                      <span className="opt-aud-ico"><I size={22} /></span>
                      <strong>{a.label}</strong>
                      <small>{a.hint}</small>
                      {a.id === audience && <span className="opt-tick"><Check size={13} strokeWidth={3} /></span>}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {isApparel && (
            <section className="opt-card" aria-labelledby="o-size">
              <StepHead n={stepNo('sizes')} title="Sizes and quantity" hint={aud ? 'Add how many pieces you need in each size.' : 'Choose who it is for first.'} done={total > 0} />
              {aud ? (
                <ul className="opt-sizes">
                  {aud.sizes.map((s) => (
                    <li key={s} className={sizeQty[s] ? 'has' : ''}>
                      <span className="opt-size">{s}</span>
                      <div className="opt-step">
                        <button onClick={() => setSize(s, -1)} aria-label={`Fewer ${s}`} disabled={!sizeQty[s]}><Minus size={14} /></button>
                        <output aria-label={`${s} quantity`}>{sizeQty[s] || 0}</output>
                        <button onClick={() => setSize(s, 1)} aria-label={`More ${s}`}><Plus size={14} /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="opt-muted">Sizes appear here once you choose Men, Women, Unisex or Kids.</p>
              )}
            </section>
          )}

          {!isApparel && (
            <section className="opt-card" aria-labelledby="o-qty">
              <StepHead n={stepNo('quantity')} title="Quantity" hint="How many do you need?" done={qty > 0} />
              <div className="opt-qty">
                <div className="opt-step big">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Decrease quantity"><Minus size={16} /></button>
                  <output aria-label="Quantity">{qty}</output>
                  <button onClick={() => setQty(qty + 1)} aria-label="Increase quantity"><Plus size={16} /></button>
                </div>
                <div className="opt-quick">
                  {quickQty.map((n) => (
                    <button key={n} className={qty === n ? 'on' : ''} onClick={() => setQty(n)}>{n}</button>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="opt-summary" aria-label="Your selection">
          <div className="opt-preview">
            {isApparel ? (
              <TeePhoto
                src={view === 'front' ? '/tee-front.png' : '/tee-back.png'}
                colour={colourObj?.hex || '#ffffff'}
                alt={`${label}, ${view} view${colour ? `, ${colour}` : ''}`}
              />
            ) : product.img ? (
              <img src={product.img} alt="" />
            ) : (
              <PreviewIcon size={72} strokeWidth={1.2} />
            )}
          </div>
          {isApparel && (
            <div className="opt-views" role="tablist" aria-label="Preview side">
              {['front', 'back'].map((v) => (
                <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
                  {v === 'front' ? 'Front' : 'Back'}
                </button>
              ))}
            </div>
          )}
          <h3>{label}</h3>
          <dl>
            {materials.length > 0 && (<><dt>Material</dt><dd>{material ? `${product.fabric.material} · ${material}` : '—'}</dd></>)}
            {colours.length > 0 && (<><dt>Colour</dt><dd className="opt-dd-colour">{colourObj ? (<><i style={{ background: colourObj.hex }} />{colourObj.name}</>) : '—'}</dd></>)}
            {isApparel && (<><dt>For</dt><dd>{aud ? aud.label : '—'}</dd></>)}
            {isApparel && (<><dt>Sizes</dt><dd>{sizeSummary || '—'}</dd></>)}
            <dt>Total</dt><dd><b>{total}</b> {total === 1 ? 'piece' : 'pieces'}</dd>
          </dl>
          <button className="btn btn-lime-solid opt-go" onClick={goOn} disabled={!ready}>
            Continue to design <ArrowRight size={16} />
          </button>
          <p className="opt-hint" role="status">{ready ? 'All set. Next you add your design.' : `Still needed: ${missing.join(', ')}.`}</p>
          <Link to="/print-on-demand" className="opt-back"><ArrowLeft size={14} /> Change product</Link>
        </aside>
      </div>
    </div>
  );
}
