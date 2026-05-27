import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '../src/App.js';

vi.mock('../src/api/auth.js', () => ({
  authApi: {
    me: vi.fn(() => new Promise(() => {})), // never resolves → keeps loading state
    login: vi.fn(),
    logout: vi.fn(),
  },
}));

describe('App', () => {
  it('renders loading state on boot', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter><App /></MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });
});
