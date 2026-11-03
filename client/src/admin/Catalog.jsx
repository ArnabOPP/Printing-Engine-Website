import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { allGroups, applyCatalog, defaultHiddenGroups } from '../printProducts.js';
import { Loading, PageHead, useLoad } from './ui.jsx';

const byName = (n) => allGroups.flatMap((g) => g.items).find((i) => i.name === n);
const num = (v) => (v === '' || Number.isNaN(Number(v)) ? '' : v);

// The prices and what is shown on the website. "Save" puts them live for every visitor on their next page load.
export default function Catalog() {
  const { data, error, loading } = useLoad('/api/admin/catalog');
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // Start from what the website uses right now (built-in defaults plus anything saved).
  useEffect(() => {
    if (!data) return;
    const saved = data.catalog || {};
    const dtf = byName('Regular T-Shirt').pricing.methods.dtf;
    const sub = byName('Polo T-Shirt').pricing.methods.sublimation;
    const bases = {};
    allGroups.flatMap((g) => g.items).forEach((i) => {
      if (!i.pricing) return;
      bases[i.name] = i.pricing.baseByMaterial ? { ...i.pricing.baseByMaterial } : i.pricing.base;
    });
    setD({
      hiddenGroups: saved.hiddenGroups ?? defaultHiddenGroups,
      hiddenProducts: saved.hiddenProducts ?? [],
      dtf: { normalPerSqIn: dtf.normalPerSqIn, fullPerSqIn: dtf.fullPerSqIn },
      sublimation: { normalPerSqIn: sub.normalPerSqIn, fullPerSqIn: sub.fullPerSqIn },
      sheetPrices: {
        'DTF Printing': { rate: byName('DTF Printing').sheetPrice.rate },
        'UV DTF Printing': { rate: byName('UV DTF Printing').sheetPrice.rate },
        'Sublimation Printing': { a4: byName('Sublimation Printing').sheetPrice.a4 },
      },
      bases,
    });
  }, [data]);

  if (!d) return <><PageHead title="Customise & prices" /><Loading error={error} loading={loading} /></>;

  const toggle = (key, value) => setD((c) => ({ ...c, [key]: c[key].includes(value) ? c[key].filter((x) => x !== value) : [...c[key], value] }));
  const setRate = (group, key) => (e) => setD((c) => ({ ...c, [group]: { ...c[group], [key]: num(e.target.value) } }));
  const setBase = (name, material) => (e) => setD((c) => ({
    ...c, bases: { ...c.bases, [name]: material ? { ...c.bases[name], [material]: num(e.target.value) } : num(e.target.value) },
  }));

  const save = async () => {
    setBusy(true);
    setMsg('');
    try {
      const { catalog } = await api('/api/admin/catalog', { method: 'PUT', body: { catalog: d } });
      applyCatalog(catalog); // so the admin's own view matches
      setMsg('Saved. Visitors see the new prices and products the next time a page opens.');
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!window.confirm('Go back to the built-in prices and products for everyone? Your changes will be lost.')) return;
    try {
      await api('/api/admin/catalog', { method: 'PUT', body: { catalog: {} } });
      window.location.reload();
    } catch (e) {
      setMsg(e.message);
    }
  };

  const rate = (label, group, key) => (
    <label className="ad-field">{label}<span className="ad-money">₹<input type="number" min="0" step="0.05" value={d[group][key]} onChange={setRate(group, key)} /></span></label>
  );

  return (
    <>
      <PageHead title="Customise & prices">
        <button type="button" className="ad-btn" onClick={reset}>Reset to defaults</button>
        <button type="button" className="ad-btn primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </PageHead>
      {msg && <p className="ad-note" role="status">{msg}</p>}

      <section className="ad-card">
        <h2>What the website shows</h2>
        <p className="ad-muted">Untick a category or product to hide it from Print on Demand and the Shop menu. Nothing is deleted.</p>
        {allGroups.map((g) => (
          <div key={g.id} className="ad-group">
            <label className="ad-check strong"><input type="checkbox" checked={!d.hiddenGroups.includes(g.id)} onChange={() => toggle('hiddenGroups', g.id)} /> {g.name}</label>
            <div className="ad-items">
              {g.items.map((it) => (
                <label key={`${it.name}${it.spec || ''}`} className="ad-check">
                  <input type="checkbox" disabled={d.hiddenGroups.includes(g.id)} checked={!d.hiddenProducts.includes(it.name)} onChange={() => toggle('hiddenProducts', it.name)} /> {it.name}{it.spec ? ` (${it.spec})` : ''}
                </label>
              ))}
            </div>
          </div>
        ))}
      </section>

      <div className="ad-grid2">
        <section className="ad-card">
          <h2>T-shirt printing, per square inch</h2>
          <p className="ad-muted">Charged on the size of the artwork. Full body print is the rate for printing across the whole front or back.</p>
          <h4>DTF</h4>
          <div className="ad-fields">{rate('Normal print', 'dtf', 'normalPerSqIn')}{rate('Full body print', 'dtf', 'fullPerSqIn')}</div>
          <h4>Sublimation</h4>
          <div className="ad-fields">{rate('Normal print', 'sublimation', 'normalPerSqIn')}{rate('Full body print', 'sublimation', 'fullPerSqIn')}</div>
        </section>

        <section className="ad-card">
          <h2>Sheet printing services</h2>
          <div className="ad-fields">
            <label className="ad-field">DTF Printing, per sq inch<span className="ad-money">₹<input type="number" min="0" step="0.05" value={d.sheetPrices['DTF Printing'].rate} onChange={(e) => setD((c) => ({ ...c, sheetPrices: { ...c.sheetPrices, 'DTF Printing': { rate: num(e.target.value) } } }))} /></span></label>
            <label className="ad-field">UV DTF Printing, per sq inch<span className="ad-money">₹<input type="number" min="0" step="0.05" value={d.sheetPrices['UV DTF Printing'].rate} onChange={(e) => setD((c) => ({ ...c, sheetPrices: { ...c.sheetPrices, 'UV DTF Printing': { rate: num(e.target.value) } } }))} /></span></label>
            <label className="ad-field">Sublimation, per A4 sheet<span className="ad-money">₹<input type="number" min="0" step="1" value={d.sheetPrices['Sublimation Printing'].a4} onChange={(e) => setD((c) => ({ ...c, sheetPrices: { ...c.sheetPrices, 'Sublimation Printing': { a4: num(e.target.value) } } }))} /></span></label>
          </div>
          <p className="ad-muted">Sublimation A3 and custom sizes are charged in proportion to the sheet’s area.</p>
        </section>
      </div>

      <section className="ad-card">
        <h2>T-shirt prices (blank shirt, before printing)</h2>
        <div className="ad-fields">
          {Object.entries(d.bases).map(([name, v]) => (typeof v === 'number' || v === '' ? (
            <label key={name} className="ad-field">{name}<span className="ad-money">₹<input type="number" min="0" step="1" value={v} onChange={setBase(name)} /></span></label>
          ) : Object.entries(v).map(([m, p]) => (
            <label key={`${name}${m}`} className="ad-field">{name} · {m}<span className="ad-money">₹<input type="number" min="0" step="1" value={p} onChange={setBase(name, m)} /></span></label>
          ))))}
        </div>
      </section>
    </>
  );
}
