import { Router } from 'express';

export function makeLocationsRouter(getDw: (req: any) => any) {
  const router = Router();
  router.get('/', async (req, res, next) => {
    try {
      const arInvtId = Number(req.query.arInvtId);
      if (!Number.isFinite(arInvtId) || arInvtId <= 0) { res.status(400).json({ error: 'MISSING_AR_INVT_ID' }); return; }
      const dw = getDw(req);
      dw.setAuthToken(req.session!.authToken);
      const locations = await dw.locations.listForItem(arInvtId);
      res.json({ locations });
    } catch (e) { next(e); }
  });
  return router;
}
