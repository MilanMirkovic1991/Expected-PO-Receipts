import { Router } from 'express';

export function makeEPlantsRouter(getDw: (req: any) => any) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const dw = getDw(req);
      dw.setAuthToken(req.session!.authToken);
      const eplants = await dw.eplants.list();
      res.json({ eplants });
    } catch (e) { next(e); }
  });

  return router;
}
