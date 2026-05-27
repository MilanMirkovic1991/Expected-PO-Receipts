import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Login } from '../../src/pages/Login.js';

afterEach(cleanup);

vi.mock('../../src/api/auth.js', () => ({
  authApi: {
    login: vi.fn().mockResolvedValue({ username: 'planner', eplantId: 1, email: 'p@x' }),
    me: vi.fn(),
  },
}));

describe('Login', () => {
  it('renders form fields', () => {
    render(<MemoryRouter><Login /></MemoryRouter>);
    expect(screen.getByLabelText(/base url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/database/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/eplant/i)).toBeInTheDocument();
  });

  it('submits credentials', async () => {
    const { authApi } = await import('../../src/api/auth.js');
    render(<MemoryRouter><Login /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/base url/i), { target: { value: 'http://dw' } });
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'planner' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'p' } });
    fireEvent.change(screen.getByLabelText(/database/i), { target: { value: 'DB' } });
    fireEvent.change(screen.getByLabelText(/eplant/i), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(authApi.login).toHaveBeenCalled());
  });
});
