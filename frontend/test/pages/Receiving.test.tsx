import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Receiving } from '../../src/pages/Receiving.js';

vi.mock('../../src/api/tasks.js', () => ({
  tasksApi: { listMine: vi.fn().mockResolvedValue({ tasks: [
    { id: 12, status: 'open', createdAt: '2026-05-27T08:00:00', createdBy: 'planner', dateFrom: '2026-05-28', dateTo: '2026-06-04' },
  ]}) },
}));

function wrap(children: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>;
}

describe('Receiving page', () => {
  it('renders task cards', async () => {
    render(wrap(<Receiving />));
    expect(await screen.findByText(/Task #12/)).toBeInTheDocument();
  });
});
