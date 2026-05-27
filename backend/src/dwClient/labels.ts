import { AxiosInstance } from 'axios';
import { makeError } from './http.js';
import { unwrap } from './shared.js';

export function makeLabelsApi(http: AxiosInstance) {
  return {
    async listPrinters(): Promise<string[]> {
      try {
        const res = await http.get('/Labels/PrintLabel/PrinterList/0');
        const arr = (unwrap<any[]>(res) ?? []) as any[];
        return arr.map(p => String(p.Name ?? p.PrinterName ?? '')).filter(Boolean);
      } catch { return []; }
    },

    async printPurchased(input: { masterLabelId: number; printerName: string; qty: number }): Promise<{ printed: true }> {
      try {
        await http.post(`/Labels/PrintLabel/PrintPurchased/${input.masterLabelId}`, { Qty: input.qty }, {
          params: { printerName: input.printerName, sendToPrinter: true },
        });
        return { printed: true };
      } catch (e: any) {
        throw makeError('DW_LABEL_PRINT_FAILED', `PrintPurchased failed: ${e?.message ?? 'unknown'}`, e);
      }
    },
  };
}
