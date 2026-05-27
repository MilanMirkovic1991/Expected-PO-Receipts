import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { tasksApi } from '../api/tasks.js';
import { authApi } from '../api/auth.js';
import { useSession } from '../store/session.js';

export function NavHeader() {
  const navigate = useNavigate();
  const me = useSession(s => s.me);
  const setMe = useSession(s => s.setMe);
  const { data } = useQuery({ queryKey: ['tasks', 'mine'], queryFn: tasksApi.listMine, refetchInterval: 60_000, enabled: !!me });
  const count = data?.tasks.length ?? 0;

  async function logout() { await authApi.logout(); setMe(null); navigate('/login'); }

  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 1rem', borderBottom: '1px solid #eee' }}>
      <strong style={{ marginRight: 'auto' }}>Expected PO Receipts</strong>
      <NavLink to="/planning">Planning</NavLink>
      <NavLink to="/receiving">
        Receiving {count > 0 && <span style={{ background: '#0a7', color: 'white', borderRadius: 8, padding: '0 6px', fontSize: 12 }}>{count}</span>}
      </NavLink>
      <span>{me?.username}</span>
      <button onClick={logout}>Logout</button>
    </header>
  );
}
