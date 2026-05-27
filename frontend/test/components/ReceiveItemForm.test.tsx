import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

afterEach(cleanup);
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReceiveItemForm } from '../../src/components/ReceiveItemForm.js';

vi.mock('../../src/api/locations.js', () => ({
  locationsApi: { forItem: vi.fn().mockResolvedValue({ locations: [{ id: 7, code: 'A1', description: 'Area 1', isReceive: true }] }) },
}));
vi.mock('../../src/api/printers.js', () => ({
  printersApi: { list: vi.fn().mockResolvedValue({ printers: ['P1', 'P2'] }) },
}));

function wrap(children: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const item = { id: 1, task_id: 1, po_no: 'PO-1', po_detail_id: 10, po_release_id: 100, promise_date: '2026-05-28', ar_invt_id: 500, item_class: 'A', item_no: 'ITM-1', item_rev: 'R1', item_description: 'D', qty_expected: 100, default_recv_designator: 'DEFAULT', status: 'pending' as const, received_qty: null, received_lot_no: null, received_location_id: null, received_location_name: null, received_at: null, dw_receipt_id: null, label_printed: 0, label_print_error: null, error_message: null };

describe('ReceiveItemForm', () => {
  it('disables Receive when fields missing', () => {
    const onReceive = vi.fn();
    render(wrap(<ReceiveItemForm item={item} onReceive={onReceive} submitting={false} />));
    expect(screen.getByRole('button', { name: /receive/i })).toBeDisabled();
  });

  it('calls onReceive with form values', async () => {
    const onReceive = vi.fn();
    render(wrap(<ReceiveItemForm item={item} onReceive={onReceive} submitting={false} />));
    fireEvent.change(screen.getByLabelText(/lot no/i), { target: { value: 'LOT-A' } });
    fireEvent.change(screen.getByLabelText(/qty received/i), { target: { value: '100' } });
    await waitFor(() => screen.getByText('A1 — Area 1'));
    fireEvent.change(screen.getByLabelText(/location/i), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText(/printer/i), { target: { value: 'P1' } });
    fireEvent.click(screen.getByRole('button', { name: /receive/i }));
    expect(onReceive).toHaveBeenCalledWith({
      qty: 100, lotNo: 'LOT-A', locationId: 7, locationName: 'A1', printerName: 'P1',
    });
  });
});
