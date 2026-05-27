import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { createDwClient } from '../../src/dwClient/index.js';

const BASE = 'http://dw.example';
beforeEach(() => nock.disableNetConnect());
afterEach(() => { nock.cleanAll(); nock.enableNetConnect(); });

describe('labels', () => {
  it('lists printers', async () => {
    nock(BASE).get(/PrinterList/).reply(200, { data: [{ Name: 'P1' }, { Name: 'P2' }] });
    const dw = createDwClient({ baseUrl: BASE });
    const printers = await dw.labels.listPrinters();
    expect(printers).toEqual(['P1', 'P2']);
  });

  it('printPurchased posts to PrintPurchased and reports success', async () => {
    nock(BASE).post(/PrintPurchased\/666/).query(true).reply(200, { ok: true });
    const dw = createDwClient({ baseUrl: BASE });
    const out = await dw.labels.printPurchased({ masterLabelId: 666, printerName: 'P1', qty: 100 });
    expect(out).toEqual({ printed: true });
  });

  it('printPurchased throws DW_LABEL_PRINT_FAILED on 500', async () => {
    nock(BASE).post(/PrintPurchased\/666/).query(true).reply(500, { error: 'no printer' });
    const dw = createDwClient({ baseUrl: BASE });
    await expect(dw.labels.printPurchased({ masterLabelId: 666, printerName: 'P1', qty: 100 }))
      .rejects.toMatchObject({ code: 'DW_LABEL_PRINT_FAILED' });
  });
});
