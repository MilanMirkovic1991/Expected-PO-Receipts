import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { authApi } from './api/auth.js';
import { useSession } from './store/session.js';
import { Login } from './pages/Login.js';
import { NavHeader } from './components/NavHeader.js';
import { useNotifications } from './hooks/useNotifications.js';

function Protected() {
  const me = useSession(s => s.me);
  const setMe = useSession(s => s.setMe);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    authApi.me().then(setMe).catch(() => setMe(null)).finally(() => setLoading(false));
  }, [setMe]);
  useNotifications();
  if (loading) return <div className="app"><p>Loading…</p></div>;
  if (!me) return <Navigate to="/login" replace />;
  return (
    <>
      <NavHeader />
      <Outlet />
    </>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected />}>
        <Route path="/" element={<Navigate to="/planning" replace />} />
        <Route path="/planning" element={<div className="app"><p>Planning (TODO)</p></div>} />
        <Route path="/receiving" element={<div className="app"><p>Receiving (TODO)</p></div>} />
        <Route path="/receiving/:id" element={<div className="app"><p>Receiving task (TODO)</p></div>} />
      </Route>
    </Routes>
  );
}
