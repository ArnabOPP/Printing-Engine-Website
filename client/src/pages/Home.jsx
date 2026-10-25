import { useRef, useState } from 'react';
import {
  ArrowRight, ChevronLeft, ChevronRight, Heart, Check, Gem, Infinity as Inf, Users, Truck,
  Upload, Type, Shapes, Image as ImageIcon, Sticker as StickerIcon, Shirt, PenTool, ShoppingCart, Box, Minus, Plus,
} from 'lucide-react';
import { Tee, Mug, Keychain, Tote, Sticker, Frame } from '../components/Art.jsx';
import { trending, categories, steps, reviews } from '../data.js';

const artFor = { mug: <Mug />, key: <Keychain />, tote: <Tote />, sticker: <Sticker />, frame: <Frame />, tee: <Tee color="#111" lines={['GOOD', 'VIBES']} ink="#fff" /> };
const stepIcon = { shirt: Shirt, pen: PenTool, cart: ShoppingCart, box: Box };
const price = (n) => `₹${n}`;

const heroThumbs = [1, 2, 3, 4, 5].map((n) => `/thumb-${n}.jpg`);

function Hero() {
  const [active, setActive] = useState(0);
  return (
    <section className="hero">
      <div className="hero-bg" aria-hidden="false">
        <img src="/hero.jpeg" alt="Black oversized graphic tee with lime and white print – limited drop" />
      </div>
      <div className="wrap hero-in">
        <div className="hero-copy">
          <h1>YOUR IDEAS.<br />OUR <em>ENGINE.</em><sup>®</sup></h1>
          <p className="hero-sub">Wear your imagination. <strong>Print your identity.</strong></p>
          <p className="hero-text">From statement streetwear to personalised gifts, turn your ideas into products made for you.</p>
          <div className="cta-row">
            <a href="#categories" className="btn btn-lime">EXPLORE COLLECTION <ArrowRight size={16} /></a>
            <a href="#customiser" className="btn btn-ghost">CREATE YOUR OWN</a>
          </div>
        </div>
        <div className="thumbs">
          {heroThumbs.map((src, i) => (
            <button key={src} className={i === active ? 'on' : ''} onClick={() => setActive(i)} aria-label={`View style ${i + 1}`}>
              <img src={src} alt="" width="48" height="48" />
            </button>
          ))}
        </div>
      </div>
      <div className="wrap perks">
        <div><Gem size={22} /><span>Premium<br />Quality Prints</span></div>
        <div><Inf size={22} /><span>No Minimum<br />Orders</span></div>
        <div><Users size={22} /><span>Bulk & Business<br />Solutions</span></div>
        <div><Truck size={22} /><span>Pan India<br />Shipping</span></div>
        <span className="dots-nav" aria-hidden="true"><i className="on" /><i /><i /></span>
      </div>
    </section>
  );
}

function Promos() {
  return (
    <section className="wrap promos" id="bulk">
      <article className="promo promo-photo" style={{ backgroundImage: 'url(/promo-collection.jpg)' }}>
        <div><h3>Shop the<br />Collection</h3><p>Explore original designs, graphic tees and curated drops.</p>
          <a href="#trending" className="btn btn-dark">Explore Designs <ArrowRight size={14} /></a></div>
      </article>
      <article className="promo promo-photo promo-create">
        <div><h3>Create<br />Your Own</h3><p>Upload your design, add text, choose colours and preview before ordering.</p>
          <a href="#customiser" className="btn btn-dark">Start Creating <ArrowRight size={14} /></a></div>
        <div className="chips" aria-hidden="true"><span><Type size={20} /></span><span><ImageIcon size={20} /></span></div>
      </article>
      <article className="promo promo-photo promo-bulk">
        <div><h3>Bulk & Business<br />Printing</h3><p>For schools, colleges, businesses, events and resellers.</p>
          <a href="#footer" className="btn btn-dark">Get a Quote <ArrowRight size={14} /></a></div>
        <span className="units">10+ UNITS</span>
      </article>
    </section>
  );
}

