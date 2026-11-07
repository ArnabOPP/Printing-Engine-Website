import { quote, sheetQuote, layerSize, PHOTO_WIDTH_IN } from './pricing.js';
import { garmentFor } from './garments.js';
import { discounted } from './customCatalog.js';

const full = { left: 0, top: 0, width: 100, height: 100 };
export function repeatCount(layer, sheet, area = full) {
  if (!layer.repeat) return 1;
  const { w, h } = layerSize(layer);
  const rad = layer.rot * Math.PI / 180;
  const bw = w * Math.abs(Math.cos(rad)) + h * Math.abs(Math.sin(rad));
  const bh = w * Math.abs(Math.sin(rad)) + h * Math.abs(Math.cos(rad));
  const height = sheet.h / sheet.w * area.height / area.width * 100;
  const gap = (layer.gap ?? 0.1) / (sheet.w / 25.4 / 100 * area.width / 100);
  const dx = Math.max(bw + gap, 1); const dy = Math.max(bh + gap, 1);
  const cx = layer.x; const cy = layer.y / 100 * height;
  const columns = Math.max(0, Math.floor((100 - bw / 2 - cx + 0.05) / dx) - Math.ceil((bw / 2 - cx - 0.05) / dx) + 1);
  const rows = Math.max(0, Math.floor((height - bh / 2 - cy + 0.05) / dy) - Math.ceil((bh / 2 - cy - 0.05) / dy) + 1);
  const originalInside = cx - bw / 2 >= -0.05 && cx + bw / 2 <= 100.05 && cy - bh / 2 >= -0.05 && cy + bh / 2 <= height + 0.05;
  const copies = 1 + Math.min(600, Math.max(0, columns * rows - (originalInside ? 1 : 0)));
  return layer.count ? Math.min(copies, layer.count) : copies;
}

export function customQuote(product, config, design, now = Date.now()) {
  let result = null;
  if (product.pricing) {
    const garment = garmentFor(product, config.colour);
    result = quote({ pricing: product.pricing, material: config.material, method: config.method, design, mode: design.mode, quantity: config.quantity, photoWidthIn: product.mockups?.photoWidthIn || PHOTO_WIDTH_IN,
      areaOf: (side) => design.mode === 'full' && ['front','back'].includes(side) ? full : garment.areas[side] });
  } else if (product.sheetPrice && config.sheet) {
    const area = garmentFor(product).areas.front;
    const inchesPerUnit = config.sheet.w / 25.4 / 100 * area.width / 100;
    result = sheetQuote({ sheetPrice: product.sheetPrice, sheet: config.sheet, quantity: config.quantity,
      items: (design.front || []).map((layer) => { const { w, h } = layerSize(layer); return { sqIn: w * h * inchesPerUnit ** 2, copies: repeatCount(layer, config.sheet, area) }; }) });
  } else if (product.fixedPrice != null) result = { perPiece: product.fixedPrice, quantity: config.quantity, total: product.fixedPrice * config.quantity };
  if (!result) return null;
  const originalPerPiece = result.perPiece;
  const perPiece = discounted(originalPerPiece, product.discount, now);
  return { ...result, originalPerPiece, perPiece, saving: originalPerPiece - perPiece, total: perPiece * config.quantity };
}
