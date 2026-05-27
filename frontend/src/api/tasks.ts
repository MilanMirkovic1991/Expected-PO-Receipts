import { api } from './client.js';
import type { TaskSummary, TaskDetail } from '../types.js';

export type CreateTaskInput = {
  assignedToEmployeeId: number;
  dateFrom: string;
  dateTo: string;
  items: Array<{
    poId: number; poNo: string; poDetailId: number; poReleaseId: number;
    promiseDate: string; arInvtId: number;
    itemClass: string; itemNo: string; itemRev: string; itemDescription: string;
    qtyExpected: number; defaultRecvDesignator: string;
    vendorId?: number; vendorNo?: string; vendorName?: string;
  }>;
};

export type ReceiveInput = { qty: number; lotNo: string; locationId: number; locationName: string; printerName: string };

export const tasksApi = {
  create: (input: CreateTaskInput) =>
    api<{ taskId: number; itemCount: number }>('/api/tasks', { method: 'POST', body: JSON.stringify(input) }),
  listMine: () => api<{ tasks: TaskSummary[] }>('/api/tasks'),
  get: (id: number) => api<TaskDetail>(`/api/tasks/${id}`),
  receive: (taskId: number, itemId: number, input: ReceiveInput) =>
    api<{ itemStatus: 'received'; dwReceiptId: number; taskStatus: string; labelPrinted: boolean; labelPrintError?: string }>(
      `/api/tasks/${taskId}/items/${itemId}/receive`, { method: 'POST', body: JSON.stringify(input) }),
  cancel: (id: number) => api<{ ok: true }>(`/api/tasks/${id}/cancel`, { method: 'POST' }),
};
