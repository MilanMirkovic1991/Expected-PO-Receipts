import { api } from './client.js';
import type { LocationRow } from '../types.js';

export const locationsApi = {
  forItem: (arInvtId: number) => api<{ locations: LocationRow[] }>(`/api/locations?arInvtId=${arInvtId}`),
};