function Trending() {
  const track = useRef(null);
  const scroll = (d) => track.current?.scrollBy({ left: d * 280, behavior: 'smooth' });
  return (
    <section className="wrap section" id="trending">
      <div className="sec-head">
        <div><h2>Trending Now</h2><p>Popular designs. Loved by our community.</p></div>
        <div className="sec-tools">
          <a href="#trending" className="link">View All <ArrowRight size={14} /></a>
          <button className="circle" onClick={() => scroll(-1)} aria-label="Previous"><ChevronLeft size={16} /></button>
          <button className="circle" onClick={() => scroll(1)} aria-label="Next"><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="track" ref={track}>
        {trending.map((p) => (
          <article className="card" key={p.name}>
            <div className="card-img">
              <button className="wish" aria-label="Add to wishlist"><Heart size={18} /></button>
              <img src={p.img} alt={p.name} loading="lazy" width="400" height="400" />
            </div>
            <div className="card-body">
              <div className="card-row">
                <h4>{p.name}</h4>
                <button className="wish-sm" aria-label={`Wishlist ${p.name}`}><Heart size={16} /></button>
              </div>
              <div className="price">{price(p.price)}</div>
              <div className="swatches">
                {p.colors.map((c, i) => <i key={i} style={{ background: c }} />)}
                {p.more && <small>+{p.more}</small>}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Categories() {
  return (
    <section className="wrap section" id="categories">
      <div className="sec-head">
        <div><h2>Shop by Category</h2><p>Explore our full range of customisable products.</p></div>
        <div className="sec-tools">
          <a href="#categories" className="link">View All <ArrowRight size={14} /></a>
          <button className="circle" aria-label="View all categories"><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="cats">
        {categories.map((c) => (
          <a href="#categories" className="cat" key={c.name}>
            <div className="cat-img"><img src={c.img} alt={c.name} loading="lazy" /></div>
            <h4>{c.name}</h4><span>{c.sub}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

const swatchColors = ['#ffffff', '#1c1c1c', '#eadfc8', '#1f4d2b', '#f08ca4'];
const sizes = ['S', 'M', 'L', 'XL', 'XXL'];

function Customiser() {
  const [color, setColor] = useState('#ffffff');
  const [size, setSize] = useState('S');
  const [qty, setQty] = useState(1);
  const [view, setView] = useState(0);
  const [product, setProduct] = useState('Oversized T-Shirt');
  const views = [
    { label: 'Front', src: '/custom-front.png' },
    { label: 'Back', src: '/custom-back.png' },
    { label: 'Left', src: '/custom-left.png' },
    { label: 'Right', src: '/custom-right.png' },
  ];
  const tools = [[Upload, 'Upload'], [Type, 'Text'], [Shapes, 'Shapes'], [StickerIcon, 'Designs']];
  return (
    <section className="custom" id="customiser">
      <div className="wrap custom-in">
        <div className="custom-copy">
          <span className="pill"><i /> ONLINE CUSTOMISER</span>
          <h2>DESIGN IT.<br /><span>WE PRINT IT.</span></h2>
          <p>Turn your ideas into custom products in minutes. Upload, edit, preview and place your order.</p>
          <ul>
            {['Add your design or text', 'Live preview on product', 'Multiple products & colours', 'No minimum order'].map((t) => (
              <li key={t}><Check size={14} />{t}</li>
            ))}
          </ul>
          <a href="#customiser" className="btn btn-lime">START CUSTOMISING <ArrowRight size={16} /></a>
          <span className="hand h-design">YOUR<br />DESIGN<br />HERE
            <svg viewBox="0 0 60 30" aria-hidden="true"><path d="M2 4 C 18 4, 36 8, 54 24 M54 24 L44 22 M54 24 L52 14" /></svg>
          </span>
        </div>
        <div className="studio">
          <div className="tools">
            {tools.map(([I, l]) => <button key={l}><I size={18} /><small>{l}</small></button>)}
          </div>
          <div className="canvas">
            <div className="stage" style={{ background: color }}>
              <img src={views[view].src} alt={`${product} – ${views[view].label} view`} />
            </div>
            <div className="views">
              {views.map((v, i) => (
                <button key={v.label} className={i === view ? 'on' : ''} onClick={() => setView(i)}>
                  <span className="vthumb" style={{ background: color }}><img src={v.src} alt="" loading="lazy" /></span>
                  <small>{v.label}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="opts">
            <label>Product
              <select value={product} onChange={(e) => setProduct(e.target.value)}>
                <option>Oversized T-Shirt</option><option>Regular T-Shirt</option><option>Polo</option>
              </select>
            </label>
            <div>Colour
              <div className="dots">
                {swatchColors.map((c) => (
                  <button key={c} className={c === color ? 'on' : ''} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Colour ${c}`} />
                ))}
              </div>
            </div>
            <div>Size
              <div className="sizes">
                {sizes.map((s) => <button key={s} className={s === size ? 'on' : ''} onClick={() => setSize(s)}>{s}</button>)}
              </div>
            </div>
            <div>Quantity
              <div className="qty">
                <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Decrease"><Minus size={12} /></button>
                <span>{qty}</span>
                <button onClick={() => setQty(qty + 1)} aria-label="Increase"><Plus size={12} /></button>
              </div>
            </div>
            <div className="total">{price(699 * qty)}</div>
            <button className="btn btn-lime-solid btn-block">ADD TO CART</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Feature() {
  return (
    <section className="wrap feature">
      <article className="f-originals f-photo" id="originals" style={{ backgroundImage: 'url(/feature-originals.jpeg)' }}>
        <div>
          <h3>VA ORIGINALS</h3>
          <p className="big">Not made to blend in.</p>
          <p>Original designs. Distinct identities. Everyday streetwear.</p>
          <a href="#trending" className="btn btn-lime-solid">SHOP THE DROP <ArrowRight size={14} /></a>
        </div>
      </article>
      <article className="f-gifts f-photo" id="gifts" style={{ backgroundImage: 'url(/feature-gifts.jpeg)' }}>
        <div>
          <h3>Personalised Gifts</h3>
          <p className="big">Make it personal.</p>
          <p>For birthdays, anniversaries, special occasions and more.</p>
          <a href="#categories" className="btn btn-lime-solid">EXPLORE GIFTS <ArrowRight size={14} /></a>
        </div>
      </article>
    </section>
  );
}

function How() {
  return (
    <section className="wrap section" id="how">
      <div className="sec-head inline">
        <h2>How It Works</h2><p>From idea to your doorstep — simple and easy.</p>
        <a href="#how" className="link push">Learn More <ArrowRight size={14} /></a>
      </div>
      <div className="steps">
        {steps.map((s) => {
          const I = stepIcon[s.icon];
          return (
            <div className="step" key={s.n}>
              <span className="ico"><I size={22} /><b>{s.n}</b></span>
              <div><h4>{s.title}</h4><p>{s.text}</p></div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Reviews() {
  const track = useRef(null);
  const scroll = (d) => track.current?.scrollBy({ left: d * 280, behavior: 'smooth' });
  return (
    <section className="wrap section">
      <div className="sec-head">
        <div><h2>Loved by Our Customers</h2><p>Real products. Real stories.</p></div>
        <a href="#how" className="link">View All Reviews <ArrowRight size={14} /></a>
      </div>
      <div className="reviews-wrap">
        <button className="circle l" onClick={() => scroll(-1)} aria-label="Previous"><ChevronLeft size={16} /></button>
        <div className="track reviews" ref={track}>
          {reviews.map((r, i) => (
            <div className="rev" key={i}>
              <img src={r.img} alt={r.alt} loading="lazy" />
            </div>
          ))}
        </div>
        <button className="circle r" onClick={() => scroll(1)} aria-label="Next"><ChevronRight size={16} /></button>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Hero />
      <Promos />
      <Trending />
      <Categories />
      <Customiser />
      <Feature />
      <How />
      <Reviews />
    </>
  );
}
