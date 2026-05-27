import type { AxiosResponse } from 'axios';

export function unwrap<T>(res: AxiosResponse): T {
  const body = res.data;
  return (body?.data ?? body) as T;
}

/**
 * Defensive array extraction for DW responses.
 * DW WebAPI is inconsistent: sometimes returns a bare array, sometimes `{ data: [...] }`,
 * sometimes a wrapper object with a key whose value is the array.
 *
 * Strategy:
 *  1. body is already an array -> return it
 *  2. body.data is an array -> return body.data (most common)
 *  3. body.Data / body.Items / body.items / body.Result / body.result is an array -> return it
 *  4. body.data is an object with an array somewhere inside -> return the first array found
 *  5. otherwise -> []
 */
export function pickArray<T = unknown>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[];
  if (!body || typeof body !== 'object') return [];

  const obj = body as Record<string, unknown>;
  const COMMON_KEYS = ['data', 'Data', 'Items', 'items', 'Result', 'result', 'value', 'Value'];

  for (const k of COMMON_KEYS) {
    if (Array.isArray(obj[k])) return obj[k] as T[];
  }
  // nested under data
  if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
    const inner = obj.data as Record<string, unknown>;
    for (const k of Object.keys(inner)) {
      if (Array.isArray(inner[k])) return inner[k] as T[];
    }
  }
  // last-resort: any top-level array property
  for (const k of Object.keys(obj)) {
    if (Array.isArray(obj[k])) return obj[k] as T[];
  }
  return [];
}
