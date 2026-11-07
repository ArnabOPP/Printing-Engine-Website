import { useEffect, useState } from 'react';
import { Plus, Search, Copy, ArrowLeft, Upload } from 'lucide-react';
import { api, assetUrl } from '../api.js';
import { AUDIENCE_SIZES, defaultHiddenGroups } from '../printProducts.js';
import { garmentFor } from '../studio/garments.js';
import { Loading, PageHead, rupees, useLoad } from './ui.jsx';

const clone = (value) => JSON.parse(JSON.stringify(value));
const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const localTime = (value) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0,16) : '';
const dateValue = (value) => value ? new Date(value).toISOString() : null;

function Lines({ label, value = [], onChange }) {
  const [text, setText] = useState(value.join('\n'));
  return <label className="ad-field">{label}<textarea rows={3} value={text} onChange={(e) => { setText(e.target.value); onChange(e.target.value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)); }} /><small>One option per line, or separate with commas.</small></label>;
}

function ImageUpload({ label, value, onChange, onBusy }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const upload = async (file) => {
    if (!file) return;
    setError('');
    if (!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type) || file.size > 8 * 1024 * 1024) { setError('Choose PNG, JPG, WebP or GIF under 8 MB.'); return; }
    setBusy(true); onBusy?.(1);
    try {
      const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      const result = await api('/api/admin/custom-products/media', { method: 'POST', body: { data } });
      onChange(result.url);
    } catch (err) { setError(err.message || 'Image upload failed.'); }
    finally { setBusy(false); onBusy?.(-1); }
  };
  return <div className="ad-image-field"><span className="ad-lbl">{label}</span>
    {value && <img src={assetUrl(value)} alt={label} />}
    <label className="ad-btn"><Upload size={14} /> {busy ? 'Uploading…' : 'Upload image'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} /></label>
    {value && <button type="button" className="ad-btn" disabled={busy} onClick={() => onChange('')}>Remove from product</button>}
    {error && <p className="ad-error" role="alert">{error}</p>}
  </div>;
}

