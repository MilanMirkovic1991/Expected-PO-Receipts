import { useState } from 'react';
import type { ReleaseGroup } from '../types.js';
import { usePlanning } from '../store/planning.js';

export function POReleaseTable({ groups }: { groups: ReleaseGroup[] }) {
  const selected = usePlanning(s => s.selected);
  const toggle = usePlanning(s => s.toggle);
  const selectAll = usePlanning(s => s.selectAll);
  const deselectAll = usePlanning(s => s.deselectAll);

  return (
    <div>
      {groups.length === 0 && <p>No expected receipts in date range.</p>}
      {groups.map(g => {
        const ids = g.items.map(i => i.poReleaseId);
        const allSelected = ids.every(id => selected.has(id));
        return (
          <DateGroup key={g.date} date={g.date}
            allSelected={allSelected}
            onMasterToggle={() => allSelected ? deselectAll(ids) : selectAll(ids)}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr><th></th><th>Class</th><th>Item No</th><th>Rev</th><th>Description</th><th>Qty</th><th>Recv Designator</th></tr>
              </thead>
              <tbody>
                {g.items.map(i => (
                  <tr key={i.poReleaseId}>
                    <td>
                      <input type="checkbox"
                        aria-label="select item"
                        checked={selected.has(i.poReleaseId)}
                        onChange={() => toggle(i.poReleaseId)} />
                    </td>
                    <td>{i.itemClass}</td><td>{i.itemNo}</td><td>{i.itemRev}</td>
                    <td>{i.itemDescription}</td><td>{i.qtyExpected}</td>
                    <td>{i.defaultRecvDesignator || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DateGroup>
        );
      })}
    </div>
  );
}

function DateGroup({ date, allSelected, onMasterToggle, children }: { date: string; allSelected: boolean; onMasterToggle: () => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section style={{ border: '1px solid #ddd', borderRadius: 4, marginBottom: 8 }}>
      <header style={{ padding: '0.5rem', background: '#f7f7f7', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input type="checkbox"
          aria-label={`select all for ${date}`}
          checked={allSelected} onChange={onMasterToggle} />
        <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none' }}>{open ? '▾' : '▸'}</button>
        <strong>Promise Date: <span>{date}</span></strong>
      </header>
      {open && <div style={{ padding: '0.5rem' }}>{children}</div>}
    </section>
  );
}
