import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { locationsApi } from '../api/locations.js';
import { PrinterPicker } from './PrinterPicker.js';
import type { TaskItem } from '../types.js';

export type ReceiveValues = { qty: number; lotNo: string; locationId: number; locationName: string; printerName: string };

export function ReceiveItemForm({ item, onReceive, submitting }: { item: TaskItem; onReceive: (v: ReceiveValues) => void; submitting: boolean }) {
  const [lotNo, setLotNo] = useState('');
  const [qty, setQty] = useState(String(item.qty_expected));
  const [locationId, setLocationId] = useState<string>('');
  const [printerName, setPrinterName] = useState(localStorage.getItem('epr.printer') ?? '');

  const locations = useQuery({ queryKey: ['locations', item.ar_invt_id], queryFn: () => locationsApi.forItem(item.ar_invt_id) });

  useEffect(() => { if (printerName) localStorage.setItem('epr.printer', printerName); }, [printerName]);

  const qtyNum = Number(qty);
  const locIdNum = Number(locationId);
  const valid = lotNo.length > 0 && qtyNum > 0 && qtyNum <= item.qty_expected && locIdNum > 0 && printerName.length > 0;

  function submit() {
    const loc = locations.data?.locations.find(l => l.id === locIdNum);
    onReceive({ qty: qtyNum, lotNo, locationId: locIdNum, locationName: loc?.code ?? '', printerName });
  }

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="card__header">
        <div className="card__title">
          <span aria-hidden>📦</span>
          <span className="mono">{item.item_no}</span>
          {item.item_rev && <span className="badge">Rev {item.item_rev}</span>}
          {item.item_class && <span className="badge badge--brand">{item.item_class}</span>}
        </div>
        <span className="badge badge--warning">Pending</span>
      </div>

      <div className="card__meta" style={{ marginBottom: '1rem' }}>
        <div>{item.item_description}</div>
        <div style={{ marginTop: '0.35rem' }}>
          <span className="mono dim">{item.po_no}</span>
          <span className="dim"> · Promise {item.promise_date}</span>
          <span className="dim"> · Expected </span>
          <strong style={{ color: 'var(--text)' }}>{item.qty_expected}</strong>
          {item.default_recv_designator && (
            <>
              <span className="dim"> · Default location </span>
              <span className="mono">{item.default_recv_designator}</span>
            </>
          )}
        </div>
      </div>

      <div className="grid-form">
        <div className="form__field">
          <label className="form__label" htmlFor={`lot-${item.id}`}>Lot No</label>
          <input id={`lot-${item.id}`} value={lotNo} onChange={e => setLotNo(e.target.value)} aria-label="lot no" placeholder="LOT-..." />
        </div>
        <div className="form__field">
          <label className="form__label" htmlFor={`qty-${item.id}`}>
            Qty Received <span className="dim">(max {item.qty_expected})</span>
          </label>
          <input id={`qty-${item.id}`} type="number" min={1} max={item.qty_expected}
            value={qty} onChange={e => setQty(e.target.value)} aria-label="qty received" />
        </div>
        <div className="form__field">
          <label className="form__label" htmlFor={`loc-${item.id}`}>Location</label>
          <select id={`loc-${item.id}`} aria-label="location" value={locationId}
            onChange={e => setLocationId(e.target.value)} disabled={locations.isLoading}>
            <option value="">— pick location —</option>
            {locations.data?.locations.map(l => (
              <option key={l.id} value={l.id}>{l.code} — {l.description}</option>
            ))}
          </select>
        </div>
        <div className="form__field">
          <label className="form__label" htmlFor={`printer-${item.id}`}>Printer</label>
          <PrinterPicker value={printerName} onChange={setPrinterName} />
        </div>
      </div>

      <div className="card__actions">
        <button className="btn btn--primary" onClick={submit} disabled={!valid || submitting}>
          {submitting ? <><span className="spinner" /> Receiving…</> : <>✓ Receive</>}
        </button>
      </div>
    </div>
  );
}
