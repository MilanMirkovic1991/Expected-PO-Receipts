import { Link } from 'react-router-dom';
import type { TaskSummary } from '../types.js';

const STATUS_BADGE: Record<TaskSummary['status'], string> = {
  open: 'badge--info',
  in_progress: 'badge--warning',
  completed: 'badge--success',
  cancelled: 'badge--danger',
};

const STATUS_LABEL: Record<TaskSummary['status'], string> = {
  open: 'Open',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function TaskCard({ task }: { task: TaskSummary }) {
  return (
    <Link to={`/receiving/${task.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <article className="card card--hover">
        <div className="card__header">
          <div className="card__title">
            <span aria-hidden>📋</span>
            Task #{task.id}
          </div>
          <span className={'badge ' + (STATUS_BADGE[task.status] ?? '')}>
            {STATUS_LABEL[task.status] ?? task.status}
          </span>
        </div>
        <div className="card__meta">
          <div><strong className="muted">From:</strong> {task.createdBy}</div>
          <div><strong className="muted">Period:</strong> {task.dateFrom} → {task.dateTo}</div>
        </div>
        <div className="row row--end">
          <span style={{ color: 'var(--brand-700)', fontWeight: 500 }}>Open task →</span>
        </div>
      </article>
    </Link>
  );
}
