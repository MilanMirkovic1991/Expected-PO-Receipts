import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../api/auth.js';
import { useSession } from '../store/session.js';
import { ApiError } from '../api/client.js';

const ENV_BASE_URL = (import.meta.env.VITE_DW_BASE_URL as string | undefined) ?? '';
const ENV_DATABASE = (import.meta.env.VITE_DW_DATABASE as string | undefined) ?? '';
const ENV_EPLANT  = Number((import.meta.env.VITE_DW_EPLANT_ID as string | undefined) ?? 1);

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const setMe = useSession(s => s.setMe);

  const [baseUrl, setBaseUrl] = useState(localStorage.getItem('epr.baseUrl') ?? ENV_BASE_URL);
  const [database, setDatabase] = useState(localStorage.getItem('epr.database') ?? ENV_DATABASE);
  const [eplantId, setEplantId] = useState(Number(localStorage.getItem('epr.eplant') ?? ENV_EPLANT));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    <div className="app app--center">
      <div className="card" style={{ padding: '2rem 1.75rem', marginTop: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56,
            background: 'linear-gradient(135deg, var(--brand-500) 0%, var(--brand-700) 100%)',
            color: '#fff', borderRadius: 14, fontSize: 26,
            boxShadow: 'var(--shadow)',
            marginBottom: '0.75rem',
          }}>📦</div>
          <h1 style={{ marginBottom: '0.25rem' }}>Expected PO Receipts</h1>
          <p className="muted" style={{ margin: 0 }}>Sign in with your DELMIAWORKS credentials</p>
        </div>

        <form onSubmit={onSubmit} className="form">
          <div className="form__field">
            <label className="form__label" htmlFor="login-username">Username</label>
            <input id="login-username" autoFocus value={username} onChange={e => setUsername(e.target.value)} required autoComplete="username" />
          </div>
          <div className="form__field">
            <label className="form__label" htmlFor="login-password">Password</label>
            <input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>

          <details open={showAdvanced} onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}
            style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
            <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem', userSelect: 'none' }}>
              Connection settings
            </summary>
            <div className="form" style={{ marginTop: '0.75rem' }}>
              <div className="form__field">
                <label className="form__label" htmlFor="login-baseurl">DW WebAPI Base URL</label>
                <input id="login-baseurl" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} required placeholder="http://host:8080/WebAPI" />
              </div>
              <div className="grid-form">
                <div className="form__field">
                  <label className="form__label" htmlFor="login-db">Database</label>
                  <input id="login-db" value={database} onChange={e => setDatabase(e.target.value)} required />
                </div>
                <div className="form__field">
                  <label className="form__label" htmlFor="login-eplant">EPlant ID</label>
                  <input id="login-eplant" type="number" min={1} value={eplantId} onChange={e => setEplantId(Number(e.target.value))} required />
                </div>
              </div>
            </div>
          </details>

          {error && (
            <div className="alert alert--danger" role="alert">
              <span className="alert__icon">⚠</span>
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={submitting}>
            {submitting ? <><span className="spinner" /> Signing in…</> : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
