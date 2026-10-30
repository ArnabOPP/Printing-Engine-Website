// Price estimate for a design on a T-shirt.
//
// Printing is charged by size: the price is (blank shirt) + (square inches of print x rate), per piece.
// The "size" of the print on one side is the box that holds all the artwork on that side.
//
// ASSUMPTION: the whole tee photo box is PHOTO_WIDTH_IN inches wide (the shirt itself is about 22 in across,
// a typical adult medium). Every size is priced with this same scale. Change it to match your real print sizes.
export const PHOTO_WIDTH_IN = 24;

import { baseFor } from '../printProducts.js';

const SIDES = ['front', 'back', 'left', 'right'];

let ctx = null;
const textContext = () => {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d');
  return ctx;
};

// Size of a layer in "area-width units" (% of the print area's width), before rotation.
function layerSize(layer) {
  if (layer.type === 'image') return { w: layer.w, h: layer.w * layer.image.ratio };
  if (layer.type === 'shape') return { w: layer.w, h: layer.w };
  const t = layer.text;
  const c = textContext();
  c.font = `${t.italic ? 'italic ' : ''}${t.bold ? 800 : 500} 100px ${t.font}`;
  const lines = (t.upper ? t.value.toUpperCase() : t.value || ' ').split('\n');
  const widest = Math.max(...lines.map((l) => c.measureText(l).width)) / 100;
  // font-size is `size` units; line-height 1.1; 0.15em padding each side (see .st-text)
  return { w: t.size * widest + t.size * 0.3, h: t.size * (1.1 * lines.length + 0.2) };
}

// Square inches of print on one side: the bounding box of all artwork (rotation included), kept inside the area.
export function sideSqIn(layers, area) {
  if (!layers.length) return 0;
  const heightUnits = (area.height / area.width) * 100; // area height in area-width units
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  layers.forEach((l) => {
    const { w, h } = layerSize(l);
    const rad = (l.rot * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const bw = w * cos + h * sin;
    const bh = w * sin + h * cos;
    const cx = l.x;
    const cy = (l.y / 100) * heightUnits;
    minX = Math.min(minX, cx - bw / 2);
    maxX = Math.max(maxX, cx + bw / 2);
    minY = Math.min(minY, cy - bh / 2);
    maxY = Math.max(maxY, cy + bh / 2);
  });
  const inchesPerUnit = ((area.width / 100) * PHOTO_WIDTH_IN) / 100;
  const widthIn = Math.max(0, Math.min(maxX, 100) - Math.max(minX, 0)) * inchesPerUnit;
  const heightIn = Math.max(0, Math.min(maxY, heightUnits) - Math.max(minY, 0)) * inchesPerUnit;
  return widthIn * heightIn;
}

// Sublimation (and anything else marked `lightOnly`) only works on light colours.
export const isLightHex = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b >= 165;
};

// areaOf(side) gives the print area (in % of the photo) for that side in the current print mode.
// `material` picks the shirt price for fabrics that are priced differently; `method` is the print method id.
export function quote({ pricing, material, method, design, mode, quantity, areaOf }) {
  const m = pricing.methods[method] || Object.values(pricing.methods)[0];
  const base = baseFor(pricing, material);
  const lines = [];
  let print = 0;
  SIDES.forEach((s) => {
    if (!design[s].length) return;
    const sqIn = sideSqIn(design[s], areaOf(s));
    const fullBody = mode === 'full' && (s === 'front' || s === 'back');
    const rate = fullBody ? m.fullPerSqIn : m.normalPerSqIn;
    const amount = Math.round(sqIn * rate);
    print += amount;
    lines.push({ side: s, sqIn: Math.round(sqIn * 10) / 10, rate, amount });
  });
  const perPiece = base + print;
  return { base, method: m, lines, print, perPiece, quantity, total: perPiece * quantity };
}

export const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

// A per-square-inch rate: whole rupees as they are, part-rupee rates with two decimals (0.50, 0.75).
export const fmtRate = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
