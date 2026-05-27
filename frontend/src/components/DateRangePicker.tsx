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
    <fieldset className="fieldset" style={{ minWidth: 360 }}>
      <legend>📅 Date filter</legend>
      <div className="row" style={{ marginBottom: '0.75rem' }}>
        <label className="radio-row">
          <input type="radio" name="mode" checked={mode === 'range'} onChange={() => setMode('range')} aria-label="Date range" />
          Date range
        </label>
        <label className="radio-row">
          <input type="radio" name="mode" checked={mode === 'nextDays'} onChange={() => setMode('nextDays')} aria-label="Next days" />
          Next N days
        </label>
      </div>
      <div className="grid-form">
        <div className="form__field">
          <label className="form__label" htmlFor="dr-from">From</label>
          <input id="dr-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        {mode === 'range' ? (
          <div className="form__field">
            <label className="form__label" htmlFor="dr-to">To</label>
            <input id="dr-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        ) : (
          <div className="form__field">
            <label className="form__label" htmlFor="dr-days">Days</label>
            <input id="dr-days" type="number" min={1} max={365} value={nextDays}
              onChange={e => setNextDays(Number(e.target.value))} aria-label="days" />
          </div>
        )}
      </div>
    </fieldset>
  );
}
