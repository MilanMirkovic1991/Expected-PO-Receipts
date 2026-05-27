import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDwClient } from '../../src/dwClient/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://dw.example';
const FIX_RELEASES = JSON.parse(readFileSync(join(__dirname, '../fixtures/dw/poReleases.json'), 'utf8'));

beforeEach(() => { nock.disableNetConnect(); });
afterEach(() => { nock.cleanAll(); nock.enableNetConnect(); });

function inv(id: number) {
  return { data: { Id: id, ItemNo: `ITM-${id}`, Rev: 'R1', Description: `Desc ${id}`, Class: 'A', UOM: 'PCS' } };
}

describe('poReleases.listOpenByPromiseDate', () => {
  it('returns groups by PromiseDate, filters fully received, enriches inventory', async () => {
    nock(BASE).get(/POReleaseItems/).query(true).reply(200, FIX_RELEASES);
    nock(BASE).get(/Inventory\/500/).reply(200, inv(500));
    nock(BASE).get(/Inventory\/501/).reply(200, inv(501));
    nock(BASE).get(/Locations\/0/).query(true).reply(200, { data: [] }).persist();

    const dw = createDwClient({ baseUrl: BASE });
    const groups = await dw.poReleases.listOpenByPromiseDate({
      dateFrom: '2026-05-27', dateTo: '2026-06-03', eplantId: 1,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]!.date).toBe('2026-05-28');
    expect(groups[0]!.items).toHaveLength(2);
    const remaining = groups[0]!.items.find(i => i.poReleaseId === 102)!.qtyExpected;
    expect(remaining).toBe(50);
  });

  it('returns empty when all receipts cover quantities', async () => {
    nock(BASE).get(/POReleaseItems/).query(true).reply(200, { data: [
      { Id: 200, PODetailId: 20, PurchaseOrderId: 5, PurchaseOrderNo: 'PO-5', ArInvtId: 999, Quantity: 10, QtyReceived: 10, PromiseDate: '2026-05-28T00:00:00' }
    ] });
    const dw = createDwClient({ baseUrl: BASE });
    const groups = await dw.poReleases.listOpenByPromiseDate({ dateFrom: '2026-05-27', dateTo: '2026-06-03', eplantId: 1 });
    expect(groups).toEqual([]);
  });
});
