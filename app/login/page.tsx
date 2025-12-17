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
        if (session?.user) {
          // Get user role and redirect accordingly
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

  async function checkBootstrapNeeded(userId: string) {
    try {
      // Check if profiles table has any entries
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);

      if (error) {
        // Table might not exist - show bootstrap
        setShowBootstrap(true);
        return null;
      }

      if (!profiles || profiles.length === 0) {
        // No profiles exist - this user can bootstrap
        setShowBootstrap(true);
        return null;
      }

      // Check if current user has a profile
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      return userProfile?.role || null;
    } catch {
      return null;
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
      
      if (session?.user) {
        // Check if bootstrap is needed or get role
        const role = await checkBootstrapNeeded(session.user.id);
        
        if (showBootstrap) {
          // Stay on login page to show bootstrap option
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
      <main className="hr-page" style={{ maxWidth: 420, margin: '0 auto', paddingTop: 80 }}>
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <p className="hr-page__subtitle">Loading...</p>
        </div>
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

      {showBootstrap && (
        <div className="hr-card" style={{ marginTop: 16, padding: 16 }} data-testid="bootstrap-section">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            Admin Setup Required
          </h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
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
            ) : bootstrapStatus === 'success' ? (
              'Bootstrap Complete!'
            ) : (
              'Run Admin Bootstrap'
            )}
          </button>
        </div>
      )}

      <p style={{ marginTop: 16, fontSize: 12, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
        <a href="/health" style={{ textDecoration: 'underline' }} data-testid="link-health">
          System Health Check
        </a>
      </p>
    </main>
  );
}
