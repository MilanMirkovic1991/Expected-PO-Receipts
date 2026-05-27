import { useQuery } from '@tanstack/react-query';
import { printersApi } from '../api/printers.js';

export function PrinterPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['printers'], queryFn: printersApi.list, staleTime: 5 * 60_000 });
  return (
    <select aria-label="printer" value={value} onChange={e => onChange(e.target.value)} disabled={isLoading}>
      <option value="">— pick a printer —</option>
      {data?.printers.map(p => <option key={p} value={p}>{p}</option>)}
    </select>
  );
}
