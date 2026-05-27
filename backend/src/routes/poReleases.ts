import { Router } from 'express';

type DwFactoryForSession = (req: any) => any;

export function makePOReleasesRouter(getDw: DwFactoryForSession) {
  const router = Router();
  router.get('/', async (req, res, next) => {
    try {
      const dateFrom = String(req.query.dateFrom ?? '');
      const dateTo = String(req.query.dateTo ?? '');
      if (!dateFrom || !dateTo) { res.status(400).json({ error: 'MISSING_DATES' }); return; }
      const dw = getDw(req);
      dw.setAuthToken(req.session!.authToken);
      const groups = await dw.poReleases.listOpenByPromiseDate({
        dateFrom, dateTo, eplantId: req.session!.eplantId,
      });
      res.json({ groups });
    } catch (e) { next(e); }
  });
  return router;
}