function ProductEditor({ initial, groups, revision, isNew, onSaved, onCancel, hiddenGroups }) {
  const [p, setP] = useState(() => ({ ...clone(initial), sku: initial.sku || '', status: initial.status || 'draft', description: initial.description || '',
    minQty: initial.minQty || 1, maxQty: initial.maxQty || 10000, leadDays: initial.leadDays ?? 3, lowStock: initial.lowStock ?? 5,
    fixedPrice: initial.fixedPrice ?? null, variants: initial.variants || [], stockTracked: !!initial.stockTracked,
    mockups: { ...clone(garmentFor(initial)), ...initial.mockups, photos: { ...garmentFor(initial).photos, ...initial.mockups?.photos }, areas: { ...garmentFor(initial).areas, ...initial.mockups?.areas }, colourPhotos: initial.mockups?.colourPhotos || {} },
    discount: initial.discount || { enabled: false, type: 'percent', value: 0, stackable: true },
  }));
  const [tab, setTab] = useState('details');
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState(0);
  const [error, setError] = useState('');
  const [photoColour, setPhotoColour] = useState('');
  const [side, setSide] = useState('front');
  const update = (key, value) => setP((old) => ({ ...old, [key]: value }));
  const field = (key, label, props = {}) => <label className="ad-field">{label}<input value={p[key] ?? ''} onChange={(e) => {
    const value = props.type === 'number' ? e.target.value === '' ? '' : Number(e.target.value) : e.target.value;
    if (key === 'name' && isNew) setP((old) => ({ ...old, name:value, slug:!old.slug || old.slug === slugify(old.name) ? slugify(value) : old.slug }));
    else update(key,value);
  }} {...props} /></label>;
  const check = (key, label) => <label className="ad-check"><input type="checkbox" checked={p[key] !== false} onChange={(e) => update(key, e.target.checked)} />{label}</label>;
  const materials = p.fabric?.options?.length ? p.fabric.options : [p.fabric?.material || ''];
  const sizes = p.category === 'T-Shirts' ? [...new Set((p.audiences || []).flatMap((aud) => p.sizesByAudience?.[aud] || AUDIENCE_SIZES[aud]))] : [''];
  const colours = p.colors.length ? p.colors.map((c) => c.name) : [''];
  const updateVariant = (index, key, value) => update('variants', p.variants.map((v, i) => i === index ? { ...v, [key]: value } : v));
  const discountField = (key, value) => update('discount', { ...p.discount, [key]: value });
  const mockups = p.mockups;
  const currentPhotos = photoColour ? mockups.colourPhotos?.[photoColour] || {} : mockups.photos || {};
  const photo = currentPhotos[side] || (!photoColour ? '' : mockups.photos?.[side]);
  const area = mockups.areas?.[side] || { left: 0, top: 0, width: 100, height: 100 };
  const setPhoto = (value) => update('mockups', photoColour ? { ...mockups, colourPhotos: { ...mockups.colourPhotos, [photoColour]: { ...mockups.colourPhotos?.[photoColour], [side]: value } } } : { ...mockups, photos: { ...mockups.photos, [side]: value } });

  const save = async () => {
    setBusy(true); setError('');
    try {
      const result = await api(`/api/admin/custom-products/${encodeURIComponent(p.slug)}`, { method: 'PUT', body: { product: p, revision, create:isNew } });
      onSaved(result.product);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return <>
    <PageHead title={isNew ? 'Launch a custom product' : p.name}>
      <button type="button" className="ad-btn" disabled={busy || uploads > 0} onClick={onCancel}><ArrowLeft size={14} /> Back to products</button>
    </PageHead>
    <div className="ad-filters" role="tablist" aria-label="Product settings">{[['details','Product & launch'],['stock','Colours & stock'],['pricing','Price & discount'],['mockups','Mockup images']].map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} disabled={busy || uploads > 0} className={`ad-chip${tab === id ? ' on' : ''}`} onClick={() => setTab(id)}>{label}</button>)}</div>
    <fieldset className="ad-card" disabled={busy || uploads > 0} aria-label="Product settings">
      {tab === 'details' && <>
        <h2>Product details</h2>
        <div className="ad-fields">
          {field('name','Product name', { maxLength: 100 })}
          {field('slug','Permanent URL ID', { disabled: !isNew, placeholder: 'premium-oversized-tee' })}
          {field('sku','SKU / internal code', { maxLength: 60 })}
          {field('spec','Short specification', { maxLength: 120 })}
          <label className="ad-field">Category<select value={p.groupId} onChange={(e) => { const g = groups.find((g) => g.id === e.target.value); setP({ ...p, groupId: g.id, category: g.name }); }}>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
          <label className="ad-field">Visibility<select value={p.status} onChange={(e) => update('status', e.target.value)}><option value="draft">Draft — staff only</option><option value="active">Published</option><option value="scheduled">Scheduled launch</option><option value="archived">Archived</option></select></label>
          <label className="ad-field">Launch date and time<input type="datetime-local" value={localTime(p.launchAt)} onChange={(e) => update('launchAt', dateValue(e.target.value))} /></label>
          <label className="ad-field">Show “New launch” until<input type="datetime-local" value={localTime(p.newUntil)} onChange={(e) => update('newUntil', dateValue(e.target.value))} /></label>
          {field('leadDays','Production time before dispatch (days)', { type: 'number', min: 0, max: 365 })}
          {field('minQty','Minimum order quantity', { type: 'number', min: 1 })}
          {field('maxQty','Maximum order quantity', { type: 'number', min: 1, max: 10000 })}
        </div>
        <label className="ad-field">Description<textarea rows={4} maxLength={2000} value={p.description} onChange={(e) => update('description',e.target.value)} /></label>
        <ImageUpload label="Catalogue product photo" value={p.img} onChange={(value) => update('img',value)} onBusy={(delta) => setUploads((n) => n + delta)} />
        {(hiddenGroups || defaultHiddenGroups).includes(p.groupId) && <p className="ad-warn">This category is hidden. Enable it under Global print rates → What the website shows before launch.</p>}
        <p className="ad-muted">Draft and archived products cannot be ordered. Schedule times use your device’s timezone. Existing order artwork remains unchanged when a product is edited.</p>
      </>}

      {tab === 'stock' && <>
        <h2>Colour availability</h2>{check('available','Accept orders for this product')}
        <div className="ad-scroll"><table className="ad-table"><thead><tr><th>Colour name</th><th>Swatch</th><th>Available</th><th /></tr></thead><tbody>
          {p.colors.map((c, index) => <tr key={index}><td><input aria-label={`Colour ${index + 1} name`} value={c.name} onChange={(e) => update('colors',p.colors.map((v,i) => i === index ? { ...v,name:e.target.value } : v))} /></td><td><input aria-label={`${c.name} swatch`} type="color" value={c.hex} onChange={(e) => update('colors',p.colors.map((v,i) => i === index ? { ...v,hex:e.target.value } : v))} /></td><td><input aria-label={`${c.name} available`} type="checkbox" checked={c.available !== false} onChange={(e) => update('colors',p.colors.map((v,i) => i === index ? { ...v,available:e.target.checked } : v))} /></td><td><button className="ad-btn" onClick={() => update('colors',p.colors.filter((_,i) => i !== index))}>Remove</button></td></tr>)}
        </tbody></table></div>
        <button className="ad-btn" onClick={() => update('colors',[...p.colors,{ name:'', hex:'#ffffff', available:true }])}><Plus size={14} /> Add colour</button>
        <div className="ad-fields ad-section-gap">
          <label className="ad-field">Fixed material<input value={p.fabric?.material || ''} onChange={(e) => update('fabric',{ ...p.fabric,material:e.target.value })} /></label>
          <Lines label="Material / quality choices (leave empty for a fixed material)" value={p.fabric?.options} onChange={(options) => update('fabric',{ ...p.fabric,options })} />
        </div>
        {p.category === 'T-Shirts' && <>
          <h2>Audiences and sizes</h2>
          {Object.keys(AUDIENCE_SIZES).map((aud) => <div key={aud}><label className="ad-check"><input type="checkbox" checked={p.audiences?.includes(aud)} onChange={(e) => update('audiences',e.target.checked ? [...(p.audiences || []),aud] : p.audiences.filter((v) => v !== aud))} />{aud}</label>{p.audiences?.includes(aud) && <Lines key={`${p.slug}-${aud}`} label={`${aud} sizes`} value={p.sizesByAudience?.[aud] || AUDIENCE_SIZES[aud]} onChange={(sizes) => update('sizesByAudience',{ ...p.sizesByAudience,[aud]:sizes })} />}</div>)}
        </>}
        <h2 className="ad-section-gap">Stock quantities</h2>
        <label className="ad-check"><input type="checkbox" checked={p.stockTracked} onChange={(e) => update('stockTracked',e.target.checked)} />Track stock by colour, material and size</label>
        {!p.stockTracked && <p className="ad-muted">Quantities are unrestricted while tracking is off. Colour availability and order limits still apply.</p>}
        {p.stockTracked && <>
          {field('lowStock','Low-stock warning threshold', { type:'number',min:0 })}
          <div className="ad-scroll"><table className="ad-table"><thead><tr><th>Colour</th><th>Material</th><th>Size</th><th>Available units</th><th /></tr></thead><tbody>{p.variants.map((v,index) => <tr key={index}>
            <td><select aria-label={`Variant ${index + 1} colour`} value={v.colour} onChange={(e) => updateVariant(index,'colour',e.target.value)}>{colours.map((c) => <option key={c} value={c}>{c || 'No colour'}</option>)}</select></td>
            <td><select aria-label={`Variant ${index + 1} material`} value={v.material} onChange={(e) => updateVariant(index,'material',e.target.value)}>{materials.map((m) => <option key={m} value={m}>{m || 'No material'}</option>)}</select></td>
            <td><select aria-label={`Variant ${index + 1} size`} value={v.size} onChange={(e) => updateVariant(index,'size',e.target.value)}>{sizes.map((s) => <option key={s} value={s}>{s || 'Not sized'}</option>)}</select></td>
            <td><input aria-label={`Variant ${index + 1} stock`} type="number" min="0" max="1000000" value={v.stock} onChange={(e) => updateVariant(index,'stock',Number(e.target.value))} /></td>
            <td><button className="ad-btn" onClick={() => update('variants',p.variants.filter((_,i) => i !== index))}>Remove</button></td>
          </tr>)}</tbody></table></div>
          <div className="ad-filters"><button className="ad-btn" onClick={() => update('variants',[...p.variants,{ colour:colours[0],material:materials[0],size:sizes[0],stock:0 }])}>Add variant</button>
            <button className="ad-btn" onClick={() => {
              const variants = colours.flatMap((colour) => materials.flatMap((material) => sizes.map((size) => p.variants.find((v) => v.colour === colour && v.material === material && v.size === size) || { colour,material,size,stock:0 })));
              if (variants.length > 1000) { setError('This combination creates more than 1000 variants. Add only stocked combinations manually.'); return; }
              update('variants',variants);
            }}>Generate missing combinations</button></div>
          <p className="ad-muted">New combinations start at zero. Orders reduce stock automatically. Cancelling an undispatched order restores it once. If another order changes stock while you edit, saving asks you to reload.</p>
        </>}
      </>}

      {tab === 'pricing' && <>
        <h2>Pricing model</h2>
        <label className="ad-field">Charge by<select value={p.pricing ? 'garment' : p.sheetPrice ? 'sheet' : p.fixedPrice != null ? 'fixed' : 'quote'} onChange={(e) => {
          const model = e.target.value;
          setP({ ...p, pricing:model === 'garment' ? { base:230,methods:{ dtf:{label:'DTF',normalPerSqIn:1,fullPerSqIn:1.5} } } : null,
            sheetPrice:model === 'sheet' ? { per:'sqin',rate:1.5 } : null, fixedPrice:model === 'fixed' ? 100 : null,
            sheets:model === 'sheet' && !p.sheets?.length ? [{id:'a4',label:'A4',w:210,h:297},{id:'a3',label:'A3',w:297,h:420}] : p.sheets });
        }}><option value="quote">Quote after review</option><option value="fixed">Fixed price per piece</option>{p.category === 'T-Shirts' && <option value="garment">Blank garment + print area</option>}<option value="sheet">Printing sheet</option></select></label>
        {p.fixedPrice != null && field('fixedPrice','Price per piece (₹)',{type:'number',min:0,step:'0.01'})}
        {p.pricing && <>
          <label className="ad-check"><input type="checkbox" checked={!!p.pricing.baseByMaterial} disabled={!p.fabric?.options?.length} onChange={(e) => update('pricing',e.target.checked ? { methods:p.pricing.methods,baseByMaterial:Object.fromEntries(p.fabric.options.map((m) => [m,p.pricing.base || 0])) } : { methods:p.pricing.methods,base:Math.min(...Object.values(p.pricing.baseByMaterial)) })} />Different blank price for each material</label>
          <div className="ad-fields">{p.pricing.baseByMaterial ? materials.map((m) => <label className="ad-field" key={m}>{m} blank price (₹)<input type="number" min="0" value={p.pricing.baseByMaterial[m] ?? ''} onChange={(e) => update('pricing',{ ...p.pricing,baseByMaterial:{ ...p.pricing.baseByMaterial,[m]:Number(e.target.value) } })} /></label>) : <label className="ad-field">Blank price (₹)<input type="number" min="0" value={p.pricing.base} onChange={(e) => update('pricing',{ ...p.pricing,base:Number(e.target.value) })} /></label>}</div>
          {['dtf','sublimation'].map((id) => <div key={id}><label className="ad-check"><input type="checkbox" checked={!!p.pricing.methods[id]} onChange={(e) => { const methods={ ...p.pricing.methods }; if(e.target.checked) methods[id]={label:id,normalPerSqIn:1,fullPerSqIn:1,lightOnly:id==='sublimation'}; else delete methods[id]; update('pricing',{...p.pricing,methods}); }} />{id}</label>
            {p.pricing.methods[id] && <div className="ad-fields">{['normalPerSqIn','fullPerSqIn'].map((key) => <label className="ad-field" key={key}>{key === 'normalPerSqIn' ? 'Normal' : 'Full-body'} rate (₹ / sq in)<input type="number" min="0" step="0.05" value={p.pricing.methods[id][key]} onChange={(e) => update('pricing',{...p.pricing,methods:{...p.pricing.methods,[id]:{...p.pricing.methods[id],[key]:Number(e.target.value)}}})} /></label>)}</div>}
          </div>)}
          <p className="ad-muted">These are this product’s rates. They override global defaults.</p>
        </>}
        {p.sheetPrice && <>
          <label className="ad-field">Sheet charging<select value={p.sheetPrice.per} onChange={(e) => update('sheetPrice',e.target.value === 'sheet' ? {per:'sheet',a4:35} : {per:'sqin',rate:1.5})}><option value="sqin">Artwork square inches</option><option value="sheet">A4 sheet equivalent</option></select></label>
          <label className="ad-field">{p.sheetPrice.per === 'sheet' ? 'A4 price' : 'Price per sq in'} (₹)<input type="number" min="0" step="0.05" value={p.sheetPrice.a4 ?? p.sheetPrice.rate} onChange={(e) => update('sheetPrice',{...p.sheetPrice,[p.sheetPrice.per === 'sheet' ? 'a4' : 'rate']:Number(e.target.value)})} /></label>
          {check('customSheet','Allow custom sheet dimensions (1–60 inches)')}
          <div className="ad-scroll"><table className="ad-table"><thead><tr><th>ID</th><th>Label</th><th>Width mm</th><th>Height mm</th><th /></tr></thead><tbody>{p.sheets.map((sheet,index) => <tr key={index}>{['id','label','w','h'].map((key) => <td key={key}><input aria-label={`Sheet ${index+1} ${key}`} type={['w','h'].includes(key) ? 'number' : 'text'} value={sheet[key]} onChange={(e) => update('sheets',p.sheets.map((s,i) => i === index ? {...s,[key]:['w','h'].includes(key) ? Number(e.target.value) : e.target.value} : s))} /></td>)}<td><button className="ad-btn" onClick={() => update('sheets',p.sheets.filter((_,i) => i !== index))}>Remove</button></td></tr>)}</tbody></table></div>
          <button className="ad-btn" onClick={() => update('sheets',[...p.sheets,{id:'',label:'',w:210,h:297}])}>Add sheet</button>
        </>}
        <h2 className="ad-section-gap">Individual product offer</h2>
        <label className="ad-check"><input type="checkbox" checked={p.discount.enabled} onChange={(e) => discountField('enabled',e.target.checked)} />Enable this product’s discount</label>
        {p.discount.enabled && <div className="ad-fields">
          <label className="ad-field">Type<select value={p.discount.type} onChange={(e) => discountField('type',e.target.value)}><option value="percent">Percentage off</option><option value="flat">Rupees off each piece</option></select></label>
          <label className="ad-field">Discount value<input type="number" min="0" max={p.discount.type === 'percent' ? 100 : 1000000} step="0.01" value={p.discount.value} onChange={(e) => discountField('value',Number(e.target.value))} /></label>
          <label className="ad-field">Starts<input type="datetime-local" value={localTime(p.discount.startsAt)} onChange={(e) => discountField('startsAt',dateValue(e.target.value))} /></label>
          <label className="ad-field">Ends<input type="datetime-local" value={localTime(p.discount.endsAt)} onChange={(e) => discountField('endsAt',dateValue(e.target.value))} /></label>
          <label className="ad-check"><input type="checkbox" checked={p.discount.stackable !== false} onChange={(e) => discountField('stackable',e.target.checked)} />Allow checkout coupons on top</label>
        </div>}
        <p className="ad-muted">Discounts apply to the calculated price per piece, including printing. Quotes have no automatic discount until a price is set.</p>
      </>}

      {tab === 'mockups' && <>
        <h2>Editable product mockups</h2>
        <p className="ad-muted">Upload blank product images. For tinted garments, use white transparent PNGs. Colour-specific images are shown as uploaded. Print areas are percentages of the full image.</p>
        <div className="ad-fields">
          {p.category === 'T-Shirts' && <label className="ad-field">Garment shape<select value={p.garment || 'tee'} onChange={(e) => update('garment',e.target.value)}><option value="tee">T-shirt</option><option value="polo">Polo</option></select></label>}
          <label className="ad-field">Image set<select value={photoColour} onChange={(e) => setPhotoColour(e.target.value)}><option value="">Default for all colours</option>{p.colors.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}</select></label>
          <label className="ad-field">View<select value={side} onChange={(e) => setSide(e.target.value)}>{(p.category === 'T-Shirts' ? ['front','back','left','right'] : ['front']).map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
        </div>
        <label className="ad-check"><input type="checkbox" checked={mockups.tint !== false} onChange={(e) => update('mockups',{...mockups,tint:e.target.checked})} />Tint default garment images to the selected colour</label>
        {p.category === 'T-Shirts' && <label className="ad-field">Full image width scale (inches, used for print-area estimates)<input type="number" min="1" max="120" step="0.1" value={mockups.photoWidthIn ?? 24} onChange={(e) => update('mockups',{...mockups,photoWidthIn:Number(e.target.value)})} /></label>}
        <div className="ad-mockup-editor">
          <div className="ad-print-preview">{photo ? <img src={assetUrl(photo)} alt={`${side} mockup preview`} /> : <p>Upload a {side} image</p>}<div className="ad-print-boundary" style={{left:`${area.left}%`,top:`${area.top}%`,width:`${area.width}%`,height:`${area.height}%`}}>Print area</div></div>
          <div><ImageUpload key={`${photoColour}-${side}`} label={`${photoColour || 'Default'} · ${side}`} value={currentPhotos[side]} onChange={setPhoto} onBusy={(delta) => setUploads((n) => n+delta)} />
            <div className="ad-fields">{['left','top','width','height'].map((key) => <label className="ad-field" key={key}>{key} (%)<input type="number" min="0" max="100" step="0.5" value={area[key]} onChange={(e) => update('mockups',{...mockups,areas:{...mockups.areas,[side]:{...area,[key]:Number(e.target.value)}}})} /></label>)}</div>
          </div>
        </div>
        <p className="ad-muted">Catalogue templates remain in storage. Customer-uploaded art and generated order mockups are still deleted after courier-confirmed dispatch.</p>
      </>}
    </fieldset>
    <div className="ad-product-save" role="status">
      <span>{p.status === 'active' ? 'Changes become visible after saving.' : p.status === 'scheduled' ? 'The product becomes visible on its launch date.' : 'This product stays hidden from shoppers.'}</span>
      <button className="ad-btn primary" disabled={busy || uploads > 0 || !p.slug || !p.name} onClick={save}>{busy ? 'Saving…' : uploads > 0 ? 'Uploading images…' : p.status === 'active' ? 'Save & publish' : 'Save product'}</button>
      {error && <p className="ad-error" role="alert">{error}</p>}
    </div>
  </>;
}

export default function CustomProducts() {
  const { data, error, loading, reload } = useLoad('/api/admin/custom-products');
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [message, setMessage] = useState('');
  const products = data?.groups.flatMap((g) => g.items) || [];
  const newFrom = (p) => setEditing({ isNew:true, revision:data.revision, product:{ ...clone(p), slug:'', name:`${p.name} new`, sku:'', status:'draft', discount:{enabled:false,type:'percent',value:0}, variants:[],stockTracked:false,launchAt:null,newUntil:null } });
  if (editing) return <ProductEditor key={editing.product.slug || 'new'} initial={editing.product} groups={data.groups} revision={editing.revision} isNew={editing.isNew} hiddenGroups={data.hiddenGroups} onCancel={() => { if (window.confirm('Leave the editor? Unsaved changes will be discarded.')) setEditing(null); }} onSaved={(p) => { setEditing(null);setMessage(`${p.name} saved.`);reload(); }} />;
  const filtered = products.filter((p) => (status === 'all' || (p.status || 'active') === status) && (!query || `${p.name} ${p.sku || ''} ${p.category}`.toLowerCase().includes(query.toLowerCase())));
  return <>
    <PageHead title="Custom products"><button className="ad-btn primary" disabled={!products.length || loading} onClick={() => newFrom(products[0])}><Plus size={15} /> New product</button></PageHead>
    <p className="ad-muted">Manage colours, stock, product offers, launches and the blank images used in the design studio. Duplicate a similar product to start with the right print setup.</p>
    {message && <p className="ad-note" role="status">{message}</p>}
    <div className="ad-filters"><label className="ad-search"><Search size={15} /><input aria-label="Search custom products" placeholder="Search product, SKU or category" value={query} onChange={(e) => setQuery(e.target.value)} /></label><select aria-label="Product visibility" value={status} onChange={(e) => setStatus(e.target.value)}>{['all','active','draft','scheduled','archived'].map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>)}</select><button className="ad-btn" onClick={reload}>Refresh stock</button></div>
    {error ? <Loading error={error} /> : !data ? <Loading loading={loading} /> : <section className="ad-card flush"><div className="ad-scroll"><table className="ad-table"><thead><tr><th>Product</th><th>Status</th><th>Availability</th><th>Price / offer</th><th /></tr></thead><tbody>
      {filtered.map((p) => {
        const stock = p.variants.reduce((sum,v) => sum+v.stock,0);
        return <tr key={p.slug}><td><b>{p.name}</b><small>{p.sku || p.slug} · {p.category}</small></td><td>{p.status || 'active'}{p.status === 'scheduled' && <small>{p.launchAt ? new Date(p.launchAt).toLocaleString() : 'Date required'}</small>}</td><td>{p.available === false ? 'Orders paused' : p.stockTracked ? `${stock} units` : 'Stock not tracked'}{p.stockTracked && p.variants.some((v) => v.stock <= (p.lowStock ?? 5)) && <small className="ad-warn">Low / zero-stock variants</small>}<small>{p.colors.filter((c) => c.available !== false).length} colours available</small></td><td>{p.fixedPrice != null ? rupees(p.fixedPrice) : p.pricing ? 'Blank + print' : p.sheetPrice ? 'Sheet pricing' : 'Quote after review'}{p.discount?.enabled && <small>{p.discount.type === 'percent' ? `${p.discount.value}% off` : `${rupees(p.discount.value)} off`}</small>}</td><td><div className="ad-rowtools"><button className="ad-btn" onClick={() => setEditing({isNew:false,product:p,revision:data.revision})}>Manage</button><button className="ad-btn" aria-label={`Duplicate ${p.name}`} onClick={() => newFrom(p)}><Copy size={14} /></button></div></td></tr>;
      })}
    </tbody></table>{!filtered.length && <p className="ad-muted pad">No products match this search.</p>}</div></section>}
  </>;
}
