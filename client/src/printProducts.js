// Everything available for Print on Demand, grouped by category.
// `img` is a photo in /public; products without one show an icon tile (`icon` is a lucide-react name).

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const groups = [
  {
    id: 't-shirts',
    name: 'T-Shirts',
    blurb: 'Pick a style and print your design on it.',
    items: [
      { name: 'Regular T-Shirt', icon: 'Shirt', img: '/tee-regular.png' },
      { name: 'Polo T-Shirt', icon: 'Shirt' },
      { name: 'Dri-Fit T-Shirt', icon: 'Shirt' },
      { name: 'Dot-Net T-Shirt', icon: 'Shirt' },
      { name: 'Oversized T-Shirt', icon: 'Shirt', img: '/cat-tee.jpeg' },
    ],
  },
  {
    id: 'printing-services',
    name: 'Printing Services',
    blurb: 'Send us your artwork and choose the print method.',
    items: [
      { name: 'DTF Printing', icon: 'Printer' },
      { name: 'Sublimation Printing', icon: 'Droplets' },
      { name: 'UV DTF Printing', icon: 'Layers' },
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
  'Polo T-Shirt': { material: 'Cotton piqué', options: ['180 GSM', '220 GSM'] },
  'Regular T-Shirt': { material: 'Pure cotton', options: [] }, // only one quality, so nothing to choose
  'Dri-Fit T-Shirt': { material: 'Polyester, quick-dry', options: ['130 GSM', '150 GSM'] },
  'Dot-Net T-Shirt': { material: 'Polyester mesh', options: ['130 GSM', '150 GSM'] },
  'Oversized T-Shirt': { material: 'Heavy cotton', options: ['220 GSM', '240 GSM'] },
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
const prices = {
  'Regular T-Shirt': { base: 230, normalPerSqIn: 1, fullPerSqIn: 0.75 },
};

export const printGroups = groups.map((g, gi) => ({
  ...g,
  number: String(gi + 1).padStart(2, '0'),
  items: g.items.map((it) => ({
    ...it,
    category: g.name,
    slug: slugify(it.spec ? `${it.name} ${it.spec}` : it.name),
    colors: (colourOptions[it.name] || []).map((name) => ({ name, hex: palette[name] })),
    fabric: fabrics[it.name] || null,
    pricing: prices[it.name] || null,
  })),
}));

export const printProducts = printGroups.flatMap((g) => g.items);
