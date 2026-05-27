import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../api/auth.js';
import { useSession } from '../store/session.js';
import { ApiError } from '../api/client.js';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const setMe = useSession(s => s.setMe);

  const [baseUrl, setBaseUrl] = useState(localStorage.getItem('epr.baseUrl') ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [database, setDatabase] = useState(localStorage.getItem('epr.database') ?? '');
  const [eplantId, setEplantId] = useState(Number(localStorage.getItem('epr.eplant') ?? 1));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as any)?.from ?? '/planning';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSubmitting(true);
    try {
      const me = await authApi.login({ baseUrl, username, password, database, eplantId });
      localStorage.setItem('epr.baseUrl', baseUrl);
      localStorage.setItem('epr.database', database);
      localStorage.setItem('epr.eplant', String(eplantId));
      setMe(me);
      navigate(redirectTo, { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));
    } finally { setSubmitting(false); }
  }

  return (
    <div className="app">
      <h1>Sign in</h1>
      <form onSubmit={onSubmit}>
        <label>Base URL <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} required placeholder="http://delmiaworks:8080/WebAPI" /></label>
        <label>Database <input value={database} onChange={e => setDatabase(e.target.value)} required /></label>
        <label>EPlant ID <input type="number" value={eplantId} onChange={e => setEplantId(Number(e.target.value))} required min={1} /></label>
        <label>Username <input value={username} onChange={e => setUsername(e.target.value)} required /></label>
        <label>Password <input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        <button type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
      </form>
    </div>
  );
}
