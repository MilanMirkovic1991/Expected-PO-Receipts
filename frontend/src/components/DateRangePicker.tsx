import { usePlanning } from '../store/planning.js';

export function DateRangePicker() {
  const mode = usePlanning(s => s.mode);
  const dateFrom = usePlanning(s => s.dateFrom);
  const dateTo = usePlanning(s => s.dateTo);
  const nextDays = usePlanning(s => s.nextDays);
  const setMode = usePlanning(s => s.setMode);
  const setDateFrom = usePlanning(s => s.setDateFrom);
  const setDateTo = usePlanning(s => s.setDateTo);
  const setNextDays = usePlanning(s => s.setNextDays);

  return (
    <fieldset style={{ display: 'grid', gap: '0.5rem', maxWidth: 400 }}>
      <legend>Filter</legend>
      <label>
        <input type="radio" name="mode" checked={mode === 'range'} onChange={() => setMode('range')} aria-label="Date range" /> Date range
      </label>
      <label>
        <input type="radio" name="mode" checked={mode === 'nextDays'} onChange={() => setMode('nextDays')} aria-label="Next days" /> Next N days
      </label>

      <label>From <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></label>
      {mode === 'range' ? (
        <label>To <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></label>
      ) : (
        <label>Days <input type="number" min={1} max={365} value={nextDays} onChange={e => setNextDays(Number(e.target.value))} aria-label="days" /></label>
      )}
    </fieldset>
  );
}
