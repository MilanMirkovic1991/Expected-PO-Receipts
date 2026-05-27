import { AxiosInstance } from 'axios';
import { unwrap } from './shared.js';

export type LocationRow = { id: number; code: string; description: string; isReceive: boolean };

export function makeLocationsApi(http: AxiosInstance) {
  return {
    async listForItem(arInvtId: number): Promise<LocationRow[]> {
      try {
        const res = await http.get(`/Manufacturing/Inventory/Locations/0`, { params: { arinvtId: arInvtId } });
        const rows = (unwrap<any[]>(res) ?? []) as any[];
        return rows.map(r => ({
          id: Number(r.Id ?? r.LocationId ?? 0),
          code: String(r.LocCode ?? r.Code ?? ''),
          description: String(r.Description ?? r.LocDescription ?? ''),
          isReceive: Boolean(r.ReceiveDesignator),
        }));
      } catch { return []; }
    },
  };
}
