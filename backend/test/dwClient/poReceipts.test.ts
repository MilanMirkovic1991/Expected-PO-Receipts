import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { createDwClient } from '../../src/dwClient/index.js';

const BASE = 'http://dw.example';

beforeEach(() => { nock.disableNetConnect(); });
afterEach(() => { nock.cleanAll(); nock.enableNetConnect(); });

describe('poReceipts.createAndPost', () => {
  it('chains CreatePOReceipt and PostPOReceiptAndUpdateMasterLabel', async () => {
    nock(BASE).post(/CreatePOReceipt/).query(true).reply(200, { data: { Id: 555 } });
    nock(BASE).post(/PostPOReceiptAndUpdateMasterLabel/).query(true).reply(200, {
      data: { Id: 555, FgMultiId: 999 },
    });
    const dw = createDwClient({ baseUrl: BASE });
    const res = await dw.poReceipts.createAndPost({
      poDetailId: 10, poReleaseId: 100, qty: 75,
      lotNo: 'LOT-A', locationId: 7,
      comment: 'Task #12', username: 'worker',
    });
    expect(res.receiptId).toBe(555);
    expect(res.masterLabelId).toBe(999);
  });

  it('throws DW_RECEIPT_CREATE_FAILED if first call returns no Id', async () => {
    nock(BASE).post(/CreatePOReceipt/).query(true).reply(200, { data: {} });
    const dw = createDwClient({ baseUrl: BASE });
    await expect(dw.poReceipts.createAndPost({
      poDetailId: 10, poReleaseId: 100, qty: 75, lotNo: 'L', locationId: 1, comment: '', username: 'u',
    })).rejects.toMatchObject({ code: 'DW_RECEIPT_CREATE_FAILED' });
  });

  it('throws DW_RECEIPT_POST_FAILED if post call fails, surfacing receiptId', async () => {
    nock(BASE).post(/CreatePOReceipt/).query(true).reply(200, { data: { Id: 555 } });
    nock(BASE).post(/PostPOReceiptAndUpdateMasterLabel/).query(true).reply(500, { error: 'oops' });
    const dw = createDwClient({ baseUrl: BASE });
    await expect(dw.poReceipts.createAndPost({
      poDetailId: 10, poReleaseId: 100, qty: 75, lotNo: 'L', locationId: 1, comment: '', username: 'u',
    })).rejects.toMatchObject({ code: 'DW_RECEIPT_POST_FAILED' });
  });
});
