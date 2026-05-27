import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { createDwClient } from '../../src/dwClient/index.js';

const BASE = 'http://dw.example';

beforeEach(() => { nock.disableNetConnect(); });
afterEach(() => { nock.cleanAll(); nock.enableNetConnect(); });

function inv(id: number, itemNo = `ITM-${id}`) {
  return { data: { Id: id, ItemNo: itemNo, Rev: '', Description: `Desc ${id}`, Class: 'IN', UOM: 'EACH' } };
}

/**
 * Helper: build a PurchaseOrder/0?poNo=X response with given PODetails+POReleases.
 * Matches the live DW shape verified on the IQORA test VM (May 2026).
 */
function po(poId: number, poNo: string, status: string, details: Array<{
  detailId: number; arInvtId: number; itemNo: string; itemClass?: string; itemRev?: string;
  releases: Array<{ id: number; promiseDate: string; qty: number }>;
}>) {
  return {
    data: {
      Id: poId, PONo: poNo, Status: status, EPlantId: 13,
      PODetails: details.map(d => ({
        Id: d.detailId, PurchaseOrderId: poId, ArInvtId: d.arInvtId,
        ItemNo: d.itemNo, ItemClass: d.itemClass ?? 'IN', ItemRev: d.itemRev ?? '',
        Quantity: d.releases.reduce((s, r) => s + r.qty, 0), UOM: 'EACH',
        POReleases: d.releases.map(r => ({
          Id: r.id, PODetailId: d.detailId,
          PromiseDate: r.promiseDate, Quantity: r.qty, Seq: 1,
        })),
      })),
    },
  };
}

describe('poReleases.listOpenByPromiseDate', () => {
  it('walks PO tree, filters by date range, groups by PromiseDate', async () => {
    // Summary list returns 1 PO
    nock(BASE).get(/\/POs\/0/).query(true).reply(200, {
      data: [{ Id: 18, PONo: '6-1', EplantId: 13 }],
    });
    // Full PO contains 2 details with releases on 2026-05-28
    nock(BASE).get(/\/PurchaseOrder\/0/).query({ poNo: '6-1' }).reply(200,
      po(18, '6-1', 'APPROVED', [
        { detailId: 569, arInvtId: 500, itemNo: '0072027', releases: [{ id: 392, promiseDate: '2026-05-28T00:00:00', qty: 100 }] },
        { detailId: 570, arInvtId: 501, itemNo: '028385901', releases: [{ id: 393, promiseDate: '2026-05-28T00:00:00', qty: 50 }] },
      ]),
    );
    // No receipts yet
    nock(BASE).get(/\/POReceipts\/0/).query(true).reply(200, { data: [] }).persist();
    // Inventory lookups
    nock(BASE).get(/Inventory\/500/).reply(200, inv(500, '0072027'));
    nock(BASE).get(/Inventory\/501/).reply(200, inv(501, '028385901'));

    const dw = createDwClient({ baseUrl: BASE });
    const groups = await dw.poReleases.listOpenByPromiseDate({
      dateFrom: '2026-05-27', dateTo: '2026-06-03', eplantId: 13,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]!.date).toBe('2026-05-28');
    expect(groups[0]!.items).toHaveLength(2);
    expect(groups[0]!.items.map(i => i.poNo)).toEqual(['6-1', '6-1']);
  });

  it('subtracts receipts and hides fully-received releases', async () => {
    nock(BASE).get(/\/POs\/0/).query(true).reply(200, { data: [{ Id: 7, PONo: 'PO-7', EplantId: 13 }] });
    nock(BASE).get(/\/PurchaseOrder\/0/).query({ poNo: 'PO-7' }).reply(200,
      po(7, 'PO-7', 'APPROVED', [
        { detailId: 20, arInvtId: 999, itemNo: 'ITM-999', releases: [{ id: 200, promiseDate: '2026-05-28T00:00:00', qty: 10 }] },
      ]),
    );
    // 10 fully received against release 200 -> should be hidden
    nock(BASE).get(/\/POReceipts\/0/).query({ poDetailId: '20' }).reply(200, {
      data: [{ Id: 1000, POReleaseId: 200, PODetailId: 20, QtyReceived: 10 }],
    });

    const dw = createDwClient({ baseUrl: BASE });
    const groups = await dw.poReleases.listOpenByPromiseDate({
      dateFrom: '2026-05-27', dateTo: '2026-06-03', eplantId: 13,
    });

    expect(groups).toEqual([]);
  });

  it('client-side filters out items beyond dateTo', async () => {
    nock(BASE).get(/\/POs\/0/).query(true).reply(200, { data: [{ Id: 7, PONo: 'PO-7', EplantId: 13 }] });
    nock(BASE).get(/\/PurchaseOrder\/0/).query({ poNo: 'PO-7' }).reply(200,
      po(7, 'PO-7', 'APPROVED', [
        { detailId: 30, arInvtId: 700, itemNo: 'ITM-700', releases: [
          { id: 300, promiseDate: '2026-06-10T00:00:00', qty: 25 },
          { id: 301, promiseDate: '2026-06-15T00:00:00', qty: 25 }, // out of range
        ] },
      ]),
    );
    nock(BASE).get(/\/POReceipts\/0/).query(true).reply(200, { data: [] }).persist();
    nock(BASE).get(/Inventory\/700/).reply(200, inv(700, 'ITM-700'));

    const dw = createDwClient({ baseUrl: BASE });
    const groups = await dw.poReleases.listOpenByPromiseDate({
      dateFrom: '2026-06-01', dateTo: '2026-06-12', eplantId: 13,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]!.date).toBe('2026-06-10');
    expect(groups[0]!.items).toHaveLength(1);
  });

  it('skips POs with closed/cancelled header status', async () => {
    nock(BASE).get(/\/POs\/0/).query(true).reply(200, { data: [{ Id: 9, PONo: 'PO-CLOSED', EplantId: 13 }] });
    nock(BASE).get(/\/PurchaseOrder\/0/).query({ poNo: 'PO-CLOSED' }).reply(200,
      po(9, 'PO-CLOSED', 'CLOSED', [
        { detailId: 90, arInvtId: 800, itemNo: 'ITM-800', releases: [{ id: 900, promiseDate: '2026-05-28T00:00:00', qty: 5 }] },
      ]),
    );
    // No POReceipts mock needed — we should never get this far for a closed PO

    const dw = createDwClient({ baseUrl: BASE });
    const groups = await dw.poReleases.listOpenByPromiseDate({
      dateFrom: '2026-05-27', dateTo: '2026-06-03', eplantId: 13,
    });

    expect(groups).toEqual([]);
  });
});
