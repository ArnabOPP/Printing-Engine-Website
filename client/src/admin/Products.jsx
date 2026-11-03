import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from 'lucide-react';
import { assetUrl } from '../api.js';
import { defaultProductEntries } from '../data.js';
import { ImageList, Loading, PageHead, rupees, saveContent, useLoad } from './ui.jsx';

const lines = (a) => (a || []).join('\n');
const toLines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const blank = () => ({
  id: '', name: '', price: '', comparePrice: '', images: [], colors: ['#161616'], sizes: ['S', 'M', 'L', 'XL', 'XXL'], brand: 'VA Originals',
  blurb: '', description: '', features: [], care: [], shipping: [], trending: true, active: true,
});

function Editor({ product, onSave, onCancel }) {
  const [p, setP] = useState({ ...product, comparePrice: product.comparePrice ?? '' });
  const [text, setText] = useState({ features: lines(product.features), care: lines(product.care), shipping: lines(product.shipping), sizes: (product.sizes || []).join(', ') });
  const set = (k) => (e) => setP((c) => ({ ...c, [k]: e.target.value }));
  const flag = (k) => (e) => setP((c) => ({ ...c, [k]: e.target.checked }));
  const off = p.comparePrice && Number(p.comparePrice) > Number(p.price) ? Math.round((1 - p.price / p.comparePrice) * 100) : 0;

  const submit = (e) => {
    e.preventDefault();
    onSave({
      ...p, price: Number(p.price), comparePrice: p.comparePrice === '' ? null : Number(p.comparePrice),
      features: toLines(text.features), care: toLines(text.care), shipping: toLines(text.shipping),
      sizes: text.sizes.split(',').map((s) => s.trim()).filter(Boolean),
    });
  };

  return (
    <form className="ad-card ad-editor" onSubmit={submit}>
      <div className="ad-editor-head">
        <h2>{product.id ? `Edit ${product.name}` : 'New product'}</h2>
        <button type="button" className="ad-icon" onClick={onCancel} aria-label="Close"><X size={18} /></button>
      </div>

      <div className="ad-fields">
        <label className="ad-field wide2">Name<input value={p.name} onChange={set('name')} required maxLength={80} /></label>
        <label className="ad-field">Price<span className="ad-money">₹<input type="number" min="0" step="1" value={p.price} onChange={set('price')} required /></span></label>
        <label className="ad-field">Original price (optional)
          <span className="ad-money">₹<input type="number" min="0" step="1" value={p.comparePrice} onChange={set('comparePrice')} placeholder="shows as crossed out" /></span>
          {off > 0 && <small className="ad-ok">Shows “{off}% off”</small>}
        </label>
        <label className="ad-field">Brand<input value={p.brand} onChange={set('brand')} maxLength={60} /></label>
      </div>

      <ImageList value={p.images} onChange={(images) => setP((c) => ({ ...c, images }))} max={6} label="Pictures (the first is the main one)" />

      <div className="ad-fields">
        <div className="ad-field">Colours
          <div className="ad-colours">
            {p.colors.map((c, i) => (
              <span key={i} className="ad-colour">
                <input type="color" value={c} onChange={(e) => setP((cur) => ({ ...cur, colors: cur.colors.map((x, k) => (k === i ? e.target.value : x)) }))} aria-label={`Colour ${i + 1}`} />
                <button type="button" onClick={() => setP((cur) => ({ ...cur, colors: cur.colors.filter((_, k) => k !== i) }))} aria-label="Remove colour"><X size={12} /></button>
              </span>
            ))}
            {p.colors.length < 12 && <button type="button" className="ad-btn" onClick={() => setP((cur) => ({ ...cur, colors: [...cur.colors, '#ffffff'] }))}><Plus size={14} /> Colour</button>}
          </div>
        </div>
        <label className="ad-field wide2">Sizes (separated by commas)<input value={text.sizes} onChange={(e) => setText({ ...text, sizes: e.target.value })} /></label>
      </div>

      <label className="ad-field">Short line (under the name)<input value={p.blurb} onChange={set('blurb')} maxLength={200} /></label>
      <label className="ad-field">Description<textarea rows={4} value={p.description} onChange={set('description')} maxLength={1500} /></label>
      <div className="ad-fields">
        <label className="ad-field">Features (one per line)<textarea rows={5} value={text.features} onChange={(e) => setText({ ...text, features: e.target.value })} /></label>
        <label className="ad-field">Fabric &amp; care (one per line)<textarea rows={5} value={text.care} onChange={(e) => setText({ ...text, care: e.target.value })} /></label>
        <label className="ad-field">Shipping (one per line)<textarea rows={5} value={text.shipping} onChange={(e) => setText({ ...text, shipping: e.target.value })} /></label>
      </div>
      <p className="ad-muted">Leave features, care or shipping empty to use the standard text.</p>

      <div className="ad-checks">
        <label className="ad-check"><input type="checkbox" checked={p.trending} onChange={flag('trending')} /> Show in “Trending Now”</label>
        <label className="ad-check"><input type="checkbox" checked={p.active} onChange={flag('active')} /> Visible on the website</label>
      </div>

      <div className="ad-editor-foot">
        <button type="button" className="ad-btn" onClick={onCancel}>Cancel</button>
        <button className="ad-btn primary">Done</button>
      </div>
    </form>
  );
}

