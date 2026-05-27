import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DateRangePicker } from '../components/DateRangePicker.js';
import { POReleaseTable } from '../components/POReleaseTable.js';
import { poReleasesApi } from '../api/poReleases.js';
import { employeesApi } from '../api/employees.js';
import { tasksApi } from '../api/tasks.js';
import { usePlanning } from '../store/planning.js';

export function Planning() {
  const qc = useQueryClient();
  const dateFrom = usePlanning(s => s.dateFrom);
  const dateTo = usePlanning(s => s.dateTo);
  const selected = usePlanning(s => s.selected);
  const assignedUsername = usePlanning(s => s.assignedUsername);
  const setAssignedUsername = usePlanning(s => s.setAssignedUsername);
  const reset = usePlanning(s => s.reset);
  const [toast, setToast] = useState<{ kind: 'success' | 'danger'; message: string } | null>(null);

  const releases = useQuery({
    queryKey: ['poReleases', dateFrom, dateTo],
    queryFn: () => poReleasesApi.list(dateFrom, dateTo),
    staleTime: 30_000,
  });

  const employees = useQuery({ queryKey: ['employees'], queryFn: employeesApi.list, staleTime: 5 * 60_000 });

  const create = useMutation({
    mutationFn: () => {
      const flat = releases.data?.groups.flatMap(g => g.items.filter(i => selected.has(i.poReleaseId))) ?? [];
      return tasksApi.create({
        assignedToUsername: assignedUsername, dateFrom, dateTo,
        items: flat.map(i => ({
          poId: i.poId, poNo: i.poNo, poDetailId: i.poDetailId, poReleaseId: i.poReleaseId,
          promiseDate: i.promiseDate, arInvtId: i.arInvtId,
          itemClass: i.itemClass, itemNo: i.itemNo, itemRev: i.itemRev, itemDescription: i.itemDescription,
          qtyExpected: i.qtyExpected, defaultRecvDesignator: i.defaultRecvDesignator,
        })),
      });
    },
    onSuccess: (data) => {
      setToast({ kind: 'success', message: `Task #${data.taskId} created with ${data.itemCount} item${data.itemCount !== 1 ? 's' : ''}.` });
      reset();
      qc.invalidateQueries({ queryKey: ['poReleases'] });
    },
    onError: (e: any) => setToast({ kind: 'danger', message: `Error: ${e?.message ?? 'unknown'}` }),
  });

  const totalItems = releases.data?.groups.reduce((sum, g) => sum + g.items.length, 0) ?? 0;

  return (
    <div className="app">
      <div className="row" style={{ alignItems: 'baseline', marginBottom: '1.25rem' }}>
        <h2 style={{ margin: 0 }}>Planning</h2>
        <span className="muted">Select expected receipts and assign them to a warehouse worker.</span>
      </div>

      {toast && (
        <div className={'alert alert--' + toast.kind} role="status">
          <span className="alert__icon">{toast.kind === 'success' ? '✓' : '⚠'}</span>
          <span>{toast.message}</span>
          <span className="spacer" />
          <button className="btn btn--ghost btn--sm" onClick={() => setToast(null)}>Dismiss</button>
        </div>
      )}

      <div className="toolbar">
        <DateRangePicker />
        <button className="btn" onClick={() => releases.refetch()} disabled={releases.isFetching}>
          {releases.isFetching ? <><span className="spinner" /> Refreshing…</> : <>🔄 Refresh</>}
        </button>
        {totalItems > 0 && (
          <span className="muted" style={{ marginLeft: 'auto' }}>
            {totalItems} item{totalItems !== 1 ? 's' : ''} across {releases.data?.groups.length} day{(releases.data?.groups.length ?? 0) !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {releases.isLoading && (
        <div className="loading-state"><span className="spinner" /> Loading PO releases…</div>
      )}
      {releases.isError && (
        <div className="alert alert--danger" role="alert">
          <span className="alert__icon">⚠</span>
          <span>Failed to load PO releases. Try Refresh.</span>
        </div>
      )}
      {releases.data && <POReleaseTable groups={releases.data.groups} />}

      <div className="action-bar">
        <div className="action-bar__info">
          {selected.size === 0
            ? <>Select one or more items to generate a task.</>
            : <><strong>{selected.size}</strong> item{selected.size !== 1 ? 's' : ''} selected</>}
        </div>
        <select value={assignedUsername} onChange={e => setAssignedUsername(e.target.value)} style={{ width: 240 }}>
          <option value="">👤 Assign to…</option>
          {employees.data?.employees.map(e => (
            <option key={e.id} value={e.username}>{e.displayName} ({e.username})</option>
          ))}
        </select>
        <button
          className="btn btn--primary"
          disabled={selected.size === 0 || !assignedUsername || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? <><span className="spinner" /> Creating…</> : <>📨 Generate Expected POs</>}
        </button>
      </div>
    </div>
  );
}
