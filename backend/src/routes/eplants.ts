import { Router } from 'express';

export function makeEPlantsRouter(getDw: (cfg: { baseUrl: string }) => any) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const baseUrl = String(req.query.baseUrl ?? '');
      if (!baseUrl) { res.status(400).json({ error: 'MISSING_BASE_URL' }); return; }
      const dw = getDw({ baseUrl });
      const eplants = await dw.eplants.list();
      res.json({ eplants });
    } catch (e) { next(e); }
  });

  return router;
}
