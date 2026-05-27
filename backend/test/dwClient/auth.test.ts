import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { createDwClient } from '../../src/dwClient/index.js';

const BASE = 'http://dw.example';

beforeEach(() => { nock.disableNetConnect(); });
afterEach(() => { nock.cleanAll(); nock.enableNetConnect(); });

describe('auth.login', () => {
  it('returns AuthToken on success', async () => {
    nock(BASE).post('/User/Login').reply(200, { AuthToken: 'token-xyz', UserName: 'user' });
    const dw = createDwClient({ baseUrl: BASE });
    const r = await dw.auth.login({ username: 'user', password: 'pw', database: 'DB' });
    expect(r.authToken).toBe('token-xyz');
  });

  it('throws AUTH_FAILED on missing token', async () => {
    nock(BASE).post('/User/Login').reply(200, {});
    const dw = createDwClient({ baseUrl: BASE });
    await expect(dw.auth.login({ username: 'u', password: 'p', database: 'd' }))
      .rejects.toMatchObject({ code: 'AUTH_FAILED' });
  });

  it('throws DW_UNREACHABLE when host refuses', async () => {
    nock(BASE).post('/User/Login').replyWithError({ code: 'ECONNREFUSED' });
    const dw = createDwClient({ baseUrl: BASE });
    await expect(dw.auth.login({ username: 'u', password: 'p', database: 'd' }))
      .rejects.toMatchObject({ code: 'DW_UNREACHABLE' });
  });
});
