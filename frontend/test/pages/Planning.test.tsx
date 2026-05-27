import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Planning } from '../../src/pages/Planning.js';
import { usePlanning } from '../../src/store/planning.js';

vi.mock('../../src/api/poReleases.js', () => ({
  poReleasesApi: { list: vi.fn().mockResolvedValue({ groups: [{ date: '2026-05-28', items: [
    { poReleaseId: 100, poDetailId: 10, poId: 1, poNo: 'PO-1', arInvtId: 500, itemClass: 'A', itemNo: 'ITM-1', itemRev: 'R1', itemDescription: 'D', qtyExpected: 100, promiseDate: '2026-05-28', defaultRecvDesignator: '' },
  ] }] }) },
}));
vi.mock('../../src/api/employees.js', () => ({
  employeesApi: { list: vi.fn().mockResolvedValue({ employees: [{ id: 42, username: 'worker', displayName: 'Worker', email: 'w@x', badge: '002' }] }) },
}));
vi.mock('../../src/api/tasks.js', () => ({
  tasksApi: { create: vi.fn().mockResolvedValue({ taskId: 1, itemCount: 1 }) },
}));

function wrap(children: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>;
}

beforeEach(() => usePlanning.getState().reset());

describe('Planning page', () => {
  it('disables Generate until items and assignee chosen', async () => {
    render(wrap(<Planning />));
    const generate = await screen.findByRole('button', { name: /generate expected po/i });
    expect(generate).toBeDisabled();
  });
});
