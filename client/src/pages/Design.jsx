import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Bold, Check, ChevronRight, Copy, FlipHorizontal2, Image as ImageIcon,
  Info, Italic, Redo2, RotateCcw, Shapes, ShoppingBag, Trash2, Type, Undo2, Upload, CaseUpper,
} from 'lucide-react';
import { printProducts } from '../printProducts.js';
import TeePhoto from '../components/TeePhoto.jsx';
import { useHistory } from '../studio/useHistory.js';
import { ShapeSvg, shapeList } from '../studio/shapes.jsx';
import { useCart } from '../context/CartContext.jsx';

/* ---------- configuration ---------- */

// Normal print: where the print goes on the tee photo, as % of the photo box.
const TEE_AREAS = {
  front: { left: 28, top: 20, width: 44, height: 52 },
  back: { left: 26, top: 13, width: 48, height: 60 },
};
// Full body print: the whole photo box. Artwork is then clipped to the shirt's own outline.
const FULL_AREA = { left: 0, top: 0, width: 100, height: 100 };
const FLAT_AREA = { left: 0, top: 0, width: 100, height: 100 };

const areaFor = (isTee, mode, side) => {
  if (!isTee) return FLAT_AREA;
  return mode === 'full' ? FULL_AREA : TEE_AREAS[side];
};

// Width / height of the flat canvas for products that are not T-shirts (matched on the product label).
const flatRatios = [
  [/visiting card/i, 90 / 55], [/pvc card/i, 85.6 / 54], [/id card/i, 54 / 85.6],
  [/a3/i, 297 / 420], [/a4/i, 210 / 297], [/a5/i, 148 / 210],
  [/mug|cup/i, 2.4], [/cap/i, 2.2], [/pen/i, 5], [/bottle/i, 0.5], [/keychain/i, 0.8],
  [/stamp/i, 1.6], [/poster/i, 297 / 420],
];
const flatRatio = (label) => (flatRatios.find(([re]) => re.test(label)) || [null, 1])[1];

const fonts = [
  { name: 'Archivo', css: "'Archivo', sans-serif" },
  { name: 'Barlow Condensed', css: "'Barlow Condensed', sans-serif" },
  { name: 'Caveat (handwriting)', css: "'Caveat', cursive" },
  { name: 'Georgia (serif)', css: 'Georgia, serif' },
  { name: 'Courier (mono)', css: "'Courier New', monospace" },
];

const palette = ['#ffffff', '#161616', '#b6ff00', '#d32f2f', '#2b59d9', '#f2c230', '#f08ca4', '#ff7a1a'];

const printModes = [
  { id: 'normal', title: 'Normal print', text: 'Print inside the chest or back area. Anything outside the area is cut off.' },
  { id: 'full', title: 'Full body print', text: 'All-over print across the whole shirt. Your artwork is clipped to the shirt’s shape.' },
];

const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const isLight = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
};

const readConfig = (slug) => {
  try { return JSON.parse(sessionStorage.getItem(`po-config-${slug}`) || 'null'); } catch { return null; }
};
const readSaved = (slug) => {
  try {
    const d = JSON.parse(localStorage.getItem(`po-design-${slug}`) || 'null');
    if (d && Array.isArray(d.front) && Array.isArray(d.back)) return { front: d.front, back: d.back, mode: d.mode === 'full' ? 'full' : 'normal' };
  } catch { /* ignore */ }
  return { front: [], back: [], mode: 'normal' };
};

// Re-express layers from one print area to another so they stay in the same place and size on the shirt.
function convertLayers(layers, a, b) {
  const k = a.width / b.width;
  return layers.map((l) => {
    const px = a.left + (l.x / 100) * a.width;
    const py = a.top + (l.y / 100) * a.height;
    const next = { ...l, x: ((px - b.left) / b.width) * 100, y: ((py - b.top) / b.height) * 100 };
    if (l.w != null) next.w = l.w * k;
    if (l.text) next.text = { ...l.text, size: l.text.size * k };
    return next;
  });
}

/* ---------- layers on the canvas ---------- */

// Keep receiving pointer events while dragging outside the element (ignored if the browser refuses).
const capture = (el, id) => {
  try { el.setPointerCapture(id); } catch { /* ignore */ }
};

