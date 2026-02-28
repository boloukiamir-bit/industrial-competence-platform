'use client';

import { Suspense, useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithOtp, getSession } from '@/services/auth';
import { isSupabaseReady, supabase } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';
import { LoginShell2030 } from '@/components/auth/LoginShell2030';

/** Default landing after login. */
const DEFAULT_POST_LOGIN_PATH = '/app/cockpit';

/** Throttle (seconds) before Send/Resend can be clicked again. */
const THROTTLE_SECONDS = 10;

/**
 * Resolve redirect path after login: honor next= if safe, else cockpit.
 * Prevents redirect to /login (infinite loop) and allows only app paths.
 */
function getRedirectAfterLogin(next: string | null): string {
  const raw = next?.trim();
  if (!raw || raw === '/login' || raw.startsWith('/login?')) return DEFAULT_POST_LOGIN_PATH;
  if (!raw.startsWith('/')) return DEFAULT_POST_LOGIN_PATH;
  if (raw.includes('//') || raw.startsWith('http')) return DEFAULT_POST_LOGIN_PATH;
  return raw;
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState(false);
  const [throttleRemaining, setThrottleRemaining] = useState(0);
  const [checkingSession, setCheckingSession] = useState(true);
  const [supabaseConfigured, setSupabaseConfigured] = useState(true);
  const [bootstrapStatus, setBootstrapStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [bootstrapMessage, setBootstrapMessage] = useState<string | null>(null);
  const [showBootstrap, setShowBootstrap] = useState(false);

  const nextParam = useMemo(() => searchParams.get('next'), [searchParams]);

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
          const redirectPath = getRedirectAfterLogin(nextParam);
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
  }, [router, nextParam]);

  useEffect(() => {
    if (throttleRemaining <= 0) return;
    const t = setInterval(() => {
      setThrottleRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) clearInterval(t);
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [throttleRemaining]);

  async function checkBootstrapStatus(userId: string): Promise<{ needsBootstrap: boolean; role: string | null }> {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);

      if (error) return { needsBootstrap: true, role: null };
      if (!profiles || profiles.length === 0) return { needsBootstrap: true, role: null };

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

  const sendMagicLink = useCallback(async () => {
    setErrorMsg(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setErrorMsg('Please enter your email.');
      return;
    }
    if (!supabaseConfigured) {
      setErrorMsg('Authentication service is not configured. Environment variables are missing.');
      return;
    }

    setLoading(true);
    try {
      const result = await signInWithOtp(trimmed);
      setLoading(false);
      if (result.error) {
        setErrorMsg(result.error.message || 'Failed to send link.');
        return;
      }
      setLinkSent(true);
      setThrottleRemaining(THROTTLE_SECONDS);
    } catch (err) {
      setLoading(false);
      console.error('Magic link error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send link.');
    }
  }, [email, supabaseConfigured]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await sendMagicLink();
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

  const throttleActive = throttleRemaining > 0;
  const primaryCtaLabel = linkSent ? 'Resend link' : 'Send magic link';

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
            disabled={loading}
            data-testid="input-email"
          />
        </div>
        {linkSent && (
          <p className="text-sm" style={{ color: 'var(--text-2, #475569)' }} data-testid="success-message">
            If an account exists, we sent a sign-in link.
          </p>
        )}
        {errorMsg && (
          <p className="text-sm" style={{ color: '#B91C1C' }} data-testid="error-message">{errorMsg}</p>
        )}
        <button
          type="submit"
          className="w-full py-3 px-4 text-sm font-medium text-white transition-opacity disabled:opacity-50 hover:opacity-90"
          style={{ backgroundColor: 'var(--color-accent, #1E40AF)', borderRadius: '3px' }}
          disabled={loading || throttleActive}
          data-testid="button-signin"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending…
            </span>
          ) : throttleActive ? (
            `Wait ${throttleRemaining}s`
          ) : (
            primaryCtaLabel
          )}
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
        <a href="/signup" className="underline" style={{ color: 'var(--color-accent, #1E40AF)' }} data-testid="link-signup">Sign up</a>
      </p>
      {process.env.NODE_ENV !== "production" && (
        <p className="text-xs text-center" style={{ color: 'var(--text-3, #94A3B8)' }}>
          <a href="/health" className="underline" data-testid="link-health">System Health Check</a>
        </p>
      )}
    </LoginShell2030>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <LoginShell2030>
          <div className="flex items-center justify-center gap-2 text-muted-foreground py-12">
            <Loader2 className="w-4 h-4 animate-spin" />
            <p className="text-sm">Loading...</p>
          </div>
        </LoginShell2030>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
