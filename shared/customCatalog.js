// Everything available for Print on Demand, grouped by category.
// `img` is a photo in /public; products without one show an icon tile (`icon` is a lucide-react name).

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const groups = [
  {
    id: 't-shirts',
    name: 'T-Shirts',
    blurb: 'Pick a style and print your design on it.',
    items: [
      { name: 'Regular T-Shirt', icon: 'Shirt', img: '/regular-tee.png' },
      { name: 'Polo T-Shirt', icon: 'Shirt', img: '/polo-tee.png', garment: 'polo' },
      { name: 'Dri-Fit T-Shirt', icon: 'Shirt', img: '/dri-fit-tee.png', garment: 'tee' },
      { name: 'Dot-Net T-Shirt', icon: 'Shirt', img: '/dot-net-tee.png', garment: 'tee' },
      { name: 'Oversized T-Shirt', icon: 'Shirt', img: '/oversized-tee.png' },
    ],
  },
  {
    id: 'printing-services',
    name: 'Printing Services',
    blurb: 'Send us your artwork and choose the print method.',
    items: [
      { name: 'DTF Printing', icon: 'Printer', img: '/dtf-printing.jpg' },
      { name: 'Sublimation Printing', icon: 'Droplets', img: '/sublimation-printing.jpg' },
      { name: 'UV DTF Printing', icon: 'Layers', img: '/uv-dtf-printing.jpg' },
    ],
  },
  {
    id: 'customised-products',
    name: 'Customised Products',
    blurb: 'Gifts and everyday items with your design on them.',
    items: [
      { name: 'Cups / Mugs', icon: 'Coffee', img: '/cat-mug.jpeg' },
      { name: 'Caps', icon: 'HardHat' },
      { name: 'Keychains', icon: 'KeyRound', img: '/cat-key.jpeg' },
      { name: 'Notebooks', spec: 'A5', icon: 'NotebookPen' },
      { name: 'Pens', icon: 'Pen' },
      { name: 'Cover Files', icon: 'Folder' },
      { name: 'Tote Bags', icon: 'ShoppingBag', img: '/cat-tote.jpeg' },
      { name: 'Badges', icon: 'BadgeCheck' },
      { name: 'Bottles', icon: 'GlassWater' },
      { name: 'Photo Frame', spec: 'A5', icon: 'Frame', img: '/cat-frame.jpeg' },
      { name: 'Photo Frame', spec: 'A4', icon: 'Frame', img: '/cat-frame.jpeg' },
      { name: 'Photo Frame', spec: 'A3', icon: 'Frame', img: '/cat-frame.jpeg' },
    ],
  },
  {
    id: 'cards-identification',
    name: 'Cards & Identification',
    blurb: 'Visiting cards, PVC cards and ID cards.',
    items: [
      { name: 'Visiting Card', spec: '100 pcs, single side', icon: 'Contact' },
      { name: 'Visiting Card', spec: '100 pcs, both sides', icon: 'Contact' },
      { name: 'PVC Card', icon: 'CreditCard' },
      { name: 'ID Card', icon: 'IdCard' },
    ],
  },
  {
    id: 'stickers-labels',
    name: 'Stickers & Labels',
    blurb: 'Custom stickers and labels, cut to shape or priced by area.',
    items: [
      { name: 'Stickers', spec: 'A3 sheet, shape cutting', icon: 'Scissors', img: '/cat-sticker.jpeg' },
      { name: 'Stickers', spec: 'by area', icon: 'Sticker' },
      { name: 'Labels', spec: 'by area', icon: 'Tag' },
    ],
  },
  {
    id: 'business-printing',
    name: 'Business Printing',
    blurb: 'Cards, posters, bill books and stamps for your business.',
    items: [
      { name: 'Cards', spec: 'A3', icon: 'FileText' },
      { name: 'Cards', spec: 'A4', icon: 'FileText' },
      { name: 'Cards', spec: 'A5', icon: 'FileText' },
      { name: 'Posters', icon: 'Image' },
      { name: 'Bill Book', spec: 'A5, 500 pages, single colour', icon: 'Receipt' },
      { name: 'Ready Stamp', icon: 'Stamp' },
      { name: 'Stamp Pad', icon: 'Stamp' },
    ],
  },
];

