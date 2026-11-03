import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from 'lucide-react';
import { assetUrl } from '../api.js';
import { defaultCategories, defaultHome, defaultProductEntries, defaultReviews } from '../data.js';
import { ImageList, Loading, PageHead, saveContent, uploadImage, useLoad } from './ui.jsx';

const PAGES = { home: 'Home page', about: 'About page', 'print-on-demand': 'Print on Demand page' };
const HOME_SLOTS = [
  ['top', 'At the very top'], ['hero', 'After the big banner'], ['promos', 'After the three promo cards'], ['trending', 'After Trending Now'],
  ['categories', 'After Shop by Category'], ['customiser', 'After the online customiser'], ['feature', 'After VA Originals / Gifts'],
  ['how', 'After How It Works'], ['reviews', 'After Loved by Our Customers'], ['bottom', 'At the very bottom'],
];
const TYPES = {
  banner: 'Banner (big picture with text and button)', offer: 'Offer strip (discount message with a coupon code)', text: 'Text (heading and paragraphs)',
  products: 'Product row (pick products)', gallery: 'Picture gallery',
};
const blankSection = () => ({ id: '', page: 'home', after: 'bottom', type: 'banner', title: '', subtitle: '', body: '', image: '', buttonText: '', buttonLink: '', productIds: [], images: [], code: '', active: true });

const move = (list, i, d) => { const c = [...list]; [c[i], c[i + d]] = [c[i + d], c[i]]; return c; };

