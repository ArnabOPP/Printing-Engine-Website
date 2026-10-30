import { useEffect, useRef, useState } from 'react';
import { Ruler, X } from 'lucide-react';
import { chartColumns, sizeCharts } from '../sizeChart.js';

const fmt = (inches, unit) => {
  const v = unit === 'cm' ? inches * 2.54 : inches;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};

// A pop-up with the "how to measure" picture and the measurement table for each group.
// `groups` is a list of { id, label }; `picked` is the list of sizes the customer has already chosen.
export default function SizeChart({ open, onClose, groups, initial, picked = [] }) {
  const ref = useRef(null);
  const [group, setGroup] = useState(initial);
  const [unit, setUnit] = useState('in');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setGroup(initial && groups.some((g) => g.id === initial) ? initial : groups[0]?.id);
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open, initial, groups]);

  const rows = Object.entries(sizeCharts[group] || {});

  return (
    <dialog
      ref={ref}
      className="sc"
      aria-labelledby="sc-title"
      onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="sc-in">
        <div className="sc-head">
          <h2 id="sc-title"><Ruler size={20} /> Size chart</h2>
          <button type="button" className="sc-x" onClick={onClose} aria-label="Close size chart"><X size={20} /></button>
        </div>

        <div className="sc-tools">
          {groups.length > 1 && (
            <div className="opt-views sc-groups" role="tablist" aria-label="Size chart for">
              {groups.map((g) => (
                <button key={g.id} role="tab" aria-selected={group === g.id} className={group === g.id ? 'on' : ''} onClick={() => setGroup(g.id)}>{g.label}</button>
              ))}
            </div>
          )}
          <div className="opt-views sc-unit" role="tablist" aria-label="Units">
            {['in', 'cm'].map((u) => (
              <button key={u} role="tab" aria-selected={unit === u} className={unit === u ? 'on' : ''} onClick={() => setUnit(u)}>{u === 'in' ? 'Inches' : 'cm'}</button>
            ))}
          </div>
        </div>

        <div className="sc-table-wrap">
          <table className="sc-table">
            <thead>
              <tr>
                <th scope="col">Size</th>
                {chartColumns.map((c) => (
                  <th scope="col" key={c.key}><b>{c.key}</b> {c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([size, values]) => (
                <tr key={size} className={picked.includes(size) ? 'picked' : ''}>
                  <th scope="row">{size}</th>
                  {values.map((v, i) => <td key={chartColumns[i].key}>{fmt(v, unit)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="sc-note">
          Measurements are of the shirt lying flat, in {unit === 'in' ? 'inches' : 'centimetres'}, and can vary by about 1 inch (2.5 cm).
          If you are between two sizes, choose the larger one.
        </p>

        <h3 className="sc-sub">How to measure</h3>
        <img className="sc-guide" src="/size-guide.png" alt="Diagram showing where to measure a shirt: A chest, B shoulders, C sleeve length, D front length, E back length" loading="lazy" />
      </div>
    </dialog>
  );
}
