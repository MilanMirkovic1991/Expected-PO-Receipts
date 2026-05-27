import { Router } from 'express';

export function makePrintersRouter(getDw: (req: any) => any) {
  const router = Router();
  router.get('/', async (req, res, next) => {
    try {
      const dw = getDw(req);
      dw.setAuthToken(req.session!.authToken);
      const printers = await dw.labels.listPrinters();
      res.json({ printers });
    } catch (e) { next(e); }
  });
  return router;
}
