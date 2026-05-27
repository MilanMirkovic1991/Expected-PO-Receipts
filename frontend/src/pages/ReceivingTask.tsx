import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '../api/tasks.js';
import { ReceiveItemForm, type ReceiveValues } from '../components/ReceiveItemForm.js';

export function ReceivingTask() {
  const { id } = useParams<{ id: string }>();
  const taskId = Number(id);
  const qc = useQueryClient();
  const [busyItemId, setBusyItemId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({ queryKey: ['task', taskId], queryFn: () => tasksApi.get(taskId), enabled: Number.isFinite(taskId) });

  const receive = useMutation({
    mutationFn: ({ itemId, values }: { itemId: number; values: ReceiveValues }) => tasksApi.receive(taskId, itemId, values),
    onMutate: ({ itemId }) => setBusyItemId(itemId),
    onSettled: () => { setBusyItemId(null); qc.invalidateQueries({ queryKey: ['task', taskId] }); qc.invalidateQueries({ queryKey: ['tasks', 'mine'] }); },
    onSuccess: (r) => { if (!r.labelPrinted) setError(`Receipt OK (#${r.dwReceiptId}) but label print failed: ${r.labelPrintError ?? 'unknown'}`); else setError(null); },
    onError: (e: any) => setError(`${e?.code ?? 'ERROR'}: ${e?.message ?? 'unknown'}`),
  });

  if (isLoading) return <div className="app"><p>Loading…</p></div>;
  if (isError || !data) return <div className="app"><p style={{ color: 'crimson' }}>Failed to load task.</p></div>;

  const { task, items } = data;
  return (
    <div className="app">
      <h2>Task #{task.id} <small style={{ fontSize: 14, color: '#666' }}>· {task.status}</small></h2>
      <p>From: {task.createdBy} · Period: {task.dateFrom} → {task.dateTo}</p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {items.map(item => (
        <div key={item.id} style={{ border: '1px solid #ddd', borderRadius: 4, marginBottom: 8 }}>
          {item.status === 'received' ? (
            <div style={{ padding: '0.75rem', background: '#e9f7e9' }}>
              ✓ Received {item.received_qty} of <strong>{item.item_no}</strong> · Lot {item.received_lot_no} · Location {item.received_location_name}
              · DW Receipt #{item.dw_receipt_id} {item.label_printed === 0 && <span style={{ color: 'darkorange' }}>(label print failed)</span>}
            </div>
          ) : (
            <ReceiveItemForm item={item} submitting={busyItemId === item.id}
              onReceive={(values) => receive.mutate({ itemId: item.id, values })} />
          )}
        </div>
      ))}
    </div>
  );
}
