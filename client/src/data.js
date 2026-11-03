import { assetUrl } from './api.js';

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The built-in products. The team can change, add and remove products from the admin panel (see applyContent).
const baseProducts = [
  { id: 'd1', name: 'Shinobi Eye', price: 699, img: '/product-1.png', colors: ['#5a6b49', '#e6dcc0', '#f2f2f2'] },
  { id: 'd2', name: 'Good Days Ahead', price: 599, img: '/product-2.png', colors: ['#4a4a4a', '#151515', '#eeeeee'] },
  { id: 'd3', name: 'Bengali Typo Edition', price: 699, img: '/product-3.png', colors: ['#ddd2b5', '#9fb5c8', '#c62828'] },
  { id: 'd4', name: 'Minimal Heart', price: 599, img: '/product-4.png', colors: ['#f5eed8', '#b9c0a6', '#555555'] },
  { id: 'd5', name: 'Lost In Space', price: 699, img: '/product-5.png', colors: ['#111111', '#eeeeee', '#3d3a7a'] },
];

// Shared product-page details. Rating/review numbers are placeholders until real reviews are connected.
const shared = {
  brand: 'VA Originals',
  sizes: ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
  rating: 4.8,
  reviewCount: 120,
  features: [
    'High-quality DTF print',
    '100% Cotton (180 GSM)',
    'Unisex regular fit',
    'Vibrant and long-lasting colours',
    'Designed by VA Originals',
  ],
  care: [
    'Machine wash cold, inside out',
    'Do not bleach',
    'Tumble dry low or hang dry',
    'Iron on the reverse side, never directly on the print',
  ],
  shipping: [
    'Pan India shipping',
    'Each order is printed after you place it',
    'Delivery timelines are shown at checkout',
    'Easy returns on eligible orders',
  ],
};

const defaultBlurb = 'A bold graphic tee from the VA Originals collection, made for everyday streetwear.';
const defaultDescription = (name) => `${name} brings an original VA Originals design to a premium cotton tee. It is printed with high-quality DTF technology on soft 180 GSM fabric, made for everyday comfort and long-lasting wear.`;

// The products as the admin panel edits them (one entry per product).
export const defaultProductEntries = () => baseProducts.map((p) => ({
  id: p.id, name: p.name, price: p.price, comparePrice: null, images: [p.img], colors: [...p.colors], sizes: [...shared.sizes],
  brand: shared.brand, blurb: defaultBlurb, description: defaultDescription(p.name),
  features: [...shared.features], care: [...shared.care], shipping: [...shared.shipping], trending: true, active: true,
}));

// Turns an admin entry into what the product page and cards use.
function buildProduct(e, slug) {
  const images = (e.images || []).map(assetUrl);
  return {
    ...shared,
    id: e.id, name: e.name, price: e.price, comparePrice: e.comparePrice || null,
    img: images[0], images, colors: e.colors?.length ? e.colors : [], sizes: e.sizes?.length ? e.sizes : shared.sizes,
    brand: e.brand || shared.brand, blurb: e.blurb || defaultBlurb, description: e.description || defaultDescription(e.name),
    features: e.features?.length ? e.features : shared.features, care: e.care?.length ? e.care : shared.care, shipping: e.shipping?.length ? e.shipping : shared.shipping,
    trending: e.trending !== false, slug,
  };
}

function buildAll(entries) {
  const used = new Set();
  return entries.filter((e) => e.active !== false).map((e) => {
    let slug = slugify(e.name) || e.id;
    if (used.has(slug)) slug = `${slug}-${used.size + 1}`;
    used.add(slug);
    return buildProduct(e, slug);
  });
}

// These lists are updated in place, so every page sees the change.
export const products = buildAll(defaultProductEntries());
export const trending = products.filter((p) => p.trending);

