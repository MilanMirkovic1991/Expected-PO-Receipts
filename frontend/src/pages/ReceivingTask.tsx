import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '../api/tasks.js';
import { ReceiveItemForm, type ReceiveValues } from '../components/ReceiveItemForm.js';

const STATUS_BADGE: Record<string, string> = {
  open: 'badge--info',
  in_progress: 'badge--warning',
  completed: 'badge--success',
  cancelled: 'badge--danger',
};

export function ReceivingTask() {
  const { id } = useParams<{ id: string }>();
  const taskId = Number(id);
  const qc = useQueryClient();
  const [busyItemId, setBusyItemId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ kind: 'success' | 'danger' | 'warning'; message: string } | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => tasksApi.get(taskId),
    enabled: Number.isFinite(taskId),
  });

  const receive = useMutation({
    mutationFn: ({ itemId, values }: { itemId: number; values: ReceiveValues }) => tasksApi.receive(taskId, itemId, values),
    onMutate: ({ itemId }) => setBusyItemId(itemId),
    onSettled: () => {
      setBusyItemId(null);
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks', 'mine'] });
    },
    onSuccess: (r) => {
      if (!r.labelPrinted) {
        setToast({ kind: 'warning', message: `Receipt #${r.dwReceiptId} created, but label print failed: ${r.labelPrintError ?? 'unknown'}` });
      } else {
        setToast({ kind: 'success', message: `Receipt #${r.dwReceiptId} posted and label printed.` });
      }
    },
    onError: (e: any) => setToast({ kind: 'danger', message: `${e?.code ?? 'ERROR'}: ${e?.message ?? 'unknown'}` }),
  });

  if (isLoading) {
    return <div className="app"><div className="loading-state"><span className="spinner" /> Loading task…</div></div>;
  }
  if (isError || !data) {
    return (
      <div className="app">
        <div className="alert alert--danger" role="alert">
          <span className="alert__icon">⚠</span>
          <span>Failed to load task.</span>
        </div>
        <Link to="/receiving" className="btn btn--sm">← Back to tasks</Link>
      </div>
    );
  }

  const { task, items } = data;
  const pendingCount = items.filter(i => i.status !== 'received').length;
  const receivedCount = items.filter(i => i.status === 'received').length;

  return (
    <div className="app">
      <div className="row" style={{ marginBottom: '0.5rem' }}>
        <Link to="/receiving" className="btn btn--ghost btn--sm">← Back</Link>
        <span className="spacer" />
      </div>

      <div className="panel panel--brand" style={{ marginBottom: '1.5rem' }}>
        <div className="row" style={{ marginBottom: '0.25rem' }}>
          <h2 style={{ margin: 0 }}>Task #{task.id}</h2>
          <span className={'badge ' + (STATUS_BADGE[task.status] ?? '')}>{task.status.replace('_', ' ')}</span>
          <span className="spacer" />
          <span className="muted">
            <strong style={{ color: 'var(--success-700)' }}>{receivedCount}</strong> received ·{' '}
            <strong style={{ color: 'var(--warning-700)' }}>{pendingCount}</strong> pending
          </span>
        </div>
        <div className="muted">
          <strong>From:</strong> {task.createdBy} · <strong>Period:</strong> {task.dateFrom} → {task.dateTo}
        </div>
      </div>

      {toast && (
        <div className={'alert alert--' + toast.kind} role="status">
          <span className="alert__icon">{toast.kind === 'success' ? '✓' : '⚠'}</span>
          <span>{toast.message}</span>
          <span className="spacer" />
          <button className="btn btn--ghost btn--sm" onClick={() => setToast(null)}>Dismiss</button>
        </div>
      )}

      <div className="stack">
        {items.map(item => (
          item.status === 'received' ? (
            <div key={item.id} className="received-row">
              <span className="received-row__icon">✓</span>
              <div style={{ flex: 1 }}>
                <div className="received-row__title">
                  <span className="mono">{item.item_no}</span> · {item.received_qty} pcs
                  {item.label_printed === 0 && (
                    <span className="badge badge--warning" style={{ marginLeft: 8 }}>label print failed</span>
                  )}
                </div>
                <div className="received-row__meta">
                  Lot <span className="mono">{item.received_lot_no}</span> ·
                  Location <span className="mono">{item.received_location_name}</span> ·
                  DW Receipt <span className="mono">#{item.dw_receipt_id}</span>
                </div>
              </div>
            </div>
          ) : (
            <ReceiveItemForm
              key={item.id}
              item={item}
              submitting={busyItemId === item.id}
              onReceive={(values) => receive.mutate({ itemId: item.id, values })}
            />
          )
        ))}
      </div>
    </div>
  );
}
