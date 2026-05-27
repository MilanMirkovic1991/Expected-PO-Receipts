import { api } from './client.js';
import type { SessionMe } from '../types.js';

export const authApi = {
  login: (input: { baseUrl: string; username: string; password: string; database: string; eplantId: number }) =>
    api<{ username: string; eplantId: number; email: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  logout: () => api<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  me: () => api<SessionMe>('/api/auth/me'),
};