// Colour options per product. These are PLACEHOLDERS: edit the lists below to match what you really stock.
// Products not listed here (services, cards, stickers, keychains, badges…) show no swatches.
const palette = {
  white: '#ffffff', black: '#161616', navy: '#1f2a55', red: '#d32f2f', 'royal blue': '#2b59d9', grey: '#9aa0a6',
  green: '#1f6b3a', yellow: '#f2c230', maroon: '#6d1a2a', natural: '#e8dcc0', brown: '#6b4a2f', silver: '#c9ccd1', pink: '#f08ca4',
};

const colourOptions = {
  'Polo T-Shirt': ['white', 'black', 'navy', 'red', 'royal blue', 'grey'],
  'Regular T-Shirt': ['white', 'black', 'navy', 'red', 'royal blue', 'grey', 'green', 'yellow'],
  'Dri-Fit T-Shirt': ['white', 'black', 'navy', 'royal blue', 'red'],
  'Dot-Net T-Shirt': ['white', 'black', 'navy', 'royal blue', 'red', 'grey'],
  'Oversized T-Shirt': ['white', 'black', 'natural', 'grey', 'green', 'pink'],
  Caps: ['black', 'white', 'navy', 'red', 'royal blue'],
  'Cups / Mugs': ['white', 'black', 'red', 'royal blue'],
  Notebooks: ['black', 'navy', 'maroon'],
  Pens: ['black', 'royal blue', 'white', 'red'],
  'Tote Bags': ['natural', 'black', 'navy', 'white'],
  Bottles: ['white', 'black', 'silver', 'royal blue'],
  'Photo Frame': ['black', 'brown', 'white'],
};

// Material and the quality options available per product. PLACEHOLDERS: edit to match what you really offer.
const fabrics = {
  // The fabric is the choice, so there is no single material name.
  'Polo T-Shirt': { material: '', options: ['Pure cotton', 'Poly cotton', 'Polyester', 'Dot net'] },
  'Regular T-Shirt': { material: 'Pure cotton', options: [] }, // only one quality, so nothing to choose
  'Dri-Fit T-Shirt': { material: 'Polyester', options: [] }, // only one quality, so nothing to choose
  'Dot-Net T-Shirt': { material: 'Polyester', options: [] }, // only one quality, so nothing to choose
  'Oversized T-Shirt': { material: 'Pure cotton', options: ['French terry', 'Sinker'] },
  Caps: { material: 'Cotton twill', options: ['Standard', 'Premium'] },
  'Cups / Mugs': { material: 'Ceramic', options: ['11 oz', '15 oz'] },
  Keychains: { material: 'Acrylic or metal', options: ['Acrylic', 'Metal'] },
  Notebooks: { material: 'Paper pages, hard cover', options: ['70 GSM', '80 GSM'] },
  Pens: { material: 'Plastic or metal body', options: ['Plastic', 'Metal'] },
  'Cover Files': { material: 'Laminated board', options: ['Standard', 'Premium'] },
  'Tote Bags': { material: 'Cotton canvas', options: ['140 GSM', '220 GSM'] },
  Badges: { material: 'Metal or plastic pin', options: ['Metal', 'Plastic'] },
  Bottles: { material: 'Steel or plastic', options: ['Steel', 'Plastic'] },
  'Photo Frame': { material: 'Wood-look frame, glass front', options: ['Standard', 'Premium'] },
  'Visiting Card': { material: 'Card stock', options: ['300 GSM', '350 GSM'] },
  'PVC Card': { material: 'PVC', options: ['Glossy', 'Matte'] },
  'ID Card': { material: 'PVC', options: ['Glossy', 'Matte'] },
  Stickers: { material: 'Vinyl', options: ['Glossy', 'Matte'] },
  Labels: { material: 'Vinyl or paper', options: ['Vinyl', 'Paper'] },
  Cards: { material: 'Art paper', options: ['250 GSM', '300 GSM'] },
  Posters: { material: 'Art paper', options: ['130 GSM', '170 GSM'] },
  'Bill Book': { material: 'Carbonless paper', options: ['Duplicate', 'Triplicate'] },
  'Ready Stamp': { material: 'Rubber stamp', options: ['Standard'] },
  'Stamp Pad': { material: 'Ink pad', options: ['Standard'] },
};

