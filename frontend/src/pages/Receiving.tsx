import { useQuery } from '@tanstack/react-query';
import { tasksApi } from '../api/tasks.js';
import { TaskCard } from '../components/TaskCard.js';

export function Receiving() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['tasks', 'mine'],
    queryFn: tasksApi.listMine,
  });

  const count = data?.tasks.length ?? 0;

  return (
    <div className="app">
      <div className="row" style={{ alignItems: 'baseline', marginBottom: '1.25rem' }}>
        <h2 style={{ margin: 0 }}>My open tasks</h2>
        {count > 0 && <span className="badge badge--brand">{count}</span>}
        <span className="spacer" />
        <button className="btn btn--sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <><span className="spinner" /> Refreshing…</> : <>🔄 Refresh</>}
        </button>
      </div>

      {isLoading && (
        <div className="loading-state"><span className="spinner" /> Loading tasks…</div>
      )}
      {isError && (
        <div className="alert alert--danger" role="alert">
          <span className="alert__icon">⚠</span>
          <span>Failed to load tasks.</span>
        </div>
      )}
      {data?.tasks.length === 0 && (
        <div className="empty-state">
          <div className="empty-state__icon">✅</div>
          <div className="empty-state__title">All caught up</div>
          <div>You have no open tasks. New tasks appear here when a planner assigns them to you.</div>
        </div>
      )}
      {data?.tasks.map(t => <TaskCard key={t.id} task={t} />)}
    </div>
  );
}
