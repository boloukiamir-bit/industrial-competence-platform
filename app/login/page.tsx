'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmail, getSession } from '@/services/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@nadiplan.test');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    async function checkExistingSession() {
      try {
        const session = await getSession();
        if (session?.user) {
          router.replace('/app/hr/tasks');
        } else {
          setCheckingSession(false);
        }
      } catch (err) {
        console.error('Session check failed:', err);
        setCheckingSession(false);
      }
    }
    checkExistingSession();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      await signInWithEmail(email, password);
      router.replace('/app/hr/tasks');
    } catch (error: unknown) {
      console.error(error);
      let message = 'Failed to sign in.';
      if (error instanceof Error) {
        if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
          message = 'Network error. Please check your internet connection and try again.';
        } else {
          message = error.message;
        }
      }
      setErrorMsg(message);
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="hr-page" style={{ maxWidth: 420, margin: '0 auto', paddingTop: 80 }}>
        <p className="hr-page__subtitle">Loading...</p>
      </main>
    );
  }

  return (
    <main className="hr-page" style={{ maxWidth: 420, margin: '0 auto', paddingTop: 80 }}>
      <h1 className="hr-page__title">Sign in</h1>
      <p className="hr-page__subtitle">
        Use your Nadiplan account to access HR dashboards.
      </p>

      <form onSubmit={handleSubmit} className="hr-card" style={{ marginTop: 16 }}>
        <div className="hr-form-field">
          <label className="hr-form-label">Email</label>
          <input
            type="email"
            className="hr-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            data-testid="input-email"
          />
        </div>

        <div className="hr-form-field">
          <label className="hr-form-label">Password</label>
          <input
            type="password"
            className="hr-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            data-testid="input-password"
          />
        </div>

        {errorMsg && (
          <p className="hr-error" style={{ marginTop: 8 }} data-testid="error-message">
            {errorMsg}
          </p>
        )}

        <button
          type="submit"
          className="hr-button hr-button--primary"
          disabled={loading}
          style={{ marginTop: 12, width: '100%' }}
          data-testid="button-signin"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