// Prices in ₹. `base` is the shirt with no print. Printing (DTF) is charged per square inch of artwork:
// `normalPerSqIn` for normal print, `fullPerSqIn` for full body print.
//
// `methods` are the print methods on offer. A method with `lightOnly` can only be used on light colours.
// A product has either one `base` price or a `baseByMaterial` price for each fabric.
const dtf = { label: 'DTF print', normalPerSqIn: 1, fullPerSqIn: 1.5 };
const sublimation = { label: 'Sublimation', normalPerSqIn: 0.5, fullPerSqIn: 0.5, lightOnly: true };
const prices = {
  'Regular T-Shirt': { base: 230, methods: { dtf } },
  'Polo T-Shirt': {
    baseByMaterial: { 'Pure cotton': 350, 'Poly cotton': 320, Polyester: 200, 'Dot net': 250 },
    methods: { dtf, sublimation },
  },
  'Dri-Fit T-Shirt': { base: 145, methods: { dtf, sublimation } },
  'Dot-Net T-Shirt': { base: 175, methods: { dtf, sublimation } },
  // Cotton, so DTF only. Shirt prices follow the order of the sheet: French terry 275, Sinker 250.
  'Oversized T-Shirt': { baseByMaterial: { 'French terry': 275, Sinker: 250 }, methods: { dtf } },
};

// Shirt price for the chosen fabric (or the single price when the product has no fabric choice).
export const baseFor = (pricing, material) => {
  if (!pricing.baseByMaterial) return pricing.base;
  return pricing.baseByMaterial[material] ?? Math.min(...Object.values(pricing.baseByMaterial));
};
export const fromBase = (pricing) => (pricing.baseByMaterial ? Math.min(...Object.values(pricing.baseByMaterial)) : pricing.base);
export const printFrom = (pricing) => Math.min(...Object.values(pricing.methods).map((m) => m.normalPerSqIn));

// Sheet types for the printing services that print on a sheet. Sizes are in millimetres.
const A_SHEETS = [
  { id: 'a4', label: 'A4', w: 210, h: 297 },
  { id: 'a3', label: 'A3', w: 297, h: 420 },
];
const sheetOptions = { 'DTF Printing': A_SHEETS, 'Sublimation Printing': A_SHEETS, 'UV DTF Printing': A_SHEETS };
// Sheet products that also let you type your own size.
const customSheetProducts = ['Sublimation Printing'];

// Prices for the sheet services, in ₹. `sqin`: charged per square inch of artwork. `sheet`: a flat price per A4 sheet,
// and other sizes are charged in proportion to their area (an A3 sheet is exactly two A4 sheets).
const sheetPrices = {
  'DTF Printing': { per: 'sqin', rate: 1.5 },
  'UV DTF Printing': { per: 'sqin', rate: 4 },
  'Sublimation Printing': { per: 'sheet', a4: 35 },
};
const A4_MM2 = 210 * 297;
// Price of one sheet for a `per: 'sheet'` service (sheet size in mm).
export const sheetCost = (sp, sheet) => Math.round(((sheet.w * sheet.h) / A4_MM2) * sp.a4);

// Who a T-shirt is made for. Every T-shirt type comes in Men, Unisex and Kids (there is no Women's range).
// Add a product here only if it differs from this default.
const DEFAULT_AUDIENCES = ['men', 'unisex', 'kids'];
const audienceOptions = {};

// Categories kept out of the Print on Demand page by default. The admin panel can change this (see applyCatalog).
const DEFAULT_HIDDEN_GROUPS = ['customised-products', 'cards-identification', 'stickers-labels', 'business-printing'];

