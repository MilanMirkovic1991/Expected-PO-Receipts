import { api } from './client.js';
import type { Employee } from '../types.js';

export const employeesApi = { list: () => api<{ employees: Employee[] }>('/api/employees') };
