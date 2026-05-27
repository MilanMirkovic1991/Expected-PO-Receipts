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

  async function logout() { try { await authApi.logout(); } catch { /* best-effort */ } setMe(null); navigate('/login'); }

  const initials = (me?.username ?? '?').slice(0, 2).toUpperCase();

  return (
    <header className="nav">
      <div className="nav__brand">
        <span className="nav__logo">📦</span>
        <span>Expected PO Receipts</span>
      </div>

      <nav className="nav__links">
        <NavLink to="/planning" className={({ isActive }) => 'nav__link' + (isActive ? ' active' : '')}>
          <span aria-hidden>📋</span> Planning
        </NavLink>
        <NavLink to="/receiving" className={({ isActive }) => 'nav__link' + (isActive ? ' active' : '')}>
          <span aria-hidden>📥</span> Receiving
          {count > 0 && <span className="badge badge--count" aria-label={`${count} open tasks`}>{count}</span>}
        </NavLink>
      </nav>

      <div className="nav__user">
        <span className="nav__user-avatar" title={me?.username ?? ''}>{initials}</span>
        <span>{me?.username}</span>
      </div>
      <button className="btn btn--ghost btn--sm" onClick={logout}>Logout</button>
    </header>
  );
}
