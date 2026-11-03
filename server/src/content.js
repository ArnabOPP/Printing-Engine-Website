import { newId } from './store.js';

// Checks and cleans what the admin panel sends for the website's content (products, home page sections, reviews…),
// so only expected fields, sizes and safe links ever get stored or shown to visitors.

const bad = (msg) => Object.assign(new Error(msg), { status: 400 });
export const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const bool = (v, fallback = true) => (typeof v === 'boolean' ? v : fallback);
const list = (v, max, each) => (Array.isArray(v) ? v.slice(0, max).map(each).filter(Boolean) : []);

// Addresses of pictures: ones we host (/uploads/…, /something.png) or https links. Nothing else (no javascript: links).
export function safeUrl(v) {
  const s = str(v, 400);
  if (!s) return '';
  if (s.startsWith('/') && !s.startsWith('//') && !s.includes('\\')) return s;
  return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : '';
}
const safeLink = (v) => {
  const s = str(v, 400);
  return s.startsWith('#') ? s : safeUrl(s);
};
const hex = (v) => (/^#[0-9a-f]{6}$/i.test(str(v, 7)) ? str(v, 7).toLowerCase() : '');
const money = (v, label, { optional = false } = {}) => {
  if (optional && (v === '' || v == null)) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) throw bad(`${label} must be a number from 0 to 1,000,000.`);
  return Math.round(n * 100) / 100;
};

const PAGES = ['home', 'about', 'print-on-demand'];
const HOME_SLOTS = ['top', 'hero', 'promos', 'trending', 'categories', 'customiser', 'feature', 'how', 'reviews', 'bottom'];
const TYPES = ['banner', 'text', 'products', 'gallery', 'offer'];

function cleanProduct(p) {
  const name = str(p?.name, 80);
  if (name.length < 2) throw bad('Every product needs a name.');
  const price = money(p.price, `${name}: price`);
  const compare = money(p.comparePrice, `${name}: original price`, { optional: true });
  const images = list(p.images, 6, safeUrl);
  if (!images.length) throw bad(`${name}: add at least one picture.`);
  return {
    id: str(p.id, 30) || newId('p_'), name, price, comparePrice: compare && compare > price ? compare : null, images,
    colors: list(p.colors, 12, hex), sizes: list(p.sizes, 12, (s) => str(s, 12)),
    brand: str(p.brand, 60), blurb: str(p.blurb, 200), description: str(p.description, 1500),
    features: list(p.features, 12, (s) => str(s, 120)), care: list(p.care, 12, (s) => str(s, 120)), shipping: list(p.shipping, 12, (s) => str(s, 120)),
    trending: bool(p.trending, true), active: bool(p.active, true),
  };
}

function cleanSection(s) {
  const type = TYPES.includes(s?.type) ? s.type : 'text';
  const page = PAGES.includes(s?.page) ? s.page : 'home';
  const slots = page === 'home' ? HOME_SLOTS : ['top', 'bottom'];
  return {
    id: str(s.id, 30) || newId('s_'), page, after: slots.includes(s.after) ? s.after : 'bottom', type,
    title: str(s.title, 120), subtitle: str(s.subtitle, 200), body: str(s.body, 2000), image: safeUrl(s.image),
    buttonText: str(s.buttonText, 40), buttonLink: safeLink(s.buttonLink),
    productIds: list(s.productIds, 12, (x) => str(x, 30)), images: list(s.images, 12, safeUrl),
    code: str(s.code, 30).toUpperCase(), active: bool(s.active, true),
  };
}

const block = (b) => ({ title: str(b?.title, 80), subtitle: str(b?.subtitle, 200), visible: bool(b?.visible, true) });

export function cleanContent(c = {}) {
  const out = {};
  if (c.products !== undefined) {
    if (!Array.isArray(c.products) || c.products.length > 60) throw bad('Too many products.');
    out.products = c.products.map(cleanProduct);
  }
  if (c.categories !== undefined) {
    out.categories = list(c.categories, 12, (x) => (str(x?.name, 60) ? { name: str(x.name, 60), sub: str(x.sub, 80), img: safeUrl(x.img), link: safeLink(x.link) } : null));
  }
  if (c.reviews !== undefined) {
    out.reviews = list(c.reviews, 40, (x) => (safeUrl(x?.img) ? { id: str(x.id, 30) || newId('r_'), img: safeUrl(x.img), alt: str(x.alt, 160), name: str(x.name, 60), quote: str(x.quote, 240) } : null));
  }
  if (c.home !== undefined) {
    out.home = {
      announcement: { text: str(c.home?.announcement?.text, 160), link: safeLink(c.home?.announcement?.link), active: bool(c.home?.announcement?.active, true) },
      trending: block(c.home?.trending), categories: block(c.home?.categories), reviews: block(c.home?.reviews), how: block(c.home?.how),
    };
  }
  if (c.sections !== undefined) out.sections = list(c.sections, 40, cleanSection);
  return out;
}

/* ---------- coupons ---------- */

export function cleanCoupon(c, existing) {
  const code = str(c?.code, 30).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (code.length < 3) throw bad('The code needs at least 3 letters or numbers.');
  const type = c.type === 'flat' ? 'flat' : 'percent';
  const value = money(c.value, 'Discount');
  if (type === 'percent' && (value <= 0 || value > 100)) throw bad('A percentage discount must be between 1 and 100.');
  if (type === 'flat' && value <= 0) throw bad('The discount amount must be more than 0.');
  const date = (v) => (v ? (Number.isNaN(Date.parse(v)) ? null : new Date(v).toISOString()) : null);
  const limit = c.usageLimit === '' || c.usageLimit == null ? null : Math.round(Number(c.usageLimit));
  if (limit != null && !(limit >= 1)) throw bad('The usage limit must be 1 or more (or empty for no limit).');
  return {
    id: existing?.id || newId('c_'), code, description: str(c.description, 140), type, value,
    minOrder: money(c.minOrder || 0, 'Minimum order'), maxDiscount: money(c.maxDiscount, 'Maximum discount', { optional: true }),
    startsAt: date(c.startsAt), endsAt: date(c.endsAt), usageLimit: limit, used: existing?.used || 0, active: bool(c.active, true),
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
}

// What a coupon takes off an order of `subtotal` rupees, or why it cannot be used.
export function couponResult(coupon, subtotal, now = new Date()) {
  if (!coupon || !coupon.active) return { error: 'This code is not valid.' };
  if (coupon.startsAt && now < new Date(coupon.startsAt)) return { error: 'This code is not active yet.' };
  if (coupon.endsAt && now > new Date(coupon.endsAt)) return { error: 'This code has expired.' };
  if (coupon.usageLimit != null && coupon.used >= coupon.usageLimit) return { error: 'This code has been used up.' };
  if (!(subtotal > 0)) return { error: 'Add priced items to use a code.' };
  if (subtotal < coupon.minOrder) return { error: `This code needs an order of at least ₹${coupon.minOrder}.` };
  let discount = coupon.type === 'percent' ? (subtotal * coupon.value) / 100 : coupon.value;
  if (coupon.maxDiscount != null) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.min(Math.floor(discount * 100) / 100, subtotal);
  return { discount };
}
