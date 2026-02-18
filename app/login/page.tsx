'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmail, getSession } from '@/services/auth';
import { isSupabaseReady, supabase } from '@/lib/supabaseClient';
import { getRoleRedirectPath } from '@/hooks/useProfile';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@nadiplan.test');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [supabaseConfigured, setSupabaseConfigured] = useState(true);
  const [bootstrapStatus, setBootstrapStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [bootstrapMessage, setBootstrapMessage] = useState<string | null>(null);
  const [showBootstrap, setShowBootstrap] = useState(false);

  useEffect(() => {
    const configured = isSupabaseReady();
    setSupabaseConfigured(configured);

    if (!configured) {
      console.error('Supabase not configured - env vars missing');
      setCheckingSession(false);
      return;
    }

    async function checkExistingSession() {
      try {
        const session = await getSession();
        if (session?.user && session?.access_token && session?.refresh_token) {
          await fetch('/api/auth/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            }),
            credentials: 'include',
          });
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();
          const redirectPath = getRoleRedirectPath(profile?.role || null);
          router.replace(redirectPath);
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

  async function checkBootstrapStatus(userId: string): Promise<{ needsBootstrap: boolean; role: string | null }> {
    try {
      const { data: profiles, error } = await supabase.from('profiles').select('id').limit(1);
      if (error) return { needsBootstrap: true, role: null };
      if (!profiles || profiles.length === 0) return { needsBootstrap: true, role: null };
      const { data: userProfile } = await supabase.from('profiles').select('role').eq('id', userId).single();
      return { needsBootstrap: false, role: userProfile?.role || null };
    } catch {
      return { needsBootstrap: false, role: null };
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!supabaseConfigured) {
      setErrorMsg('Authentication service is not configured. Environment variables are missing.');
      return;
    }
    setLoading(true);
    try {
      const session = await signInWithEmail(email, password);
      if (session?.user && session?.session) {
        await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: session.session.access_token,
            refresh_token: session.session.refresh_token,
          }),
          credentials: 'include',
        });
        const { needsBootstrap, role } = await checkBootstrapStatus(session.user.id);
        if (needsBootstrap) {
          setShowBootstrap(true);
          setLoading(false);
          return;
        }
        router.replace(getRoleRedirectPath(role));
      }
    } catch (error: unknown) {
      let message = 'Failed to sign in.';
      if (error instanceof Error) {
        if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
          message = 'Unable to connect to authentication service. Please check your internet connection.';
        } else if (error.message.includes('Invalid login credentials')) {
          message = 'Invalid email or password. Please try again.';
        } else {
          message = error.message;
        }
      }
      setErrorMsg(message);
      setLoading(false);
    }
  }

  async function handleBootstrap() {
    setBootstrapStatus('loading');
    setBootstrapMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setBootstrapStatus('error');
        setBootstrapMessage('Not authenticated');
        return;
      }
      const response = await fetch('/api/bootstrap', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (!response.ok) {
        setBootstrapStatus('error');
        setBootstrapMessage(data.error || 'Bootstrap failed');
        return;
      }
      setBootstrapStatus('success');
      setBootstrapMessage(data.message);
      setShowBootstrap(false);
      setTimeout(() => router.replace('/app/admin'), 1500);
    } catch (err) {
      setBootstrapStatus('error');
      setBootstrapMessage(err instanceof Error ? err.message : 'Bootstrap failed');
    }
  }

  if (checkingSession) {
    return (
      <main className="hr-page warm-bg min-h-screen flex flex-col items-center justify-center pt-20">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <p className="hr-page__subtitle">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="hr-page warm-bg min-h-screen flex flex-col items-center pt-20 pb-12" style={{ maxWidth: 420, margin: '0 auto' }}>
      <h1 className="hr-page__title">Sign in</h1>
      <p className="hr-page__subtitle">
        Use your Nadiplan account to access HR dashboards.
      </p>

      <form onSubmit={handleSubmit} className="hr-card" style={{ marginTop: 16, width: '100%' }}>
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
          <p className="hr-error" style={{ marginTop: 8 }} data-testid="error-message">{errorMsg}</p>
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

      {showBootstrap && (
        <div className="hr-card" style={{ marginTop: 16, padding: 16, width: '100%' }} data-testid="bootstrap-section">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Admin Setup Required</h3>
          <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', marginBottom: 12 }}>
            No admin user exists. Click below to become the first admin.
          </p>
          {bootstrapMessage && (
            <p
              className={bootstrapStatus === 'error' ? 'hr-error' : 'hr-success'}
              style={{ marginBottom: 8, fontSize: 13 }}
              data-testid="bootstrap-message"
            >
              {bootstrapMessage}
            </p>
          )}
          <button
            onClick={handleBootstrap}
            disabled={bootstrapStatus === 'loading' || bootstrapStatus === 'success'}
            className="hr-button hr-button--secondary"
            style={{ width: '100%' }}
            data-testid="button-bootstrap"
          >
            {bootstrapStatus === 'loading' ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Running Bootstrap...
              </span>
            ) : bootstrapStatus === 'success' ? 'Bootstrap Complete!' : 'Run Admin Bootstrap'}
          </button>
        </div>
      )}

      <p style={{ marginTop: 16, fontSize: 13, color: 'hsl(var(--muted-foreground))', textAlign: 'center' }}>
        Don&apos;t have an account?{' '}
        <a href="/signup" style={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }} data-testid="link-signup">
          Sign up
        </a>
      </p>
      {process.env.NODE_ENV !== "production" && (
        <p style={{ marginTop: 8, fontSize: 12, color: 'hsl(var(--muted-foreground))', textAlign: 'center' }}>
          <a href="/health" style={{ textDecoration: 'underline' }} data-testid="link-health">System Health Check</a>
        </p>
      )}
    </main>
  );
}
