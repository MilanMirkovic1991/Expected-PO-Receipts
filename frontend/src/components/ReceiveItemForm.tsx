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
    <div style={{ padding: '1rem', background: '#fafafa', borderRadius: 4 }}>
      <p><strong>{item.item_no}</strong> Rev {item.item_rev} · Class {item.item_class}</p>
      <p>PO: {item.po_no} · Promise: {item.promise_date}</p>
      <p>Expected: {item.qty_expected}</p>
      <p>Default Receive Designator: {item.default_recv_designator || '-'}</p>

      <label style={{ display: 'block', margin: '0.5rem 0' }}>Lot No:{' '}
        <input value={lotNo} onChange={e => setLotNo(e.target.value)} aria-label="lot no" />
      </label>
      <label style={{ display: 'block', margin: '0.5rem 0' }}>Qty Received (max {item.qty_expected}):{' '}
        <input type="number" min={1} max={item.qty_expected} value={qty} onChange={e => setQty(e.target.value)} aria-label="qty received" />
      </label>
      <label style={{ display: 'block', margin: '0.5rem 0' }}>Location:{' '}
        <select aria-label="location" value={locationId} onChange={e => setLocationId(e.target.value)} disabled={locations.isLoading}>
          <option value="">— pick location —</option>
          {locations.data?.locations.map(l => <option key={l.id} value={l.id}>{l.code} — {l.description}</option>)}
        </select>
      </label>
      <label style={{ display: 'block', margin: '0.5rem 0' }}>Printer:{' '}
        <PrinterPicker value={printerName} onChange={setPrinterName} />
      </label>
      <button onClick={submit} disabled={!valid || submitting}>
        {submitting ? 'Receiving…' : 'Receive'}
      </button>
    </div>
  );
}
