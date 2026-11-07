import { AUDIENCE_SIZES, visibleCatalog, variantKey } from '../../shared/customCatalog.js';
import { customQuote } from '../../shared/customQuote.js';
import { isLightHex } from '../../shared/pricing.js';
import { data } from './store.js';

const error = (message) => Object.assign(new Error(message), { status: 409 });
const sides = ['front','back','left','right'];
function validateDesign(design) {
  if (!design || typeof design !== 'object') throw error('A custom design is missing. Please add it again.');
  for (const side of sides) {
    if (!Array.isArray(design[side])) design[side] = [];
    if (design[side].length > 60) throw error('Too many design layers.');
    for (const layer of design[side]) {
      if (!['image','shape','text'].includes(layer.type)) throw error('A design layer is invalid.');
      if (![layer.x, layer.y, layer.rot].every(Number.isFinite) || Math.abs(layer.x) > 500 || Math.abs(layer.y) > 500 || Math.abs(layer.rot) > 3600) throw error('A design position is invalid.');
      if (layer.type === 'text') {
        if (!layer.text || typeof layer.text.value !== 'string' || layer.text.value.length > 2000 || !(layer.text.size > 0 && layer.text.size <= 100)) throw error('A text layer is invalid.');
      } else if (!(layer.w > 0 && layer.w <= 500)) throw error('A design width is invalid.');
      if (layer.type === 'image') {
        if (!(layer.image?.ratio > 0 && layer.image.ratio <= 100)) throw error('An image layer is invalid.');
        const crop = layer.crop || { l: 0, t: 0, r: 0, b: 0 };
        if (!Object.values(crop).every((n) => Number.isFinite(n) && n >= 0 && n < 1) || crop.l + crop.r >= 0.95 || crop.t + crop.b >= 0.95) throw error('An image crop is invalid.');
      }
      if (layer.repeat && ((layer.gap != null && !(layer.gap >= 0 && layer.gap <= 60)) || (layer.count != null && !(Number.isInteger(layer.count) && layer.count >= 1 && layer.count <= 601)))) throw error('A repeat layout is invalid.');
    }
  }
}

