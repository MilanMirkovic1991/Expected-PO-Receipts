import { AxiosInstance } from 'axios';
import { unwrap } from './shared.js';

export type InventoryItem = {
  arInvtId: number;
  itemNo: string;
  rev: string;
  description: string;
  itemClass: string;
  uom: string;
};

export function makeInventoryApi(http: AxiosInstance) {
  return {
    async getById(arInvtId: number): Promise<InventoryItem | null> {
      try {
        const res = await http.get(`/Manufacturing/Inventory/Inventory/${arInvtId}`);
        const body = unwrap<any>(res);
        if (!body) return null;
        return {
          arInvtId: Number(body.Id ?? body.ID ?? arInvtId),
          itemNo: String(body.ItemNo ?? ''),
          rev: String(body.Rev ?? ''),
          description: String(body.Description ?? body.Descrip ?? ''),
          itemClass: String(body.Class ?? body.ItemClass ?? ''),
          uom: String(body.UOM ?? body.Uom ?? ''),
        };
      } catch { return null; }
    },

    async batchGetByIds(ids: number[]): Promise<Map<number, InventoryItem>> {
      const unique = [...new Set(ids)];
      const results = await Promise.all(unique.map(id => this.getById(id)));
      const map = new Map<number, InventoryItem>();
      results.forEach((r, i) => { if (r) map.set(unique[i]!, r); });
      return map;
    },

    async getDefaultRecvDesignator(arInvtId: number): Promise<string | null> {
      try {
        const res = await http.get(`/Manufacturing/Inventory/Locations/0`, { params: { arinvtId: arInvtId } });
        const body = res.data?.data ?? res.data ?? [];
        const def = (body as any[]).find(loc => loc.ReceiveDesignator === true || loc.DefaultRecvDesignator === true);
        return def ? String(def.Description ?? def.LocCode ?? def.Code ?? '') : null;
      } catch { return null; }
    },
  };
}