export default function Products() {
  const { data, error, loading } = useLoad('/api/admin/content');
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null); // index being edited, or -1 for a new product
  const [msg, setMsg] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (data) setList(data.content.products || defaultProductEntries()); }, [data]);
  if (!list) return <><PageHead title="Shop products" /><Loading error={error} loading={loading} /></>;

  const change = (next) => { setList(next); setDirty(true); setMsg(''); };
  const move = (i, d) => { const c = [...list]; [c[i], c[i + d]] = [c[i + d], c[i]]; change(c); };

  const save = async () => {
    setBusy(true);
    setMsg('');
    try {
      const saved = await saveContent({ products: list });
      setList(saved.products);
      setDirty(false);
      setMsg('Saved. The website shows these products the next time a page opens.');
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const done = (p) => {
    change(edit === -1 ? [p, ...list] : list.map((x, i) => (i === edit ? p : x)));
    setEdit(null);
  };

  return (
    <>
      <PageHead title="Shop products">
        <button type="button" className="ad-btn" onClick={() => setEdit(-1)}><Plus size={15} /> Add product</button>
        <button type="button" className="ad-btn primary" onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save changes'}</button>
      </PageHead>
      <p className="ad-muted">The ready-made designs sold on the website (Trending Now and the product pages). Order here is the order shown. These are separate from the Print on Demand products.</p>
      {msg && <p className="ad-note" role="status">{msg}</p>}
      {dirty && <p className="ad-warn">You have unsaved changes.</p>}

      {edit !== null && <Editor key={edit} product={edit === -1 ? blank() : list[edit]} onSave={done} onCancel={() => setEdit(null)} />}

      <section className="ad-card flush">
        {list.length === 0 ? <p className="ad-muted pad">No products. Add one to get started.</p> : (
          <table className="ad-table">
            <thead><tr><th /><th>Product</th><th>Price</th><th>Where</th><th /></tr></thead>
            <tbody>
              {list.map((p, i) => (
                <tr key={p.id || i}>
                  <td className="ad-imgcell">{p.images[0] ? <img src={assetUrl(p.images[0])} alt="" /> : null}</td>
                  <td><b>{p.name}</b><small>{p.brand} · {p.colors.length} colours · {p.images.length} pictures</small></td>
                  <td>{rupees(p.price)}{p.comparePrice ? <small><s>{rupees(p.comparePrice)}</s></small> : null}</td>
                  <td>{!p.active ? <span className="ad-pill red">hidden</span> : p.trending ? <span className="ad-pill lime">Trending</span> : <span className="ad-pill">Shop only</span>}</td>
                  <td className="ad-rowtools">
                    <button type="button" className="ad-icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp size={15} /></button>
                    <button type="button" className="ad-icon" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown size={15} /></button>
                    <button type="button" className="ad-btn" onClick={() => setEdit(i)}><Pencil size={14} /> Edit</button>
                    <button type="button" className="ad-btn danger" onClick={() => window.confirm(`Remove ${p.name}?`) && change(list.filter((_, k) => k !== i))} aria-label={`Remove ${p.name}`}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
