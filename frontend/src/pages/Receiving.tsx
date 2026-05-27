import { useQuery } from '@tanstack/react-query';
import { tasksApi } from '../api/tasks.js';
import { TaskCard } from '../components/TaskCard.js';

export function Receiving() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['tasks', 'mine'], queryFn: tasksApi.listMine });
  return (
    <div className="app">
      <h2>My open tasks</h2>
      {isLoading && <p>Loading…</p>}
      {isError && <p style={{ color: 'crimson' }}>Failed to load tasks.</p>}
      {data?.tasks.length === 0 && <p>No open tasks.</p>}
      {data?.tasks.map(t => <TaskCard key={t.id} task={t} />)}
    </div>
  );
}
