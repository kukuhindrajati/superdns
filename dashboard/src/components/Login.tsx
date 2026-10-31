import React, { useState } from 'react';

interface LoginProps {
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);

    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ password }),
      });

      if (res.ok) {
        onLoginSuccess();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-body" data-theme="light" style={{ minHeight: '100vh' }}>
      <main className="auth-shell">
        <section className="auth-context">
          <div className="auth-brand">
            <img
              className="auth-logo"
              src="/assets/web/zetdns-logo-adaptive.svg"
              alt="SuperDNS · DNS Trust+ Nusantara"
            />
          </div>
          <div className="auth-copy">
            <span className="overline">Private control plane</span>
            <h1>Operate DNS policy with confidence.</h1>
            <p>
              Monitor resolver health, enforce filtering policy, and audit every operational
              change from one secure workspace.
            </p>
          </div>
          <div className="auth-signals">
            <div>
              <i></i>
              <span>
                <strong>Recursive DNS</strong>
                <small>Validated resolution</small>
              </span>
            </div>
            <div>
              <i></i>
              <span>
                <strong>Policy database</strong>
                <small>Atomic synchronization</small>
              </span>
            </div>
            <div>
              <i></i>
              <span>
                <strong>Operator audit</strong>
                <small>Tracked actions</small>
              </span>
            </div>
          </div>
        </section>
        <section className="auth-panel">
          <div className="auth-form-wrap">
            <span className="overline">Administrator access</span>
            <h2>Welcome back</h2>
            <p>Enter the dashboard password to continue.</p>

            {error && (
              <div className="form-alert">
                <strong>Sign in failed</strong>
                <span>The password you entered is not valid.</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                minLength={12}
                autoComplete="current-password"
                required
                autoFocus
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="submit" className="button primary" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in to dashboard'}
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
};

