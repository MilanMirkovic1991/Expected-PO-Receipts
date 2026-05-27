import { AxiosInstance } from 'axios';
import { makeError } from './http.js';
import { unwrap } from './shared.js';

export type CreateAndPostInput = {
  poDetailId: number;
  poReleaseId: number;
  qty: number;
  lotNo: string;
  locationId: number;
  comment: string;
  username: string;
};

export type CreateAndPostResult = { receiptId: number; masterLabelId: number };

function isoNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function makePOReceiptsApi(http: AxiosInstance) {
  return {
    async createAndPost(input: CreateAndPostInput): Promise<CreateAndPostResult> {
      const dateReceived = isoNow();

      let receiptId = 0;
      try {
        const createUrl = `/POReceiving/PO/CreatePOReceipt/0?poDetailId=${input.poDetailId}&poReleaseId=${input.poReleaseId}&qtyReceived=${input.qty}&dateReceived=${encodeURIComponent(dateReceived)}&comment=${encodeURIComponent(input.comment)}&username=${encodeURIComponent(input.username)}`;
        const res = await http.post(createUrl, {});
        const body = unwrap<any>(res);
        receiptId = Number(body?.Id ?? body?.ID ?? 0);
        if (!Number.isFinite(receiptId) || receiptId <= 0) {
          throw makeError('DW_RECEIPT_CREATE_FAILED', `CreatePOReceipt returned no Id: ${JSON.stringify(body)}`);
        }
      } catch (e: any) {
        if (e?.code === 'DW_RECEIPT_CREATE_FAILED') throw e;
        throw makeError('DW_RECEIPT_CREATE_FAILED', `CreatePOReceipt failed: ${e?.message ?? 'unknown'}`, e);
      }

      try {
        const postUrl = `/POReceiving/PO/PostPOReceiptAndUpdateMasterLabel/0?poReceiptId=${receiptId}`;
        const res = await http.post(postUrl, {
          UseDefaultLocation: false,
          LocationId: input.locationId,
          LotNo: input.lotNo,
          TransDate: dateReceived,
        });
        const body = unwrap<any>(res);
        const masterLabelId = Number(body?.FgMultiId ?? body?.MasterLabelId ?? 0);
        return { receiptId, masterLabelId };
      } catch (e: any) {
        const err = makeError('DW_RECEIPT_POST_FAILED', `PostPOReceiptAndUpdateMasterLabel failed: ${e?.message ?? 'unknown'}`, e);
        (err as any).receiptId = receiptId;
        throw err;
      }
    },
  };
}
