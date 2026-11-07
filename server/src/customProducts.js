import { AUDIENCE_SIZES, buildCatalog, variantKey } from '../../shared/customCatalog.js';
import { garmentFor } from '../../shared/garments.js';
import { safeUrl } from './content.js';

const bad = (message) => Object.assign(new Error(message), { status: 400 });
const text = (v, max = 120) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const number = (v, label, min = 0, max = 1000000) => {
  const n = Number(v);
  if (v === '' || v == null || !Number.isFinite(n) || n < min || n > max) throw bad(`${label} must be between ${min} and ${max}.`);
  return Math.round(n * 100) / 100;
};
const integer = (v, label, min = 0, max = 10000) => {
  const n = number(v, label, min, max);
  if (!Number.isInteger(n)) throw bad(`${label} must be a whole number.`);
  return n;
};
const strings = (items, max = 30) => {
  if (!Array.isArray(items) || items.length > max) throw bad('Too many options.');
  const result = items.map((v) => text(v, 80)).filter(Boolean);
  if (new Set(result).size !== result.length) throw bad('Option names must be unique.');
  return result;
};
const date = (value) => {
  if (!value) return null;
  if (!Number.isFinite(Date.parse(value))) throw bad('Enter a valid date and time.');
  return new Date(value).toISOString();
};
const image = (value) => {
  if (!value) return '';
  const url = safeUrl(value);
  // Own uploads embed reliably in generated mockups; external image CORS varies.
  if (!url || !url.startsWith('/') || url.startsWith('//')) throw bad('Upload an image to this shop instead of linking an external image.');
  return url;
};
const photos = (value = {}) => Object.fromEntries(['front','back','left','right'].filter((side) => value[side]).map((side) => [side, image(value[side])]));

