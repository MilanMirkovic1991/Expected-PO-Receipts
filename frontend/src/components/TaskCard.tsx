import { Link } from 'react-router-dom';
import type { TaskSummary } from '../types.js';

export function TaskCard({ task }: { task: TaskSummary }) {
  return (
    <article style={{ border: '1px solid #ddd', borderRadius: 4, padding: '1rem', marginBottom: '0.5rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <strong>Task #{task.id}</strong>
        <span style={{ background: '#e5f5e5', padding: '0 6px', borderRadius: 8, fontSize: 12 }}>{task.status}</span>
      </header>
      <p style={{ margin: '0.5rem 0' }}>From: {task.createdBy} · Period: {task.dateFrom} → {task.dateTo}</p>
      <Link to={`/receiving/${task.id}`}>Open →</Link>
    </article>
  );
}
