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
  const [toast, setToast] = useState<string | null>(null);

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
    onSuccess: (data) => { setToast(`Task #${data.taskId} created (${data.itemCount} items)`); reset(); qc.invalidateQueries({ queryKey: ['poReleases'] }); },
    onError: (e: any) => setToast(`Error: ${e?.message ?? 'unknown'}`),
  });

  return (
    <div className="app">
      <h2>Planning</h2>
      <DateRangePicker />
      <p>
        <button onClick={() => releases.refetch()}>Refresh</button>
      </p>
      {releases.isLoading && <p>Loading…</p>}
      {releases.isError && <p style={{ color: 'crimson' }}>Failed to load PO releases.</p>}
      {releases.data && <POReleaseTable groups={releases.data.groups} />}

      <section style={{ marginTop: '1rem', padding: '1rem', background: '#f7f7f7', borderRadius: 4 }}>
        <label>Assign to:{' '}
          <select value={assignedUsername} onChange={e => setAssignedUsername(e.target.value)}>
            <option value="">— pick a worker —</option>
            {employees.data?.employees.map(e => (
              <option key={e.id} value={e.username}>{e.displayName} ({e.username})</option>
            ))}
          </select>
        </label>
        <p>Selected: {selected.size} item(s)</p>
        <button
          disabled={selected.size === 0 || !assignedUsername || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? 'Creating…' : 'Generate Expected POs'}
        </button>
        {toast && <p>{toast}</p>}
      </section>
    </div>
  );
}
