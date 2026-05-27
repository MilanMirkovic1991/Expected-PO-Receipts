import type { AxiosResponse } from 'axios';

export function unwrap<T>(res: AxiosResponse): T {
  const body = res.data;
  return (body?.data ?? body) as T;
}

export function pickArray<T = unknown>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[];
  if (body && typeof body === 'object' && 'data' in body && Array.isArray((body as { data: unknown[] }).data)) {
    return (body as { data: T[] }).data;
  }
  return [];
}