export function cleanCustomProduct(input, slug, catalog) {
  const groups = buildCatalog(catalog);
  const group = groups.find((g) => g.id === input.groupId);
  if (!group) throw bad('Choose a product category.');
  const name = text(input.name, 100);
  if (name.length < 2) throw bad('Enter the product name.');
  const existing = groups.flatMap((g) => g.items).find((p) => p.slug === slug);
  const sku = text(input.sku, 60) || slug.toUpperCase();
  if (groups.flatMap((g) => g.items).some((p) => p.slug !== slug && p.sku?.toLowerCase() === sku.toLowerCase())) throw bad('That SKU is already used by another product.');
  if (!Array.isArray(input.colors) || input.colors.length > 30) throw bad('Add at most 30 colours.');
  const colors = input.colors.map((c) => {
    const name = text(c.name, 40);
    if (!name || !/^#[a-f0-9]{6}$/i.test(c.hex)) throw bad('Every colour needs a name and a valid colour code.');
    return { name, hex: c.hex.toLowerCase(), available: c.available !== false };
  });
  if (new Set(colors.map((c) => c.name.toLowerCase())).size !== colors.length) throw bad('Colour names must be unique.');
  const fabric = { material: text(input.fabric?.material, 80), options: strings(input.fabric?.options || []) };
  const status = ['draft','scheduled','active','archived'].includes(input.status) ? input.status : 'draft';
  const launchAt = date(input.launchAt);
  if (status === 'scheduled' && !launchAt) throw bad('Choose a launch date for a scheduled product.');
  const minQty = integer(input.minQty ?? 1, 'Minimum quantity', 1);
  const maxQty = integer(input.maxQty ?? 10000, 'Maximum quantity', minQty);
  const product = {
    slug, groupId: group.id, category: group.name, name, sku, spec: text(input.spec), icon: text(input.icon, 40) || 'Shirt',
    description: text(input.description, 2000), img: image(input.img), status, launchAt, newUntil: date(input.newUntil),
    available: input.available !== false, minQty, maxQty, leadDays: integer(input.leadDays ?? 3, 'Production lead time', 0, 365),
    lowStock: integer(input.lowStock ?? 5, 'Low-stock threshold'), garment: input.garment === 'polo' ? 'polo' : 'tee', fabric, colors,
    audiences: strings(input.audiences || (group.id === 't-shirts' ? ['men','unisex','kids'] : []), 4),
    stockTracked: input.stockTracked === true, variants: [], customSheet: input.customSheet === true,
    fixedPrice: input.fixedPrice == null || input.fixedPrice === '' ? null : number(input.fixedPrice, 'Product price'),
  };
  if (product.audiences.some((v) => !['men','women','unisex','kids'].includes(v))) throw bad('Choose a valid audience.');
  const sizesByAudience = {};
  for (const [audience, sizes] of Object.entries(input.sizesByAudience || {})) {
    if (!product.audiences.includes(audience)) continue;
    sizesByAudience[audience] = strings(sizes);
    if (!sizesByAudience[audience].length) throw bad('Each enabled audience needs at least one size.');
  }
  product.sizesByAudience = sizesByAudience;
  if (input.pricing) {
    const methods = {};
    for (const [id, method] of Object.entries(input.pricing.methods || {})) {
      if (!['dtf','sublimation'].includes(id)) throw bad('Choose DTF or sublimation printing.');
      methods[id] = { label: text(method.label, 60) || id, normalPerSqIn: number(method.normalPerSqIn, 'Print rate', 0, 10000), fullPerSqIn: number(method.fullPerSqIn, 'Full print rate', 0, 10000), lightOnly: method.lightOnly === true };
    }
    if (!Object.keys(methods).length) throw bad('Choose at least one print method.');
    product.pricing = { methods };
    if (input.pricing.baseByMaterial) {
      product.pricing.baseByMaterial = {};
      if (!fabric.options.length) throw bad('Add material options before setting material prices.');
      for (const material of fabric.options) product.pricing.baseByMaterial[material] = number(input.pricing.baseByMaterial[material], `${material} blank price`);
    } else product.pricing.base = number(input.pricing.base, 'Blank product price');
    if (group.id !== 't-shirts') throw bad('Per-print garment pricing is only supported for T-shirts. Choose a fixed price or quote for other products.');
  } else product.pricing = null;
  if (input.sheets != null && !Array.isArray(input.sheets)) throw bad('Sheet options must be a list.');
  product.sheets = (input.sheets || []).map((s) => ({ id: text(s?.id, 30), label: text(s?.label, 40), w: number(s?.w, 'Sheet width in mm', 25.4, 1524), h: number(s?.h, 'Sheet height in mm', 25.4, 1524) }));
  if (product.sheets.some((s) => !s.id || !s.label)) throw bad('Each sheet needs an ID and label.');
  if (product.sheets.length > 10 || new Set(product.sheets.map((s) => s.id)).size !== product.sheets.length) throw bad('Sheet options must be unique (at most 10).');
  if (input.sheetPrice) {
    if (!product.sheets.length) throw bad('Add sheet sizes for sheet pricing.');
    product.sheetPrice = input.sheetPrice.per === 'sheet' ? { per: 'sheet', a4: number(input.sheetPrice.a4, 'A4 price') } : { per: 'sqin', rate: number(input.sheetPrice.rate, 'Sheet print rate', 0, 10000) };
  } else product.sheetPrice = null;
  const d = input.discount || {};
  const startsAt = date(d.startsAt); const endsAt = date(d.endsAt);
  if (startsAt && endsAt && startsAt >= endsAt) throw bad('Discount end must be after its start.');
  product.discount = { enabled: d.enabled === true, type: d.type === 'flat' ? 'flat' : 'percent', value: number(d.value ?? 0, 'Discount', 0, d.type === 'flat' ? 1000000 : 100), startsAt, endsAt, stackable: d.stackable !== false };
  const mockups = input.mockups || {};
  product.mockups = { photos: photos(mockups.photos), colourPhotos: Object.create(null), areas: {}, tint: mockups.tint !== false, photoWidthIn: number(mockups.photoWidthIn ?? 24, 'Full photo width scale in inches', 1, 120) };
  for (const c of colors) if (mockups.colourPhotos?.[c.name]) product.mockups.colourPhotos[c.name] = photos(mockups.colourPhotos[c.name]);
  for (const side of ['front','back','left','right']) {
    const a = mockups.areas?.[side];
    if (!a) continue;
    const left = number(a.left, 'Print area left', 0, 99); const top = number(a.top, 'Print area top', 0, 99);
    const width = number(a.width, 'Print area width', 1, 100); const height = number(a.height, 'Print area height', 1, 100);
    if (left + width > 100 || top + height > 100) throw bad('Print areas must fit inside the image (100%).');
    product.mockups.areas[side] = { left, top, width, height };
  }
  if (!Array.isArray(input.variants) || input.variants.length > 1000) throw bad('Add at most 1000 stock variants.');
  product.variants = input.variants.map((v) => {
    const colour = text(v.colour, 40); const material = text(v.material, 80); const size = text(v.size, 30);
    if (colors.length && !colors.some((c) => c.name === colour)) throw bad('A stock variant uses an unknown colour.');
    if (fabric.options.length && !fabric.options.includes(material)) throw bad('A stock variant uses an unknown material.');
    if (!fabric.options.length && material !== fabric.material) throw bad('A stock variant does not match the fixed material.');
    if (!colors.length && colour) throw bad('Remove colours from stock variants when this product has no colour options.');
    const sizes = product.audiences.flatMap((audience) => product.sizesByAudience[audience] || AUDIENCE_SIZES[audience]);
    if (group.id === 't-shirts' ? !sizes.includes(size) : size !== '') throw bad('A stock variant uses an unavailable size.');
    return { colour, material, size, key: variantKey(colour, material, size), stock: integer(v.stock, 'Stock', 0, 1000000) };
  });
  if (new Set(product.variants.map((v) => v.key)).size !== product.variants.length) throw bad('Duplicate stock variants are not allowed.');
  if (product.stockTracked && !product.variants.length) throw bad('Add stock variants or turn off stock tracking.');
  if (status !== 'draft' && status !== 'archived' && group.id === 't-shirts' && !product.audiences.length) throw bad('Choose at least one audience and size range before publishing.');
  const garment = garmentFor(product);
  if (status !== 'draft' && status !== 'archived' && group.id === 't-shirts' && !garment.photos.front) throw bad('Add a front mockup before publishing.');
  product.createdAt = existing?.createdAt || new Date().toISOString();
  product.updatedAt = new Date().toISOString();
  return product;
}
