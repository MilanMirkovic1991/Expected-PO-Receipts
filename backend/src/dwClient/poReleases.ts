import { AxiosInstance } from 'axios';
import { buildFilter } from './filter.js';
import { pickArray } from './shared.js';
import type { InventoryItem } from './inventory.js';
import { logger } from '../logger.js';

export type POReleaseRow = {
  poReleaseId: number;
  poDetailId: number;
  poId: number;
  poNo: string;
  arInvtId: number;
  itemClass: string;
  itemNo: string;
  itemRev: string;
  itemDescription: string;
  qtyExpected: number;
  promiseDate: string;
  defaultRecvDesignator: string;
};

export type ReleaseGroup = { date: string; items: POReleaseRow[] };

type InventoryApi = {
  batchGetByIds(ids: number[]): Promise<Map<number, InventoryItem>>;
  getDefaultRecvDesignator(arInvtId: number): Promise<string | null>;
};

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

export function makePOReleasesApi(http: AxiosInstance, inventory: InventoryApi) {
  return {
    async listOpenByPromiseDate(input: { dateFrom: string; dateTo: string; eplantId: number }): Promise<ReleaseGroup[]> {
      const filter = buildFilter({
        PromiseDate: { op: 'gte', value: `${input.dateFrom}T00:00:00` },
        EPlantId: input.eplantId,
      });
      const res = await http.get('/POReceiving/PO/POReleaseItems/0', { params: { filter, pageSize: 1000 } });
      const raw = pickArray<any>(res.data);
      if (raw.length >= 1000) {
        logger.warn({ count: raw.length, dateFrom: input.dateFrom, dateTo: input.dateTo, eplantId: input.eplantId },
          'poReleases: reached pageSize cap — results may be truncated');
      }

      const inRange = raw.filter(r => {
        const d = dateOnly(String(r.PromiseDate ?? ''));
        return d >= input.dateFrom && d <= input.dateTo;
      });
      const open = inRange.filter(r => Number(r.Quantity ?? 0) - Number(r.QtyReceived ?? 0) > 0);
      if (open.length === 0) return [];

      const invIds = open.map(r => Number(r.ArInvtId));
      const uniqueIds = [...new Set(invIds)];
      const designators = new Map<number, string>();
      const [invMap] = await Promise.all([
        inventory.batchGetByIds(invIds),
        Promise.all(uniqueIds.map(async id => {
          const d = await inventory.getDefaultRecvDesignator(id);
          if (d) designators.set(id, d);
        })),
      ]);

      const rows: POReleaseRow[] = open.map(r => {
        const arInvtId = Number(r.ArInvtId);
        const inv = invMap.get(arInvtId);
        return {
          poReleaseId: Number(r.Id),
          poDetailId: Number(r.PODetailId),
          poId: Number(r.PurchaseOrderId),
          poNo: String(r.PurchaseOrderNo ?? ''),
          arInvtId,
          itemClass: inv?.itemClass ?? '',
          itemNo: inv?.itemNo ?? '',
          itemRev: inv?.rev ?? '',
          itemDescription: inv?.description ?? '',
          qtyExpected: Number(r.Quantity ?? 0) - Number(r.QtyReceived ?? 0),
          promiseDate: dateOnly(String(r.PromiseDate ?? '')),
          defaultRecvDesignator: designators.get(arInvtId) ?? '',
        };
      });

      const grouped = new Map<string, POReleaseRow[]>();
      for (const r of rows) {
        const list = grouped.get(r.promiseDate) ?? [];
        list.push(r);
        grouped.set(r.promiseDate, list);
      }
      return [...grouped.keys()].sort().map(date => ({ date, items: grouped.get(date)! }));
    },
  };
}