function layerStyle(layer) {
  const style = {
    left: `${layer.x}%`,
    top: `${layer.y}%`,
    opacity: layer.opacity,
    transform: `translate(-50%, -50%) rotate(${layer.rot}deg)`,
  };
  if (layer.type === 'image') { style.width = `${layer.w}%`; style.aspectRatio = `1 / ${layer.image.ratio}`; }
  if (layer.type === 'shape') { style.width = `${layer.w}%`; style.aspectRatio = '1 / 1'; }
  return style;
}

function LayerContent({ layer, measure }) {
  const m = measure ? { 'data-content': true } : {};
  if (layer.type === 'text') {
    const t = layer.text;
    return (
      <div
        {...m}
        className="st-text"
        style={{
          fontFamily: t.font, fontSize: `${t.size}cqw`, color: t.color, fontWeight: t.bold ? 800 : 500,
          fontStyle: t.italic ? 'italic' : 'normal', textTransform: t.upper ? 'uppercase' : 'none',
        }}
      >
        {t.value || ' '}
      </div>
    );
  }
  if (layer.type === 'image') {
    return (
      <div {...m} className="st-fill">
        <img src={layer.image.src} alt={layer.image.name} draggable={false} style={{ transform: layer.flip ? 'scaleX(-1)' : undefined }} />
      </div>
    );
  }
  return <div {...m} className="st-fill"><ShapeSvg kind={layer.shape.kind} fill={layer.shape.fill} /></div>;
}

// Shared pointer logic: move, resize (uniform) and rotate.
function useDrag({ layer, areaRef, ref, onSelect, onBegin, onChange }) {
  const drag = useRef(null);

  const centre = () => {
    const r = ref.current.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  const startMove = (e) => {
    if (e.button > 0) return;
    e.stopPropagation();
    onSelect?.(layer.id);
    onBegin();
    const a = areaRef.current.getBoundingClientRect();
    drag.current = { mode: 'move', sx: e.clientX, sy: e.clientY, x: layer.x, y: layer.y, aw: a.width, ah: a.height };
    capture(ref.current, e.pointerId);
  };

  const startHandle = (mode) => (e) => {
    e.stopPropagation();
    onBegin();
    const c = centre();
    drag.current = { mode, c, d0: Math.hypot(e.clientX - c.x, e.clientY - c.y) || 1, w0: layer.w, size0: layer.text?.size };
    capture(e.currentTarget, e.pointerId);
  };

  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    if (d.mode === 'move') {
      onChange(layer.id, {
        x: clamp(d.x + ((e.clientX - d.sx) / d.aw) * 100, -10, 110),
        y: clamp(d.y + ((e.clientY - d.sy) / d.ah) * 100, -10, 110),
      }, false);
    } else if (d.mode === 'size') {
      const f = clamp(Math.hypot(e.clientX - d.c.x, e.clientY - d.c.y) / d.d0, 0.1, 8);
      if (layer.type === 'text') onChange(layer.id, (l) => ({ text: { ...l.text, size: clamp(d.size0 * f, 2, 90) } }), false);
      else onChange(layer.id, { w: clamp(d.w0 * f, 4, 200) }, false);
    } else if (d.mode === 'rotate') {
      let deg = (Math.atan2(e.clientY - d.c.y, e.clientX - d.c.x) * 180) / Math.PI + 90;
      if (deg > 180) deg -= 360;
      if (Math.abs(deg) < 4) deg = 0;
      else if (Math.abs(Math.abs(deg) - 90) < 4) deg = Math.sign(deg) * 90;
      onChange(layer.id, { rot: Math.round(deg) }, false);
    }
  };

  const end = () => { drag.current = null; };

  return { startMove, startHandle, move, end };
}

// The artwork itself. It lives inside the clipping box, so it is cut off at the print area.
function Layer({ layer, areaRef, onSelect, onBegin, onChange }) {
  const ref = useRef(null);
  const d = useDrag({ layer, areaRef, ref, onSelect, onBegin, onChange });
  return (
    <div
      ref={ref}
      className="st-layer"
      style={layerStyle(layer)}
      onPointerDown={d.startMove}
      onPointerMove={d.move}
      onPointerUp={d.end}
      onPointerCancel={d.end}
    >
      <LayerContent layer={layer} measure />
    </div>
  );
}

