import { Router } from 'express';
import type { TaskQueries } from '../db/queries/tasks.js';
import type { ItemQueries } from '../db/queries/items.js';
import { createTaskService } from '../services/taskService.js';

type Deps = {
  service: ReturnType<typeof createTaskService>;
  tasks: TaskQueries;
  items: ItemQueries;
  dwFactory: (req: any) => any;
};

export function makeTasksRouter(deps: Deps) {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const { assignedToUsername, dateFrom, dateTo, items } = req.body ?? {};
      if (!assignedToUsername || !dateFrom || !dateTo || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: 'MISSING_FIELDS' });
        return;
      }
      const dw = deps.dwFactory(req);
      dw.setAuthToken(req.session!.authToken);
      const employee = await dw.employees.getByUsername(assignedToUsername);
      if (!employee) { res.status(400).json({ error: 'UNKNOWN_EMPLOYEE' }); return; }

      const out = await deps.service.createTask({
        createdByUsername: req.session!.username,
        createdByEplantId: req.session!.eplantId,
        assignedTo: { id: employee.id, username: employee.username, email: employee.email, name: employee.displayName },
        dateFrom, dateTo, items,
      });
      res.json(out);
    } catch (e) { next(e); }
  });

  router.get('/', (req, res) => {
    const rows = deps.tasks.listMine(req.session!.username);
    res.json({ tasks: rows.map(r => ({
      id: r.id, status: r.status, createdAt: r.created_at,
      createdBy: r.created_by_username, dateFrom: r.date_from, dateTo: r.date_to,
    })) });
  });

  router.get('/:id', (req, res) => {
    const id = Number(req.params.id);
    const t = deps.tasks.getById(id);
    if (!t) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    if (t.assigned_to_username !== req.session!.username && t.created_by_username !== req.session!.username) {
      res.status(403).json({ error: 'FORBIDDEN' }); return;
    }
    res.json({ task: t, items: deps.items.listByTask(id) });
  });

  router.post('/:id/cancel', (req, res) => {
    const id = Number(req.params.id);
    const t = deps.tasks.getById(id);
    if (!t) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    if (t.created_by_username !== req.session!.username) { res.status(403).json({ error: 'ONLY_CREATOR_CAN_CANCEL' }); return; }
    if (t.status === 'completed' || t.status === 'cancelled') { res.status(409).json({ error: `TASK_${t.status.toUpperCase()}` }); return; }
    deps.tasks.updateStatus(id, 'cancelled');
    res.json({ ok: true });
  });

  return router;
}