function SectionEditor({ section, products, onDone, onCancel }) {
  const [s, setS] = useState(section);
  const set = (k) => (e) => setS((c) => ({ ...c, [k]: e.target.value }));
  const slots = s.page === 'home' ? HOME_SLOTS : [['top', 'At the top'], ['bottom', 'At the bottom']];
  const has = (t) => ({ banner: ['title', 'subtitle', 'body', 'image', 'button', 'code'], offer: ['title', 'subtitle', 'button', 'code'], text: ['title', 'subtitle', 'body', 'button'], products: ['title', 'subtitle', 'products', 'button'], gallery: ['title', 'subtitle', 'images', 'button'] }[t]);
  const show = (f) => has(s.type).includes(f);

  return (
    <form className="ad-card ad-editor" onSubmit={(e) => { e.preventDefault(); onDone(s); }}>
      <div className="ad-editor-head">
        <h2>{section.id ? 'Edit section' : 'New section'}</h2>
        <button type="button" className="ad-icon" onClick={onCancel} aria-label="Close"><X size={18} /></button>
      </div>
      <div className="ad-fields">
        <label className="ad-field">Kind of section
          <select value={s.type} onChange={set('type')}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </label>
        <label className="ad-field">Which page
          <select value={s.page} onChange={(e) => setS((c) => ({ ...c, page: e.target.value, after: 'bottom' }))}>{Object.entries(PAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </label>
        <label className="ad-field">Where on the page
          <select value={s.after} onChange={set('after')}>{slots.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </label>
      </div>

      {show('title') && <label className="ad-field">Heading<input value={s.title} onChange={set('title')} maxLength={120} /></label>}
      {show('subtitle') && <label className="ad-field">Sub-heading<input value={s.subtitle} onChange={set('subtitle')} maxLength={200} /></label>}
      {show('body') && <label className="ad-field">Text (leave a blank line between paragraphs)<textarea rows={4} value={s.body} onChange={set('body')} maxLength={2000} /></label>}
      {show('image') && <ImageList value={s.image ? [s.image] : []} onChange={(v) => setS((c) => ({ ...c, image: v[0] || '' }))} max={1} main={false} label="Background picture" />}
      {show('images') && <ImageList value={s.images} onChange={(images) => setS((c) => ({ ...c, images }))} max={12} main={false} label="Pictures" />}
      {show('products') && (
        <div className="ad-field">Products to show (up to 12)
          <div className="ad-pickgrid">
            {products.filter((p) => p.id).map((p) => (
              <label key={p.id} className="ad-check">
                <input type="checkbox" checked={s.productIds.includes(p.id)} onChange={() => setS((c) => ({ ...c, productIds: c.productIds.includes(p.id) ? c.productIds.filter((x) => x !== p.id) : [...c.productIds, p.id].slice(0, 12) }))} /> {p.name}
              </label>
            ))}
          </div>
        </div>
      )}
      {show('code') && <label className="ad-field">Coupon code to show (optional, customers can copy it)<input value={s.code} onChange={(e) => setS((c) => ({ ...c, code: e.target.value.toUpperCase() }))} maxLength={30} placeholder="e.g. WELCOME10" /></label>}
      {show('button') && (
        <div className="ad-fields">
          <label className="ad-field">Button text (optional)<input value={s.buttonText} onChange={set('buttonText')} maxLength={40} /></label>
          <label className="ad-field">Button goes to<input value={s.buttonLink} onChange={set('buttonLink')} maxLength={300} placeholder="/print-on-demand or https://…" /></label>
        </div>
      )}
      <label className="ad-check"><input type="checkbox" checked={s.active} onChange={(e) => setS((c) => ({ ...c, active: e.target.checked }))} /> Visible on the website</label>
      <div className="ad-editor-foot">
        <button type="button" className="ad-btn" onClick={onCancel}>Cancel</button>
        <button className="ad-btn primary">Done</button>
      </div>
    </form>
  );
}

const TABS = [['sections', 'Extra sections'], ['blocks', 'Headings & announcement'], ['categories', 'Shop by Category'], ['reviews', 'Customer photos']];

export default function HomePage() {
  const { data, error, loading } = useLoad('/api/admin/content');
  const [tab, setTab] = useState('sections');
  const [d, setD] = useState(null);
  const [edit, setEdit] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    const c = data.content;
    setD({
      sections: c.sections || [],
      categories: c.categories || defaultCategories.map((x) => ({ ...x })),
      reviews: c.reviews || defaultReviews.map((x) => ({ ...x })),
      home: Object.fromEntries(Object.keys(defaultHome).map((k) => [k, { ...defaultHome[k], ...((c.home || {})[k] || {}) }])),
      products: c.products || defaultProductEntries(),
    });
  }, [data]);
  if (!d) return <><PageHead title="Home page & content" /><Loading error={error} loading={loading} /></>;

  const upd = (key, value) => { setD((c) => ({ ...c, [key]: value })); setDirty(true); setMsg(''); };
  const setBlock = (k, f, v) => upd('home', { ...d.home, [k]: { ...d.home[k], [f]: v } });

  const save = async () => {
    setBusy(true);
    setMsg('');
    try {
      const { products, ...partial } = d; // products are edited on their own page
      const saved = await saveContent(partial);
      setD((c) => ({ ...c, sections: saved.sections, categories: saved.categories, reviews: saved.reviews, home: saved.home }));
      setDirty(false);
      setMsg('Saved. The website shows these changes the next time a page opens.');
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const doneSection = (s) => {
    upd('sections', edit === -1 ? [s, ...d.sections] : d.sections.map((x, i) => (i === edit ? s : x)));
    setEdit(null);
  };

  const blocks = [['trending', 'Trending Now'], ['categories', 'Shop by Category'], ['reviews', 'Loved by Our Customers'], ['how', 'How It Works']];

  return (
    <>
      <PageHead title="Home page & content">
        <button type="button" className="ad-btn primary" onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save changes'}</button>
      </PageHead>
      <div className="ad-filters" role="tablist">
        {TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={`ad-chip${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {msg && <p className="ad-note" role="status">{msg}</p>}
      {dirty && <p className="ad-warn">You have unsaved changes.</p>}

      {tab === 'sections' && (
        <>
          <p className="ad-muted">Add your own sections to the Home, About or Print on Demand page: banners, offers with coupon codes, text, product rows and picture galleries. Trending Now products are edited under “Shop products”.</p>
          <div className="ad-pagehead-tools"><button type="button" className="ad-btn" onClick={() => setEdit(-1)}><Plus size={15} /> Add a section</button></div>
          {edit !== null && <SectionEditor key={edit} section={edit === -1 ? blankSection() : d.sections[edit]} products={d.products} onDone={doneSection} onCancel={() => setEdit(null)} />}
          <section className="ad-card flush">
            {d.sections.length === 0 ? <p className="ad-muted pad">No extra sections yet.</p> : (
              <table className="ad-table">
                <thead><tr><th>Section</th><th>Page · position</th><th /></tr></thead>
                <tbody>
                  {d.sections.map((s, i) => (
                    <tr key={s.id || i}>
                      <td><b>{s.title || TYPES[s.type].split(' (')[0]}</b><small>{TYPES[s.type].split(' (')[0]}{s.active ? '' : ' · hidden'}</small></td>
                      <td>{PAGES[s.page]}<small>{(s.page === 'home' ? HOME_SLOTS : [['top', 'At the top'], ['bottom', 'At the bottom']]).find(([k]) => k === s.after)?.[1]}</small></td>
                      <td className="ad-rowtools">
                        <button type="button" className="ad-icon" disabled={i === 0} onClick={() => upd('sections', move(d.sections, i, -1))} aria-label="Move up"><ArrowUp size={15} /></button>
                        <button type="button" className="ad-icon" disabled={i === d.sections.length - 1} onClick={() => upd('sections', move(d.sections, i, 1))} aria-label="Move down"><ArrowDown size={15} /></button>
                        <button type="button" className="ad-btn" onClick={() => setEdit(i)}><Pencil size={14} /> Edit</button>
                        <button type="button" className="ad-btn danger" onClick={() => window.confirm('Remove this section?') && upd('sections', d.sections.filter((_, k) => k !== i))} aria-label="Remove section"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <p className="ad-muted">Sections in the same spot show in the order listed here.</p>
        </>
      )}

      {tab === 'blocks' && (
        <>
          <section className="ad-card">
            <h2>Announcement bar (top of every page)</h2>
            <div className="ad-fields">
              <label className="ad-field wide2">Message<input value={d.home.announcement.text} onChange={(e) => setBlock('announcement', 'text', e.target.value)} maxLength={160} placeholder="e.g. 10% off your first order with WELCOME10" /></label>
              <label className="ad-field">Link (optional)<input value={d.home.announcement.link} onChange={(e) => setBlock('announcement', 'link', e.target.value)} placeholder="/print-on-demand" /></label>
            </div>
            <label className="ad-check"><input type="checkbox" checked={d.home.announcement.active} onChange={(e) => setBlock('announcement', 'active', e.target.checked)} /> Show the bar</label>
          </section>
          {blocks.map(([k, label]) => (
            <section key={k} className="ad-card">
              <h2>{label}</h2>
              <div className="ad-fields">
                <label className="ad-field">Heading<input value={d.home[k].title} onChange={(e) => setBlock(k, 'title', e.target.value)} maxLength={80} /></label>
                <label className="ad-field wide2">Sub-heading<input value={d.home[k].subtitle} onChange={(e) => setBlock(k, 'subtitle', e.target.value)} maxLength={200} /></label>
              </div>
              <label className="ad-check"><input type="checkbox" checked={d.home[k].visible} onChange={(e) => setBlock(k, 'visible', e.target.checked)} /> Show this section on the home page</label>
            </section>
          ))}
        </>
      )}

      {tab === 'categories' && (
        <>
          <p className="ad-muted">The picture cards in “Shop by Category”. Each card can link to a page (for example /print-on-demand) or stay on the home page.</p>
          <div className="ad-pagehead-tools"><button type="button" className="ad-btn" onClick={() => upd('categories', [...d.categories, { name: 'New category', sub: '', img: '', link: '' }].slice(0, 12))}><Plus size={15} /> Add a card</button></div>
          {d.categories.map((c, i) => {
            const set = (k, v) => upd('categories', d.categories.map((x, n) => (n === i ? { ...x, [k]: v } : x)));
            return (
              <section key={i} className="ad-card ad-row">
                <div className="ad-row-img">{c.img ? <img src={assetUrl(c.img)} alt="" /> : null}</div>
                <div className="ad-row-body">
                  <div className="ad-fields">
                    <label className="ad-field">Name<input value={c.name} onChange={(e) => set('name', e.target.value)} maxLength={60} /></label>
                    <label className="ad-field">Small text<input value={c.sub} onChange={(e) => set('sub', e.target.value)} maxLength={80} /></label>
                    <label className="ad-field">Link (optional)<input value={c.link} onChange={(e) => set('link', e.target.value)} placeholder="/print-on-demand" /></label>
                  </div>
                  <ImageList value={c.img ? [c.img] : []} onChange={(v) => set('img', v[0] || '')} max={1} main={false} label="Picture" />
                </div>
                <div className="ad-row-tools">
                  <button type="button" className="ad-icon" disabled={i === 0} onClick={() => upd('categories', move(d.categories, i, -1))} aria-label="Move up"><ArrowUp size={15} /></button>
                  <button type="button" className="ad-icon" disabled={i === d.categories.length - 1} onClick={() => upd('categories', move(d.categories, i, 1))} aria-label="Move down"><ArrowDown size={15} /></button>
                  <button type="button" className="ad-icon danger" onClick={() => upd('categories', d.categories.filter((_, n) => n !== i))} aria-label="Remove card"><Trash2 size={15} /></button>
                </div>
              </section>
            );
          })}
        </>
      )}

      {tab === 'reviews' && (
        <>
          <p className="ad-muted">The photos in “Loved by Our Customers”. Add a customer’s name and a short quote if you like.</p>
          <section className="ad-card">
            <label className="ad-add wide">
              Add customer photos
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={async (e) => {
                const files = [...e.target.files].slice(0, 40 - d.reviews.length);
                e.target.value = '';
                try {
                  const added = [];
                  for (const f of files) added.push({ id: '', img: await uploadImage(f), alt: '', name: '', quote: '' });
                  upd('reviews', [...d.reviews, ...added]);
                } catch (err) { setMsg(err.message); }
              }} />
            </label>
          </section>
          <div className="ad-revgrid">
            {d.reviews.map((r, i) => {
              const set = (k, v) => upd('reviews', d.reviews.map((x, n) => (n === i ? { ...x, [k]: v } : x)));
              return (
                <figure key={r.id || i} className="ad-card ad-rev">
                  <img src={assetUrl(r.img)} alt="" />
                  <input value={r.name} onChange={(e) => set('name', e.target.value)} placeholder="Customer name (optional)" maxLength={60} />
                  <input value={r.quote} onChange={(e) => set('quote', e.target.value)} placeholder="Short quote (optional)" maxLength={240} />
                  <figcaption>
                    <button type="button" className="ad-icon" disabled={i === 0} onClick={() => upd('reviews', move(d.reviews, i, -1))} aria-label="Move earlier"><ArrowUp size={14} /></button>
                    <button type="button" className="ad-icon" disabled={i === d.reviews.length - 1} onClick={() => upd('reviews', move(d.reviews, i, 1))} aria-label="Move later"><ArrowDown size={14} /></button>
                    <button type="button" className="ad-icon danger" onClick={() => upd('reviews', d.reviews.filter((_, n) => n !== i))} aria-label="Remove photo"><Trash2 size={14} /></button>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