export const defaultCategories = [
  { name: 'T-Shirts', sub: 'Regular, Oversized, Polo', img: '/cat-tee.jpeg', link: '' },
  { name: 'Mugs', sub: 'Personalised Mugs', img: '/cat-mug.jpeg', link: '' },
  { name: 'Keychains', sub: 'Custom Keychains', img: '/cat-key.jpeg', link: '' },
  { name: 'Tote Bags', sub: 'Everyday Carry', img: '/cat-tote.jpeg', link: '' },
  { name: 'Stickers & Labels', sub: 'UV DTF Stickers', img: '/cat-sticker.jpeg', link: '' },
  { name: 'Photo Gifts', sub: 'Frames, Prints & More', img: '/cat-frame.jpeg', link: '' },
];
export const categories = defaultCategories.map((c) => ({ ...c }));

export const steps = [
  { n: 1, title: 'Choose Product', text: 'Select from our range of products.', icon: 'shirt' },
  { n: 2, title: 'Customise', text: 'Upload your design or use our tools.', icon: 'pen' },
  { n: 3, title: 'Place Order', text: 'Review and checkout securely.', icon: 'cart' },
  { n: 4, title: 'We Print & Deliver', text: 'High-quality prints, delivered to you.', icon: 'box' },
];

export const defaultReviews = [
  { id: 'rv1', img: '/rev-1.jpeg', alt: 'Customer wearing a black tee with a sunrise print', name: '', quote: '' },
  { id: 'rv2', img: '/rev-2.jpeg', alt: 'Custom "Good Ideas Better Coffee" mug', name: '', quote: '' },
  { id: 'rv3', img: '/rev-3.jpeg', alt: 'Customer wearing a black tee with an illustrated back print', name: '', quote: '' },
  { id: 'rv4', img: '/rev-4.jpeg', alt: 'Canvas tote bag printed "Carry Good Ideas."', name: '', quote: '' },
  { id: 'rv5', img: '/rev-5.jpeg', alt: 'Custom character keychain held in hand', name: '', quote: '' },
  { id: 'rv6', img: '/rev-6.jpeg', alt: 'Black "Wander More" mountain tee', name: '', quote: '' },
];
export const reviews = defaultReviews.map((r) => ({ ...r }));

// Headings and show/hide for the home page blocks, the announcement bar, and extra sections added in the admin panel.
export const defaultHome = {
  announcement: { text: 'Your Ideas. Our Prints. Endless Possibilities.', link: '', active: true },
  trending: { title: 'Trending Now', subtitle: 'Popular designs. Loved by our community.', visible: true },
  categories: { title: 'Shop by Category', subtitle: 'Explore our full range of customisable products.', visible: true },
  reviews: { title: 'Loved by Our Customers', subtitle: 'Real products. Real stories.', visible: true },
  how: { title: 'How It Works', subtitle: 'From idea to your doorstep — simple and easy.', visible: true },
};
export const home = JSON.parse(JSON.stringify(defaultHome));
export const sections = [];

// The team edits the website's content in the admin panel. It is loaded when the website opens and laid over the
// defaults above. Anything the team has not changed keeps its default.
export function applyContent(c = {}) {
  products.length = 0;
  products.push(...buildAll(c.products || defaultProductEntries()));
  trending.length = 0;
  trending.push(...products.filter((p) => p.trending));

  categories.length = 0;
  categories.push(...(c.categories || defaultCategories).map((x) => ({ ...x, img: assetUrl(x.img) })));

  reviews.length = 0;
  reviews.push(...(c.reviews || defaultReviews).map((r) => ({ ...r, img: assetUrl(r.img) })));

  const h = c.home || {};
  Object.keys(defaultHome).forEach((k) => { home[k] = { ...defaultHome[k], ...(h[k] || {}) }; });

  sections.length = 0;
  sections.push(...(c.sections || []).map((s) => ({ ...s, image: assetUrl(s.image), images: (s.images || []).map(assetUrl) })));
}