// Called inside the catalogue lock. All lines are checked together before stock changes.
export function prepareCustomOrder(items, designs, couponCode = '') {
  const catalog = data().catalog || {};
  const products = visibleCatalog(catalog).flatMap((g) => g.items);
  const demands = new Map(); const productTotals = new Map();
  for (const item of items) {
    if (!item.slug && !item.designId) continue;
    const p = products.find((p) => p.slug === item.slug);
    if (!p || p.available === false) throw error(`${item.name} is no longer available. Please update your cart.`);
    const cfg = item.config;
    if (!cfg) throw error('Please configure your custom product again.');
    if (p.updatedAt && cfg.mockupVersion !== p.updatedAt) throw error(`${p.name} was updated. Reopen the studio to review the latest options and mockup.`);
    item.name = `${p.name}${p.spec ? ` — ${p.spec}` : ''}`;
    item.sku = p.sku || p.slug;
    cfg.sku = item.sku;
    cfg.leadDays = p.leadDays ?? null;
    const colour = p.colors.find((c) => c.name === cfg.colour);
    if (p.colors.length && (!colour || colour.available === false)) throw error(`${p.name}: this colour is unavailable.`);
    const materials = p.fabric?.options || [];
    if (materials.length && !materials.includes(cfg.material)) throw error(`${p.name}: choose an available material.`);
    if (!materials.length && cfg.material !== (p.fabric?.material || null)) throw error(`${p.name}: the material has changed. Please configure it again.`);
    if (p.pricing) {
      const method = p.pricing.methods[cfg.method];
      if (!method || (method.lightOnly && colour && !isLightHex(colour.hex))) throw error(`${p.name}: this printing method is unavailable for the selected colour.`);
    }
    if (p.sheets?.length) {
      if (cfg.sheet?.id === 'custom' && p.customSheet) {
        if (!(cfg.sheet.w >= 25.4 && cfg.sheet.w <= 1524 && cfg.sheet.h >= 25.4 && cfg.sheet.h <= 1524)) throw error('Custom sheet sizes must be 1–60 inches.');
      } else {
        const sheet = p.sheets.find((s) => s.id === cfg.sheet?.id);
        if (!sheet || sheet.w !== cfg.sheet.w || sheet.h !== cfg.sheet.h) throw error('The selected sheet size has changed.');
      }
    } else if (cfg.sheet) throw error('This product does not use a printing sheet.');
    let sizes = [['', item.qty]];
    if (p.category === 'T-Shirts') {
      if (!p.audiences.includes(cfg.audience)) throw error('Select an available audience.');
      const allowedSizes = p.sizesByAudience?.[cfg.audience] || AUDIENCE_SIZES[cfg.audience];
      sizes = Object.entries(cfg.sizes || {});
      if (!sizes.length || sizes.some(([size, qty]) => !allowedSizes.includes(size) || !Number.isInteger(qty) || qty < 1) || sizes.reduce((sum, [, qty]) => sum + qty, 0) !== item.qty) throw error(`${p.name}: size quantities must match the cart quantity. Reopen the studio to change quantities.`);
    }
    productTotals.set(p.slug, (productTotals.get(p.slug) || 0) + item.qty);
    const design = designs?.[item.designId || item.slug];
    validateDesign(design);
    cfg.quantity = item.qty;
    const price = customQuote(p, cfg, design);
    const unit = price?.perPiece ?? null;
    if (item.unit !== unit) throw error(`${p.name}: the price has changed. Reopen the product and add the updated design to your cart.`);
    item.originalUnit = price?.originalPerPiece ?? null;
    item.productDiscount = price?.saving || 0;
    if (couponCode && price?.saving > 0 && p.discount?.stackable === false) throw error(`${p.name}: its product offer cannot be combined with a coupon.`);
    for (const [size, quantity] of sizes) {
      const key = variantKey(cfg.colour || '', cfg.material || '', size);
      if (p.stockTracked) {
        const variant = p.variants.find((v) => v.key === key);
        if (!variant) throw error(`${p.name}: this colour/material/size is out of stock.`);
        const id = `${p.slug}:${key}`;
        const previous = demands.get(id);
        demands.set(id, { slug: p.slug, key, available: variant.stock, qty: (previous?.qty || 0) + quantity });
      }
    }
  }
  for (const [slug, quantity] of productTotals) {
    const p = products.find((p) => p.slug === slug);
    if (quantity < (p.minQty || 1) || quantity > (p.maxQty || 10000)) throw error(`${p.name}: order between ${p.minQty || 1} and ${p.maxQty || 10000} pieces.`);
  }
  for (const demand of demands.values()) if (demand.qty > demand.available) throw error('Not enough stock remains for the selected colour, material and size. Please update your cart.');
  return [...demands.values()];
}

export function reserveInventory(demands) {
  if (!demands.length) return () => {};
  const catalog = data().catalog;
  catalog.stock = { ...catalog.stock };
  for (const d of demands) catalog.stock[d.slug] = { ...catalog.stock[d.slug], [d.key]: d.available - d.qty };
  catalog.revision = (catalog.revision || 0) + 1;
  return () => {
    for (const d of demands) data().catalog.stock[d.slug][d.key] += d.qty;
    data().catalog.revision = (data().catalog.revision || 0) + 1;
  };
}

export function restockCancelledOrder(order) {
  if (order.inventoryRestoredAt || order.dispatchedAt || order.history?.some((h) => ['shipped','delivered'].includes(h.status)) || ['in_transit','out_for_delivery','delivered','returning','returned'].includes(order.shipment?.stage) || !order.inventory?.length) return;
  const c = data().catalog;
  c.stock ||= {};
  for (const d of order.inventory) {
    const current = c.stock[d.slug]?.[d.key];
    // Archived/deleted variants are kept in the ledger for audit and later reactivation.
    c.stock[d.slug] = { ...c.stock[d.slug], [d.key]: (current ?? 0) + d.qty };
  }
  c.revision = (c.revision || 0) + 1;
  order.inventoryRestoredAt = new Date().toISOString();
}
