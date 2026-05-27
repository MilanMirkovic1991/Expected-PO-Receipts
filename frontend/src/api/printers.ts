import { api } from './client.js';

export const printersApi = { list: () => api<{ printers: string[] }>('/api/printers') };
