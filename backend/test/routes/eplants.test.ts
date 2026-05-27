import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { makeEPlantsRouter } from '../../src/routes/eplants.js';

describe('GET /api/eplants', () => {
  it('400 on missing baseUrl', async () => {
    const app = express();
    app.use('/api/eplants', makeEPlantsRouter(() => ({})));
    const res = await request(app).get('/api/eplants');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MISSING_BASE_URL');
  });

  it('200 with eplants list when baseUrl provided', async () => {
    const dw = { eplants: { list: vi.fn().mockResolvedValue([{ id: 1, name: 'Plant A' }, { id: 2, name: 'Plant B' }]) } };
    const app = express();
    app.use('/api/eplants', makeEPlantsRouter(() => dw));
    const res = await request(app).get('/api/eplants?baseUrl=http://dw');
    expect(res.status).toBe(200);
    expect(res.body.eplants).toHaveLength(2);
  });
});
