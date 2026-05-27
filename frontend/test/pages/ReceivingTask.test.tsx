import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReceivingTask } from '../../src/pages/ReceivingTask.js';

const taskData = vi.hoisted(() => ({
  task: { id: 12, status: 'open', createdAt: '', createdBy: 'p', dateFrom: '2026-05-28', dateTo: '2026-06-04', assigned_to_username: 'worker', created_by_username: 'p' } as any,
  items: [
    { id: 1, task_id: 12, po_no: 'PO-1', po_detail_id: 10, po_release_id: 100, promise_date: '2026-05-28', ar_invt_id: 500, item_class: 'A', item_no: 'ITM-1', item_rev: 'R1', item_description: 'D', qty_expected: 100, default_recv_designator: '', status: 'pending', received_qty: null, received_lot_no: null, received_location_id: null, received_location_name: null, received_at: null, dw_receipt_id: null, label_printed: 0, label_print_error: null, error_message: null },
  ],
}));

vi.mock('../../src/api/tasks.js', () => ({
  tasksApi: { get: vi.fn().mockResolvedValue(taskData), receive: vi.fn() },
}));
vi.mock('../../src/api/locations.js', () => ({ locationsApi: { forItem: vi.fn().mockResolvedValue({ locations: [] }) } }));
vi.mock('../../src/api/printers.js', () => ({ printersApi: { list: vi.fn().mockResolvedValue({ printers: [] }) } }));

function wrap(children: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>
    <MemoryRouter initialEntries={['/receiving/12']}>
      <Routes><Route path="/receiving/:id" element={children} /></Routes>
    </MemoryRouter>
  </QueryClientProvider>;
}

describe('ReceivingTask', () => {
  it('renders task header and item row', async () => {
    render(wrap(<ReceivingTask />));
    expect(await screen.findByText(/Task #12/)).toBeInTheDocument();
    expect(await screen.findByText(/ITM-1/)).toBeInTheDocument();
  });
});
