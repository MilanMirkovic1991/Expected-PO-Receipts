import { AxiosInstance } from 'axios';
import { pickArray } from './shared.js';
import { logger } from '../logger.js';

export type VendorRow = {
  id: number;
  vendorNo: string;
  company: string;
  city: string;
  country: string;
  eplantId: number;
};

export function makeVendorsApi(http: AxiosInstance) {
  /**
   * One-shot cache: vendor list is small (typically tens to hundreds) and changes rarely.
   * The cache lives for the lifetime of the dwClient (one per session) which is good enough.
   */
  let cache: Map<number, VendorRow> | null = null;
  let inflight: Promise<Map<number, VendorRow>> | null = null;

  async function loadAll(): Promise<Map<number, VendorRow>> {
    if (cache) return cache;
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const res = await http.get('/AccountsPayable/VendorMaintenance/Vendors/0', { params: { pageSize: 5000 } });
        const rows = pickArray<any>(res.data);
        const map = new Map<number, VendorRow>();
        for (const r of rows) {
          const id = Number(r.Id ?? 0);
          if (!id) continue;
          map.set(id, {
            id,
            vendorNo: String(r.VendorNo ?? ''),
            company: String(r.Company ?? r.CompanyName ?? r.VendorName ?? ''),
            city: String(r.City ?? ''),
            country: String(r.Country ?? ''),
            eplantId: Number(r.EPlantId ?? r.EplantId ?? 0),
          });
        }
        cache = map;
        logger.info({ vendorCount: map.size }, 'dw.vendors: loaded');
        return map;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }

  return {
    /** Force-reload from DW on next call. */
    invalidate(): void { cache = null; },

    async listAll(): Promise<VendorRow[]> {
      const map = await loadAll();
      return [...map.values()];
    },

    async getById(id: number): Promise<VendorRow | null> {
      if (!Number.isFinite(id) || id <= 0) return null;
      const map = await loadAll();
      return map.get(id) ?? null;
    },

    async batchGetByIds(ids: number[]): Promise<Map<number, VendorRow>> {
      const map = await loadAll();
      const out = new Map<number, VendorRow>();
      for (const id of new Set(ids)) {
        const v = map.get(id);
        if (v) out.set(id, v);
      }
      return out;
    },
  };
}
