export type DwClientConfig = { baseUrl: string };

export type LoginInput = { username: string; password: string; database: string; appName?: string };
export type LoginResult = { authToken: string; username: string };

export const DW_ERROR_CODES = [
  'DW_UNREACHABLE',
  'AUTH_FAILED',
  'NOT_AUTHENTICATED',
  'DW_ERROR',
  'DW_RECEIPT_CREATE_FAILED',
  'DW_RECEIPT_POST_FAILED',
  'DW_LABEL_PRINT_FAILED',
] as const;
export type DwErrorCode = typeof DW_ERROR_CODES[number];
export type DwError = Error & { code: DwErrorCode };
export type DwReceiptPostError = DwError & { receiptId: number };
