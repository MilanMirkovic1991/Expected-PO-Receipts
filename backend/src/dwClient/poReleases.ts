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

/**
 * Run `fn` over `items` with at most `concurrency` in flight at a time.
 * Preserves input order in the output.
 */
async function mapConcurrent<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

// PO header statuses that mean "do not show its releases"
const CLOSED_STATUSES = new Set(['CLOSED', 'CANCELLED', 'CANCELED', 'VOID', 'VOIDED', 'DELETED']);

export function makePOReleasesApi(http: AxiosInstance, inventory: InventoryApi) {
  return {
    /**
     * List open PO release items in a Promise Date range, grouped by date.
     *
     * The DW WebAPI has no single endpoint that lists release items by Promise Date.
     * The PO_RELEASES rows are reachable only nested inside PurchaseOrder responses.
     * So the flow is:
     *   1. List PO summaries for the EPlant.
     *   2. For each PO, fetch the full nested structure via PurchaseOrder/0?poNo=...
     *   3. Skip POs with closed/cancelled/voided header status.
     *   4. Flatten the PODetails / POReleases tree.
     *   5. Keep releases whose PromiseDate lands in [dateFrom, dateTo].
     *   6. For each unique PODetail, fetch receipts and subtract them per release.
     *   7. Enrich items with Inventory data (description) and group by PromiseDate.
     */
    async listOpenByPromiseDate(input: { dateFrom: string; dateTo: string; eplantId: number }): Promise<ReleaseGroup[]> {
      // --- Step 1: list PO summaries in this EPlant ---
      const filter = buildFilter({ EplantId: input.eplantId });
      const summaryRes = await http.get('/POReceiving/PO/POs/0', { params: { filter, pageSize: 1000 } });
      const summaries = pickArray<any>(summaryRes.data);
      logger.info({ eplantId: input.eplantId, poCount: summaries.length, sample: summaries[0]?.PONo }, 'poReleases: PO summaries fetched');

      if (summaries.length === 0) return [];

      // --- Step 2: fetch each PO's nested structure ---
      const poNumbers = summaries.map(p => String(p.PONo ?? '')).filter(Boolean);
      const fullPOs = await mapConcurrent(poNumbers, 5, async (poNo) => {
        try {
          const r = await http.get('/POReceiving/PO/PurchaseOrder/0', { params: { poNo } });
          return (r.data?.data ?? r.data) as any;
        } catch (e: any) {
          logger.warn({ poNo, err: e?.message }, 'poReleases: failed to fetch PO detail');
          return null;
        }
      });

      // --- Step 3-5: walk tree, filter status, filter date range ---
      type Raw = {
        poReleaseId: number; poDetailId: number; poId: number; poNo: string;
        arInvtId: number; itemClass: string; itemNo: string; itemRev: string;
        qty: number; promiseDate: string;
      };
      const raw: Raw[] = [];
      let skippedByStatus = 0;
      for (const po of fullPOs) {
        if (!po) continue;
        const status = String(po.Status ?? '').toUpperCase().trim();
        if (CLOSED_STATUSES.has(status)) { skippedByStatus++; continue; }

        const details: any[] = Array.isArray(po.PODetails) ? po.PODetails : [];
        for (const detail of details) {
          const releases: any[] = Array.isArray(detail.POReleases) ? detail.POReleases : [];
          for (const rel of releases) {
            const d = dateOnly(String(rel.PromiseDate ?? ''));
            if (!d || d < input.dateFrom || d > input.dateTo) continue;
            raw.push({
              poReleaseId: Number(rel.Id),
              poDetailId: Number(detail.Id),
              poId: Number(po.Id),
              poNo: String(po.PONo ?? ''),
              arInvtId: Number(detail.ArInvtId ?? 0),
              itemClass: String(detail.ItemClass ?? ''),
              itemNo: String(detail.ItemNo ?? ''),
              itemRev: String(detail.ItemRev ?? ''),
              qty: Number(rel.Quantity ?? 0),
              promiseDate: d,
            });
          }
        }
      }
      logger.info({ skippedByStatus, rawCount: raw.length }, 'poReleases: tree flattened');

      if (raw.length === 0) return [];

      // --- Step 6: per-PODetail receipts → subtract per release ---
      const detailIds = [...new Set(raw.map(r => r.poDetailId))];
      const receiptsByRelease = new Map<number, number>();
      await mapConcurrent(detailIds, 5, async (detailId) => {
        try {
          const r = await http.get('/POReceiving/PO/POReceipts/0', { params: { poDetailId: detailId } });
          const list = pickArray<any>(r.data);
          for (const rcpt of list) {
            const relId = Number(rcpt.POReleaseId ?? 0);
            if (relId > 0) {
              receiptsByRelease.set(relId, (receiptsByRelease.get(relId) ?? 0) + Number(rcpt.QtyReceived ?? 0));
            }
          }
        } catch (e: any) {
          logger.warn({ detailId, err: e?.message }, 'poReleases: failed to fetch receipts for detail');
        }
      });

      // Compute remaining qty per release; keep only releases with qty > 0
      const open = raw
        .map(r => ({ ...r, qtyExpected: r.qty - (receiptsByRelease.get(r.poReleaseId) ?? 0) }))
        .filter(r => r.qtyExpected > 0);
      logger.info({ openCount: open.length, totalAfterDateFilter: raw.length }, 'poReleases: after receipts filter');

      if (open.length === 0) return [];

      // --- Step 7: enrich with inventory descriptions ---
      const invIds = open.map(r => r.arInvtId).filter(id => id > 0);
      const invMap = invIds.length > 0 ? await inventory.batchGetByIds(invIds) : new Map<number, InventoryItem>();

      const rows: POReleaseRow[] = open.map(r => {
        const inv = invMap.get(r.arInvtId);
        return {
          poReleaseId: r.poReleaseId,
          poDetailId: r.poDetailId,
          poId: r.poId,
          poNo: r.poNo,
          arInvtId: r.arInvtId,
          itemClass: r.itemClass || inv?.itemClass || '',
          itemNo: r.itemNo || inv?.itemNo || '',
          itemRev: r.itemRev || inv?.rev || '',
          itemDescription: inv?.description ?? '',
          qtyExpected: r.qtyExpected,
          promiseDate: r.promiseDate,
          defaultRecvDesignator: '',
        };
      });

      // Group by promiseDate, sort dates ascending
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
