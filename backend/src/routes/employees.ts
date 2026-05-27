import { Router } from 'express';

export function makeEmployeesRouter(getDw: (req: any) => any) {
  const router = Router();
  router.get('/', async (req, res, next) => {
    try {
      const dw = getDw(req);
      dw.setAuthToken(req.session!.authToken);
      const list = await dw.employees.listTeamMembers();
      res.json({ employees: list });
    } catch (e) { next(e); }
  });
  return router;
}
