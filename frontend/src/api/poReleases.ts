import { api } from './client.js';
import type { ReleaseGroup } from '../types.js';

export const poReleasesApi = {
  list: (dateFrom: string, dateTo: string) =>
    api<{ groups: ReleaseGroup[] }>(`/api/po-releases?dateFrom=${dateFrom}&dateTo=${dateTo}`),
};
