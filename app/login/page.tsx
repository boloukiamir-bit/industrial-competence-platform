'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmail, getSession } from '@/services/auth';
import { isSupabaseReady, supabase } from '@/lib/supabaseClient';
import { getRoleRedirectPath } from '@/hooks/useProfile';
import { Loader2 } from 'lucide-react';
import { LoginShell2030 } from '@/components/auth/LoginShell2030';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
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
          // Sync to cookies so /api/* can read auth, then redirect
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
      // Check if profiles table has any entries
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);

      if (error) {
        // Table might not exist - needs bootstrap
        return { needsBootstrap: true, role: null };
      }

      if (!profiles || profiles.length === 0) {
        // No profiles exist - this user can bootstrap
        return { needsBootstrap: true, role: null };
      }

      // Check if current user has a profile
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

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
        // Sync session to cookies so /api/* routes can read auth
        await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: session.session.access_token,
            refresh_token: session.session.refresh_token,
          }),
          credentials: 'include',
        });

        // Check if bootstrap is needed or get role
        const { needsBootstrap, role } = await checkBootstrapStatus(session.user.id);
        
        if (needsBootstrap) {
          // Stay on login page to show bootstrap option
          setShowBootstrap(true);
          setLoading(false);
          return;
        }

        // Redirect based on role
        const redirectPath = getRoleRedirectPath(role);
        router.replace(redirectPath);
      }
    } catch (error: unknown) {
      console.error('Sign in error:', error);
      let message = 'Failed to sign in.';
      if (error instanceof Error) {
        if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
          message = 'Unable to connect to authentication service. Please check your internet connection.';
        } else if (error.message.includes('placeholder')) {
          message = 'Authentication service is not configured. Please contact support.';
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
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
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

      // Redirect to admin dashboard
      setTimeout(() => {
        router.replace('/app/admin');
      }, 1500);
    } catch (err) {
      setBootstrapStatus('error');
      setBootstrapMessage(err instanceof Error ? err.message : 'Bootstrap failed');
    }
  }

  if (checkingSession) {
    return (
      <LoginShell2030>
        <div className="flex items-center justify-center gap-2 text-muted-foreground py-12">
          <Loader2 className="w-4 h-4 animate-spin" />
          <p className="text-sm">Loading...</p>
        </div>
      </LoginShell2030>
    );
  }

  return (
    <LoginShell2030>
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text, #0F172A)' }}>Sign in</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-3, #94A3B8)' }}>
          Access the governance platform.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-2, #475569)' }}>Email</label>
          <input
            type="email"
            className="login-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@company.com"
            required
            data-testid="input-email"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-2, #475569)' }}>Password</label>
          <input
            type="password"
            className="login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            data-testid="input-password"
          />
        </div>
        {errorMsg && (
          <p className="text-sm" style={{ color: '#B91C1C' }} data-testid="error-message">{errorMsg}</p>
        )}
        <button
          type="submit"
          className="w-full py-3 px-4 text-sm font-medium text-white transition-opacity disabled:opacity-50 hover:opacity-90"
          style={{ backgroundColor: 'var(--accent, #1E40AF)', borderRadius: '3px' }}
          disabled={loading}
          data-testid="button-signin"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {showBootstrap && (
        <div className="flex flex-col gap-3 p-5 border" style={{ borderColor: 'var(--border, #E5EAF0)', borderRadius: '3px' }} data-testid="bootstrap-section">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text, #0F172A)' }}>Admin Setup Required</h3>
          <p className="text-sm" style={{ color: 'var(--text-2, #475569)' }}>
            No admin user exists. Click below to become the first admin.
          </p>
          {bootstrapMessage && (
            <p
              className="text-sm"
              style={{ color: bootstrapStatus === 'error' ? '#B91C1C' : 'var(--text, #0F172A)' }}
              data-testid="bootstrap-message"
            >
              {bootstrapMessage}
            </p>
          )}
          <button
            onClick={handleBootstrap}
            disabled={bootstrapStatus === 'loading' || bootstrapStatus === 'success'}
            className="w-full py-2.5 px-4 text-sm font-medium border transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ borderColor: 'var(--border, #E5EAF0)', borderRadius: '3px', color: 'var(--text, #0F172A)' }}
            data-testid="button-bootstrap"
          >
            {bootstrapStatus === 'loading' ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Running Bootstrap...
              </span>
            ) : bootstrapStatus === 'success' ? (
              'Bootstrap Complete!'
            ) : (
              'Run Admin Bootstrap'
            )}
          </button>
        </div>
      )}

      <p className="text-sm text-center" style={{ color: 'var(--text-3, #94A3B8)' }}>
        Don&apos;t have an account?{' '}
        <a href="/signup" className="underline" style={{ color: 'var(--accent, #1E40AF)' }} data-testid="link-signup">Sign up</a>
      </p>
      {process.env.NODE_ENV !== "production" && (
        <p className="text-xs text-center" style={{ color: 'var(--text-3, #94A3B8)' }}>
          <a href="/health" className="underline" data-testid="link-health">System Health Check</a>
        </p>
      )}
    </LoginShell2030>
  );
}