// Selection box and handles. Drawn outside the clipping box so they stay visible at the edge.
function Chrome({ layer, areaRef, onBegin, onChange }) {
  const ref = useRef(null);
  const d = useDrag({ layer, areaRef, ref, onBegin, onChange });
  return (
    <div
      ref={ref}
      className="st-layer st-chrome-el"
      style={layerStyle(layer)}
      onPointerDown={d.startMove}
      onPointerMove={d.move}
      onPointerUp={d.end}
      onPointerCancel={d.end}
    >
      <div className="st-ghost" aria-hidden="true"><LayerContent layer={layer} /></div>
      <span className="st-box" />
      <button type="button" className="st-handle st-rot" aria-label="Rotate" onPointerDown={d.startHandle('rotate')} />
      <button type="button" className="st-handle st-size" aria-label="Resize" onPointerDown={d.startHandle('size')} />
    </div>
  );
}

/* ---------- the studio ---------- */

function Studio({ product, cfg, slug }) {
  const { add: addToCart } = useCart();
  const isTee = product.category === 'T-Shirts';
  const hex = product.colors.find((c) => c.name === cfg.colour)?.hex || '#ffffff';
  const onLight = isLight(hex);
  const ink = onLight ? '#161616' : '#ffffff';
  const accent = onLight ? '#161616' : '#b6ff00';

  const [initial] = useState(() => readSaved(slug));
  const { design, set, checkpoint, undo, redo, canUndo, canRedo } = useHistory(initial);

  const [side, setSide] = useState('front');
  const [selectedId, setSelectedId] = useState(null);
  const [shapesOpen, setShapesOpen] = useState(false);
  const [guide, setGuide] = useState(true);
  const [notice, setNotice] = useState('');
  const [saveNote, setSaveNote] = useState('');
  const [outside, setOutside] = useState(false);
  const [added, setAdded] = useState(false);
  const [askEmpty, setAskEmpty] = useState(false);

  const areaRef = useRef(null);
  const fileRef = useRef(null);

  const mode = isTee ? design.mode : 'normal';
  const full = mode === 'full';
  const layers = design[side];
  const selected = layers.find((l) => l.id === selectedId) || null;
  const aspect = isTee ? 1 : flatRatio(cfg.product);
  const area = areaFor(isTee, mode, side);
  const areaAspect = (area.width / area.height) * aspect; // width / height of the print area
  const totalLayers = design.front.length + design.back.length;
  const garmentSrc = side === 'front' ? '/tee-front.png' : '/tee-back.png';

  /* ----- edit helpers ----- */
  const update = (fn, push = true) => set((d) => ({ ...d, [side]: fn(d[side]) }), push);
  const patch = (id, p, push = true) =>
    update((ls) => ls.map((l) => (l.id === id ? { ...l, ...(typeof p === 'function' ? p(l) : p) } : l)), push);
  const addLayer = (layer) => { update((ls) => [...ls, layer]); setSelectedId(layer.id); setAdded(false); setAskEmpty(false); };
  const remove = (id) => { update((ls) => ls.filter((l) => l.id !== id)); setSelectedId(null); };
  const duplicate = (l) => addLayer({ ...l, id: uid(), x: l.x + 4, y: l.y + 4, text: l.text && { ...l.text }, shape: l.shape && { ...l.shape } });
  const reorder = (id, dir) => update((ls) => {
    const i = ls.findIndex((l) => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ls.length) return ls;
    const c = [...ls];
    [c[i], c[j]] = [c[j], c[i]];
    return c;
  });

  const chooseMode = (next) => {
    if (next === design.mode) return;
    set((d) => ({
      ...d,
      mode: next,
      front: convertLayers(d.front, areaFor(true, d.mode, 'front'), areaFor(true, next, 'front')),
      back: convertLayers(d.back, areaFor(true, d.mode, 'back'), areaFor(true, next, 'back')),
    }));
    setAdded(false);
  };

  const addText = () => addLayer({
    id: uid(), type: 'text', x: 50, y: 50, rot: 0, opacity: 1,
    text: { value: 'Your text', font: fonts[0].css, size: 12, color: ink, bold: true, italic: false, upper: false },
  });
  const addShape = (kind) => addLayer({ id: uid(), type: 'shape', x: 50, y: 50, w: 35, rot: 0, opacity: 1, shape: { kind, fill: accent } });

  const onFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setNotice('Please choose an image file (PNG, JPG, SVG or WebP).'); return; }
    if (file.size > 15 * 1024 * 1024) { setNotice('That image is over 15 MB. Please choose a smaller one.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result;
      const img = new window.Image();
      img.onload = () => {
        const ratio = img.naturalHeight / img.naturalWidth || 1;
        // Start as large as is comfortable, but never bigger than the print area.
        const w = Math.min(full ? 70 : 85, 92 / (ratio * (area.width / area.height) * aspect));
        addLayer({
          id: uid(), type: 'image', x: 50, y: 50, w: Math.max(w, 8), rot: 0, opacity: 1, flip: false,
          image: { src, ratio, nw: img.naturalWidth, name: file.name },
        });
      };
      img.onerror = () => setNotice('That image could not be read. Try a different file.');
      img.src = src;
    };
    reader.onerror = () => setNotice('That image could not be read. Try a different file.');
    reader.readAsDataURL(file);
  };

  /* ----- effects ----- */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(t);
  }, [notice]);

  // Autosave on this device (skipped when the design is too big for browser storage).
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const json = JSON.stringify(design);
        if (json.length > 4_000_000) { setSaveNote('Too large to autosave'); return; }
        localStorage.setItem(`po-design-${slug}`, json);
        setSaveNote(totalLayers ? 'Autosaved on this device' : '');
      } catch {
        setSaveNote('Autosave unavailable');
      }
    }, 500);
    return () => clearTimeout(t);
  }, [design, slug, totalLayers]);

  // In normal print, warn when something sticks out of the print area (it will be cut off).
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el || full) { setOutside(false); return; }
    const a = el.getBoundingClientRect();
    let out = false;
    el.querySelectorAll('[data-content]').forEach((c) => {
      const r = c.getBoundingClientRect();
      if (r.left < a.left - 2 || r.right > a.right + 2 || r.top < a.top - 2 || r.bottom > a.bottom + 2) out = true;
    });
    setOutside(out);
  }, [layers, side, full]);

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && k === 'y') { e.preventDefault(); redo(); return; }
      if (!selected) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(selected.id); }
      else if (e.key === 'Escape') setSelectedId(null);
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 3 : 0.5;
        patch(selected.id, {
          x: selected.x + (e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0),
          y: selected.y + (e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0),
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* ----- order ----- */
  const addDesignToCart = () => {
    if (!totalLayers && !askEmpty) { setAskEmpty(true); return; }
    addToCart(cfg.quantity);
    setAdded(true);
    setAskEmpty(false);
  };

  const label = cfg.product;
  const sizeSummary = cfg.sizes ? Object.entries(cfg.sizes).map(([s, n]) => `${s} × ${n}`).join(', ') : '';
  const layerName = (l) => (l.type === 'text' ? `“${l.text.value.slice(0, 18) || 'Text'}”` : l.type === 'image' ? l.image.name : (shapeList.find((s) => s.kind === l.shape.kind)?.label || 'Shape'));
  const LayerIcon = (l) => (l.type === 'text' ? Type : l.type === 'image' ? ImageIcon : Shapes);

  const colourRow = (value, onPick, onFocus) => (
    <div className="st-colours">
      {palette.map((c) => (
        <button key={c} type="button" aria-label={`Colour ${c}`} className={value.toLowerCase() === c ? 'on' : ''} style={{ background: c }} onClick={() => onPick(c)} />
      ))}
      <label className="st-custom" title="Pick any colour">
        <input type="color" value={value} onFocus={onFocus} onChange={(e) => onPick(e.target.value, false)} aria-label="Custom colour" />
      </label>
    </div>
  );

  const slider = (props) => (
    <input
      type="range"
      {...props}
      onPointerDown={checkpoint}
      onKeyDown={(e) => { if (e.key.startsWith('Arrow') && !e.repeat) checkpoint(); }}
    />
  );

  return (
    <div className="wrap st">
      <nav className="pd-crumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link><ChevronRight size={12} />
        <Link to="/print-on-demand">Print on Demand</Link><ChevronRight size={12} />
        <Link to={`/customise/${slug}`}>{label}</Link><ChevronRight size={12} />
        <b>Design</b>
      </nav>

      <ol className="opt-progress" aria-label="Progress">
        <li className="done"><span><Check size={14} strokeWidth={3} /></span>Choose product</li>
        <li className="done"><span><Check size={14} strokeWidth={3} /></span>Choose options</li>
        <li className="on"><span>3</span>Add your design</li>
      </ol>

      <div className="st-layout">
        {/* tools */}
        <div className="st-tools" role="toolbar" aria-label="Add to your design">
          <button type="button" onClick={() => fileRef.current?.click()}><Upload size={20} /><small>Upload</small></button>
          <button type="button" onClick={addText}><Type size={20} /><small>Text</small></button>
          <button type="button" className={shapesOpen ? 'on' : ''} aria-expanded={shapesOpen} onClick={() => setShapesOpen((o) => !o)}><Shapes size={20} /><small>Shapes</small></button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </div>

        {/* stage */}
        <div className="st-main">
          {isTee && (
            <div className="st-mode" role="radiogroup" aria-label="Print type">
              {printModes.map((m) => (
                <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} className={mode === m.id ? 'on' : ''} onClick={() => chooseMode(m.id)}>
                  <strong>{m.title}</strong>
                  <small>{m.text}</small>
                </button>
              ))}
            </div>
          )}

          <div className="st-bar">
            <div className="st-bar-l">
              <button type="button" onClick={undo} disabled={!canUndo} aria-label="Undo"><Undo2 size={17} /></button>
              <button type="button" onClick={redo} disabled={!canRedo} aria-label="Redo"><Redo2 size={17} /></button>
              <button type="button" disabled={!layers.length} onClick={() => { update(() => []); setSelectedId(null); }} aria-label="Clear this side"><RotateCcw size={16} /> <span>Clear</span></button>
            </div>
            {isTee && (
              <div className="opt-views st-sides" role="tablist" aria-label="Side to design">
                {['front', 'back'].map((s) => (
                  <button key={s} role="tab" aria-selected={side === s} className={side === s ? 'on' : ''} onClick={() => { setSide(s); setSelectedId(null); }}>
                    {s === 'front' ? 'Front' : 'Back'}{design[s].length ? ` · ${design[s].length}` : ''}
                  </button>
                ))}
              </div>
            )}
            {!full && (
              <label className="st-guide-toggle">
                <input type="checkbox" checked={guide} onChange={(e) => setGuide(e.target.checked)} /> Print area
              </label>
            )}
          </div>

          {shapesOpen && (
            <div className="st-shapes" role="group" aria-label="Shapes">
              {shapeList.map((s) => (
                <button key={s.kind} type="button" onClick={() => addShape(s.kind)} aria-label={`Add ${s.label}`}>
                  <svg viewBox="0 0 100 100" aria-hidden="true" fill="currentColor">{s.node}</svg>
                  <small>{s.label}</small>
                </button>
              ))}
            </div>
          )}

          {notice && <p className="st-alert" role="alert"><AlertTriangle size={15} /> {notice}</p>}

          <div className="st-canvas" onPointerDown={() => setSelectedId(null)}>
            <div className="st-stage" style={{ width: `min(100%, calc(74vh * ${aspect}))`, aspectRatio: String(aspect) }}>
              {isTee ? (
                <div className="st-garment">
                  <TeePhoto src={garmentSrc} colour={hex} alt={`${label}, ${side}`} />
                </div>
              ) : (
                <div className="st-flat" style={{ background: hex }} />
              )}
              <div
                ref={areaRef}
                className="st-area"
                style={{ left: `${area.left}%`, top: `${area.top}%`, width: `${area.width}%`, height: `${area.height}%` }}
              >
                {guide && !full && <span className="st-guide"><em>Print area{isTee ? ` · ${side}` : ''}</em></span>}
                <div className={`st-clip${full ? ' full' : ''}`} style={full ? { '--mask': `url("${garmentSrc}")` } : undefined}>
                  {layers.map((l) => (
                    <Layer key={l.id} layer={l} areaRef={areaRef} onSelect={setSelectedId} onBegin={checkpoint} onChange={patch} />
                  ))}
                </div>
                <div className="st-chrome">
                  {selected && <Chrome key={selected.id} layer={selected} areaRef={areaRef} onBegin={checkpoint} onChange={patch} />}
                </div>
              </div>
              {!totalLayers && (
                <p className="st-empty">Start with <b>Upload</b>, <b>Text</b> or <b>Shapes</b></p>
              )}
            </div>
          </div>

          <div className="st-status">
            {full && <span className="st-info"><Info size={14} /> Full body print: your artwork covers the whole shirt and is clipped to its shape.</span>}
            {outside && <span className="st-warn"><AlertTriangle size={14} /> Part of your design is outside the print area and will be cut off.</span>}
            {selected?.type === 'image' && selected.image.nw < 800 && (
              <span className="st-warn"><Info size={14} /> This image is small ({selected.image.nw}px wide) and may print blurry.</span>
            )}
            {saveNote && <span className="st-save">{saveNote}</span>}
          </div>
        </div>

        {/* panel */}
        <aside className="st-panel">
          <section className="st-card" aria-label="Edit selected item">
            <h3>{selected ? (selected.type === 'text' ? 'Edit text' : selected.type === 'image' ? 'Edit image' : 'Edit shape') : 'Edit'}</h3>
            {!selected && <p className="opt-muted">Click an item on the shirt to edit it. Drag to move, use the round handles to resize and rotate.</p>}

            {selected?.type === 'text' && (
              <div className="st-fields">
                <label>Text
                  <textarea rows={2} value={selected.text.value} onFocus={checkpoint}
                    onChange={(e) => patch(selected.id, (l) => ({ text: { ...l.text, value: e.target.value } }), false)} />
                </label>
                <label>Font
                  <select value={selected.text.font} onChange={(e) => patch(selected.id, (l) => ({ text: { ...l.text, font: e.target.value } }))}>
                    {fonts.map((f) => <option key={f.name} value={f.css}>{f.name}</option>)}
                  </select>
                </label>
                <div>
                  <span className="st-lbl">Style</span>
                  <div className="st-toggles">
                    <button type="button" className={selected.text.bold ? 'on' : ''} aria-pressed={selected.text.bold} aria-label="Bold" onClick={() => patch(selected.id, (l) => ({ text: { ...l.text, bold: !l.text.bold } }))}><Bold size={16} /></button>
                    <button type="button" className={selected.text.italic ? 'on' : ''} aria-pressed={selected.text.italic} aria-label="Italic" onClick={() => patch(selected.id, (l) => ({ text: { ...l.text, italic: !l.text.italic } }))}><Italic size={16} /></button>
                    <button type="button" className={selected.text.upper ? 'on' : ''} aria-pressed={selected.text.upper} aria-label="Capitals" onClick={() => patch(selected.id, (l) => ({ text: { ...l.text, upper: !l.text.upper } }))}><CaseUpper size={16} /></button>
                  </div>
                </div>
                <label>Size
                  {slider({ min: 3, max: 60, step: 0.5, value: selected.text.size, onChange: (e) => patch(selected.id, (l) => ({ text: { ...l.text, size: Number(e.target.value) } }), false) })}
                </label>
                <div>
                  <span className="st-lbl">Colour</span>
                  {colourRow(selected.text.color, (c, push = true) => patch(selected.id, (l) => ({ text: { ...l.text, color: c } }), push), checkpoint)}
                </div>
              </div>
            )}

            {selected?.type === 'shape' && (
              <div className="st-fields">
                <div>
                  <span className="st-lbl">Colour</span>
                  {colourRow(selected.shape.fill, (c, push = true) => patch(selected.id, (l) => ({ shape: { ...l.shape, fill: c } }), push), checkpoint)}
                </div>
              </div>
            )}

            {selected?.type === 'image' && (
              <div className="st-fields">
                <p className="st-file" title={selected.image.name}>{selected.image.name}</p>
                <div className="st-toggles">
                  <button type="button" onClick={() => patch(selected.id, (l) => ({ flip: !l.flip }))}><FlipHorizontal2 size={16} /> Flip</button>
                  <button
                    type="button"
                    onClick={() => patch(selected.id, (l) => ({
                      w: Math.max(Math.min(full ? 70 : 85, 92 / (l.image.ratio * (area.width / area.height) * aspect)), 8), x: 50, y: 50, rot: 0,
                    }))}
                  ><RotateCcw size={15} /> Fit to area</button>
                </div>
              </div>
            )}

            {selected && (
              <div className="st-fields st-common">
                <label>Rotate · {selected.rot}°
                  {slider({ min: -180, max: 180, step: 1, value: selected.rot, onChange: (e) => patch(selected.id, { rot: Number(e.target.value) }, false) })}
                </label>
                <label>Opacity · {Math.round(selected.opacity * 100)}%
                  {slider({ min: 10, max: 100, step: 1, value: Math.round(selected.opacity * 100), onChange: (e) => patch(selected.id, { opacity: Number(e.target.value) / 100 }, false) })}
                </label>
                <div className="st-actions">
                  <button type="button" onClick={() => duplicate(selected)}><Copy size={15} /> Duplicate</button>
                  <button type="button" onClick={() => reorder(selected.id, 1)} aria-label="Bring forward"><ArrowUp size={15} /></button>
                  <button type="button" onClick={() => reorder(selected.id, -1)} aria-label="Send backward"><ArrowDown size={15} /></button>
                  <button type="button" className="danger" onClick={() => remove(selected.id)} aria-label="Delete"><Trash2 size={15} /></button>
                </div>
              </div>
            )}
          </section>

          <section className="st-card" aria-label="Layers">
            <h3>Layers{isTee ? ` · ${side}` : ''}</h3>
            {layers.length === 0 ? (
              <p className="opt-muted">Nothing here yet.</p>
            ) : (
              <ul className="st-layers">
                {[...layers].reverse().map((l) => {
                  const I = LayerIcon(l);
                  return (
                    <li key={l.id} className={l.id === selectedId ? 'on' : ''}>
                      <button type="button" onClick={() => setSelectedId(l.id)}><I size={15} /><span>{layerName(l)}</span></button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="st-card st-order" aria-label="Order summary">
            <h3>Your order</h3>
            <dl>
              <dt>Product</dt><dd>{label}</dd>
              {cfg.material && (<><dt>Material</dt><dd>{cfg.material}</dd></>)}
              {cfg.colour && (<><dt>Colour</dt><dd>{cfg.colour}</dd></>)}
              {cfg.audience && (<><dt>For</dt><dd>{cfg.audience}</dd></>)}
              {sizeSummary && (<><dt>Sizes</dt><dd>{sizeSummary}</dd></>)}
              <dt>Quantity</dt><dd>{cfg.quantity}</dd>
              {isTee && (<><dt>Print</dt><dd>{full ? 'Full body print' : 'Normal print'}</dd></>)}
              <dt>Design</dt><dd>{isTee ? `Front ${design.front.length} · Back ${design.back.length}` : `${design.front.length} item${design.front.length === 1 ? '' : 's'}`}</dd>
            </dl>

            {added ? (
              <div className="st-done" role="status">
                <p><Check size={16} strokeWidth={3} /> Added {cfg.quantity} to your cart</p>
                <small>Checkout isn’t connected yet. Your design is saved on this device.</small>
                <div className="st-done-links">
                  <button type="button" onClick={() => setAdded(false)}>Keep editing</button>
                  <Link to="/print-on-demand">Design another product</Link>
                </div>
              </div>
            ) : (
              <>
                {askEmpty && <p className="st-alert" role="alert"><AlertTriangle size={15} /> You haven’t added a design yet. Press again to add the plain product.</p>}
                <button type="button" className="btn btn-lime-solid opt-go" onClick={addDesignToCart}>
                  <ShoppingBag size={17} /> {askEmpty ? 'Add without a design' : 'Add to cart'}
                </button>
              </>
            )}
            <Link to={`/customise/${slug}`} className="opt-back"><ArrowLeft size={14} /> Back to options</Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

/* ---------- route wrapper ---------- */

export default function Design() {
  const { slug } = useParams();
  const { state } = useLocation();
  const product = printProducts.find((p) => p.slug === slug);
  const cfg = useMemo(() => state || readConfig(slug), [state, slug]);

  if (!product) return <Navigate to="/print-on-demand" replace />;
  if (!cfg) return <Navigate to={`/customise/${slug}`} replace />;
  return <Studio key={slug} product={product} cfg={cfg} slug={slug} />;
}