// Every category and product, shown or not. The admin panel lists these.
export const allGroups = groups.map((g, gi) => ({
  ...g,
  number: String(gi + 1).padStart(2, '0'),
  items: g.items.map((it) => ({
    ...it,
    category: g.name,
    slug: slugify(it.spec ? `${it.name} ${it.spec}` : it.name),
    colors: (colourOptions[it.name] || []).map((name) => ({ name, hex: palette[name] })),
    fabric: fabrics[it.name] || null,
    pricing: prices[it.name] || null,
    sheets: sheetOptions[it.name] || null,
    sheetPrice: sheetPrices[it.name] || null,
    customSheet: customSheetProducts.includes(it.name),
    audiences: audienceOptions[it.name] || (g.id === 't-shirts' ? DEFAULT_AUDIENCES : null),
  })),
}));


const originals = JSON.parse(JSON.stringify(allGroups));
export const defaultHiddenGroups = DEFAULT_HIDDEN_GROUPS;
export const variantKey = (colour = '', material = '', size = '') => JSON.stringify([colour, material, size]);
export const AUDIENCE_SIZES = { men: ['S','M','L','XL','XXL','XXXL'], women: ['XS','S','M','L','XL','XXL'], unisex: ['XS','S','M','L','XL','XXL','XXXL'], kids: ['2-3 yrs','4-5 yrs','6-7 yrs','8-9 yrs','10-11 yrs','12-13 yrs'] };
export const productLive = (p, now = Date.now()) => p.status !== 'draft' && p.status !== 'archived' && (p.status !== 'scheduled' || Date.parse(p.launchAt) <= now);
export function discounted(unit, discount, now = Date.now()) {
  if (unit == null || !discount?.enabled || (discount.startsAt && Date.parse(discount.startsAt) > now) || (discount.endsAt && Date.parse(discount.endsAt) < now)) return unit;
  return Math.round(Math.max(0, unit - (discount.type === 'percent' ? unit * discount.value / 100 : discount.value)) * 100) / 100;
}
export function stockFor(product, colour, material, size = '') {
  if (!product.stockTracked) return Infinity;
  return product.variants?.find((v) => v.key === variantKey(colour, material, size))?.stock ?? 0;
}
export function buildCatalog(c = {}) {
  const result = JSON.parse(JSON.stringify(originals));
  for (const group of result) for (const p of group.items) {
    p.groupId = group.id;
    p.status = 'active'; p.available = true; p.minQty = 1; p.maxQty = 10000;
    p.colors = p.colors.map((colour) => ({ ...colour, available: true }));
    if (p.pricing) {
      for (const [id, method] of Object.entries(p.pricing.methods)) Object.assign(method, c[id] || {});
      const base = c.bases?.[p.name];
      if (typeof base === 'number') p.pricing.base = base;
      else if (base && p.pricing.baseByMaterial) Object.assign(p.pricing.baseByMaterial, base);
    }
    if (p.sheetPrice) Object.assign(p.sheetPrice, c.sheetPrices?.[p.name] || {});
  }
  for (const entry of Object.values(c.productEntries || {})) {
    const original = result.flatMap((g) => g.items).find((p) => p.slug === entry.slug) || {};
    for (const group of result) group.items = group.items.filter((p) => p.slug !== entry.slug);
    const group = result.find((g) => g.id === entry.groupId);
    if (group) group.items.push(JSON.parse(JSON.stringify({ ...original, ...entry, category: group.name })));
  }
  for (const group of result) for (const p of group.items) {
    p.variants = (p.variants || []).map((v) => ({ ...v, stock: c.stock?.[p.slug]?.[v.key] ?? v.stock }));
  }
  return result;
}
export function visibleCatalog(c = {}, now = Date.now()) {
  return buildCatalog(c).filter((g) => !(c.hiddenGroups || DEFAULT_HIDDEN_GROUPS).includes(g.id)).map((g) => ({ ...g, items: g.items.filter((p) => productLive(p, now) && !(c.hiddenProducts || []).includes(p.name)) })).filter((g) => g.items.length);
}
export const printGroups = [];
export const printProducts = [];
export function applyCatalog(c = {}) {
  allGroups.splice(0, allGroups.length, ...buildCatalog(c));
  printGroups.splice(0, printGroups.length, ...visibleCatalog(c));
  printProducts.splice(0, printProducts.length, ...printGroups.flatMap((g) => g.items));
}
applyCatalog();
