// Everything available for Print on Demand, grouped by category.
// `img` is a photo in /public; products without one show an icon tile (`icon` is a lucide-react name).

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const groups = [
  {
    id: 't-shirts',
    name: 'T-Shirts',
    blurb: 'Pick a style and print your design on it.',
    items: [
      { name: 'Cotton T-Shirt', icon: 'Shirt', img: '/cat-tee.jpeg' },
      { name: 'Polo T-Shirt', icon: 'Shirt' },
      { name: 'Regular T-Shirt', icon: 'Shirt', img: '/cat-tee.jpeg' },
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

export const printGroups = groups.map((g, gi) => ({
  ...g,
  number: String(gi + 1).padStart(2, '0'),
  items: g.items.map((it) => ({
    ...it,
    category: g.name,
    slug: slugify(it.spec ? `${it.name} ${it.spec}` : it.name),
  })),
}));

export const printProducts = printGroups.flatMap((g) => g.items);
