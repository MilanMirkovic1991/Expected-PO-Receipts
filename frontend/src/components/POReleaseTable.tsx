import { useState } from 'react';
import type { ReleaseGroup } from '../types.js';
import { usePlanning } from '../store/planning.js';

export function POReleaseTable({ groups }: { groups: ReleaseGroup[] }) {
  const selected = usePlanning(s => s.selected);
  const toggle = usePlanning(s => s.toggle);
  const selectAll = usePlanning(s => s.selectAll);
  const deselectAll = usePlanning(s => s.deselectAll);

  if (groups.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">📭</div>
        <div className="empty-state__title">No expected receipts</div>
        <div>Nothing in the selected date range.</div>
      </div>
    );
  }

  return (
    <div>
      {groups.map(g => {
        const ids = g.items.map(i => i.poReleaseId);
        const allSelected = ids.length > 0 && ids.every(id => selected.has(id));
        const selectedCount = ids.filter(id => selected.has(id)).length;
        return (
          <DateGroup
            key={g.date}
            date={g.date}
            allSelected={allSelected}
            selectedCount={selectedCount}
            totalCount={ids.length}
            onMasterToggle={() => allSelected ? deselectAll(ids) : selectAll(ids)}
          >
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Class</th>
                  <th>Item No</th>
                  <th>Rev</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Qty</th>
                  <th>PO</th>
                  <th>Recv Designator</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map(i => {
                  const isSelected = selected.has(i.poReleaseId);
                  return (
                    <tr key={i.poReleaseId} className={isSelected ? 'is-selected' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`select item ${i.itemNo}`}
                          checked={isSelected}
                          onChange={() => toggle(i.poReleaseId)}
                        />
                      </td>
                      <td>{i.itemClass || <span className="dim">—</span>}</td>
                      <td><span className="mono" style={{ fontWeight: 600 }}>{i.itemNo}</span></td>
                      <td>{i.itemRev || <span className="dim">—</span>}</td>
                      <td>{i.itemDescription}</td>
                      <td className="table__qty" style={{ textAlign: 'right' }}>{i.qtyExpected}</td>
                      <td><span className="mono dim">{i.poNo}</span></td>
                      <td>{i.defaultRecvDesignator || <span className="dim">default</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DateGroup>
        );
      })}
    </div>
  );
}

function DateGroup({
  date, allSelected, selectedCount, totalCount, onMasterToggle, children,
}: {
  date: string;
  allSelected: boolean;
  selectedCount: number;
  totalCount: number;
  onMasterToggle: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="date-group">
      <header className="date-group__header">
        <input
          type="checkbox"
          aria-label={`select all for ${date}`}
          checked={allSelected}
          onChange={onMasterToggle}
        />
        <button
          type="button"
          className="btn btn--icon"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          <span className={'date-group__chevron' + (open ? ' is-open' : '')}>▸</span>
        </button>
        <span className="date-group__date">📅 {date}</span>
        <span className="date-group__count">
          {selectedCount > 0
            ? `${selectedCount} of ${totalCount} selected`
            : `${totalCount} item${totalCount !== 1 ? 's' : ''}`}
        </span>
        <span className="spacer" />
        {selectedCount > 0 && <span className="badge badge--brand">{selectedCount}</span>}
      </header>
      {open && <div className="date-group__body">{children}</div>}
    </section>
  );
}
