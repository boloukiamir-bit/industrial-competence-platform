'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseReady } from '@/lib/supabaseClient';
import { getSession } from '@/services/auth';
import { Loader2 } from 'lucide-react';
import { LoginShell2030 } from '@/components/auth/LoginShell2030';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

const MIN_PASSWORD_LENGTH = 12;
const DEFAULT_POST_RESET_PATH = '/app/cockpit';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    if (!isSupabaseReady()) {
      setCheckingSession(false);
      return;
    }
    getSession()
      .then((session) => {
        setHasSession(!!session?.user);
        setCheckingSession(false);
      })
      .catch(() => {
        setCheckingSession(false);
      });
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMsg(null);

      if (password.length < MIN_PASSWORD_LENGTH) {
        setErrorMsg(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.');
        return;
      }

      setLoading(true);
      try {
        const { error } = await supabase.auth.updateUser({ password });
        setLoading(false);
        if (error) {
          setErrorMsg(error.message || 'Failed to update password.');
          return;
        }
        toast({ title: 'Password updated. Signing you in…' });
        router.replace(DEFAULT_POST_RESET_PATH);
      } catch (err) {
        setLoading(false);
        setErrorMsg(err instanceof Error ? err.message : 'Failed to update password.');
      }
    },
    [password, confirmPassword, toast, router]
  );

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

  if (!hasSession) {
    return (
      <LoginShell2030>
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text, #0F172A)' }}>
            Invalid or expired link
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-2, #475569)' }}>
            This reset link is invalid or has expired. Request a new one from the sign-in page.
          </p>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-3, #94A3B8)' }}>
          <Link href="/forgot-password" className="underline" style={{ color: 'var(--color-accent, #1E40AF)' }}>
            Forgot password
          </Link>
          {' · '}
          <Link href="/login" className="underline" style={{ color: 'var(--color-accent, #1E40AF)' }}>
            Sign in
          </Link>
        </p>
      </LoginShell2030>
    );
  }

  return (
    <LoginShell2030>
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text, #0F172A)' }}>
          Set new password
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-3, #94A3B8)' }}>
          Enter a new password (at least {MIN_PASSWORD_LENGTH} characters).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-2, #475569)' }}>
            New password
          </label>
          <input
            type="password"
            className="login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="••••••••"
            required
            minLength={MIN_PASSWORD_LENGTH}
            disabled={loading}
            data-testid="input-password"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-2, #475569)' }}>
            Confirm password
          </label>
          <input
            type="password"
            className="login-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="••••••••"
            required
            minLength={MIN_PASSWORD_LENGTH}
            disabled={loading}
            data-testid="input-confirm-password"
          />
        </div>
        {errorMsg && (
          <p className="text-sm" style={{ color: '#B91C1C' }} data-testid="error-message">
            {errorMsg}
          </p>
        )}
        <button
          type="submit"
          className="w-full py-3 px-4 text-sm font-medium text-white transition-opacity disabled:opacity-50 hover:opacity-90"
          style={{ backgroundColor: 'var(--color-accent, #1E40AF)', borderRadius: '3px' }}
          disabled={loading}
          data-testid="button-submit"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Updating…
            </span>
          ) : (
            'Update password'
          )}
        </button>
      </form>

      <p className="text-sm text-center" style={{ color: 'var(--text-3, #94A3B8)' }}>
        <Link href="/login" className="underline" style={{ color: 'var(--color-accent, #1E40AF)' }}>
          Back to sign in
        </Link>
      </p>
    </LoginShell2030>
  );
}
