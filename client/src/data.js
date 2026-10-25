const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const baseProducts = [
  { name: 'Shinobi Eye', price: 699, img: '/product-1.png', colors: ['#5a6b49', '#e6dcc0', '#f2f2f2'], more: 2 },
  { name: 'Good Days Ahead', price: 599, img: '/product-2.png', colors: ['#4a4a4a', '#151515', '#eeeeee'], more: 3 },
  { name: 'Bengali Typo Edition', price: 699, img: '/product-3.png', colors: ['#ddd2b5', '#9fb5c8', '#c62828'], more: 2 },
  { name: 'Minimal Heart', price: 599, img: '/product-4.png', colors: ['#f5eed8', '#b9c0a6', '#555555'] },
  { name: 'Lost In Space', price: 699, img: '/product-5.png', colors: ['#111111', '#eeeeee', '#3d3a7a'], more: 2 },
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

export const products = baseProducts.map((p) => ({
  ...shared,
  ...p,
  slug: slugify(p.name),
  blurb: `A bold graphic tee from the VA Originals collection, made for everyday streetwear.`,
  description: `${p.name} brings an original VA Originals design to a premium cotton tee. It is printed with high-quality DTF technology on soft 180 GSM fabric, made for everyday comfort and long-lasting wear.`,
}));

export const trending = products;

export const categories = [
  { name: 'T-Shirts', sub: 'Regular, Oversized, Polo', img: '/cat-tee.jpeg' },
  { name: 'Mugs', sub: 'Personalised Mugs', img: '/cat-mug.jpeg' },
  { name: 'Keychains', sub: 'Custom Keychains', img: '/cat-key.jpeg' },
  { name: 'Tote Bags', sub: 'Everyday Carry', img: '/cat-tote.jpeg' },
  { name: 'Stickers & Labels', sub: 'UV DTF Stickers', img: '/cat-sticker.jpeg' },
  { name: 'Photo Gifts', sub: 'Frames, Prints & More', img: '/cat-frame.jpeg' },
];

export const steps = [
  { n: 1, title: 'Choose Product', text: 'Select from our range of products.', icon: 'shirt' },
  { n: 2, title: 'Customise', text: 'Upload your design or use our tools.', icon: 'pen' },
  { n: 3, title: 'Place Order', text: 'Review and checkout securely.', icon: 'cart' },
  { n: 4, title: 'We Print & Deliver', text: 'High-quality prints, delivered to you.', icon: 'box' },
];

export const reviews = [
  { img: '/rev-1.jpeg', alt: 'Customer wearing a black tee with a sunrise print' },
  { img: '/rev-2.jpeg', alt: 'Custom "Good Ideas Better Coffee" mug' },
  { img: '/rev-3.jpeg', alt: 'Customer wearing a black tee with an illustrated back print' },
  { img: '/rev-4.jpeg', alt: 'Canvas tote bag printed "Carry Good Ideas."' },
  { img: '/rev-5.jpeg', alt: 'Custom character keychain held in hand' },
  { img: '/rev-6.jpeg', alt: 'Black "Wander More" mountain tee' },
];
