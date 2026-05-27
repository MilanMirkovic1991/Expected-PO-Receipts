import type { AxiosResponse } from 'axios';

export function unwrap<T>(res: AxiosResponse): T {
  const body = res.data;
  return (body?.data ?? body) as T;
}
