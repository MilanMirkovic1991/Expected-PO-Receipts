import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });
});
