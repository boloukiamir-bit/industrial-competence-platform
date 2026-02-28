'use client';

import { useState, useCallback } from 'react';
import { resetPasswordForEmail } from '@/services/auth';
import { isSupabaseReady } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';
import { LoginShell2030 } from '@/components/auth/LoginShell2030';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const supabaseConfigured = isSupabaseReady();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMsg(null);
      const trimmed = email.trim();
      if (!trimmed) {
        setErrorMsg('Please enter your email.');
        return;
      }
      if (!supabaseConfigured) {
        setErrorMsg('Authentication service is not configured.');
        return;
      }

      setLoading(true);
      try {
        const result = await resetPasswordForEmail(trimmed);
        setLoading(false);
        if (result.error) {
          setErrorMsg(result.error.message || 'Request failed.');
          return;
        }
        setSubmitted(true);
      } catch (err) {
        setLoading(false);
        setErrorMsg(err instanceof Error ? err.message : 'Request failed.');
      }
    },
    [email, supabaseConfigured]
  );

  if (submitted) {
    return (
      <LoginShell2030>
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text, #0F172A)' }}>
            Check your email
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-2, #475569)' }} data-testid="forgot-success-message">
            If an account exists, you&apos;ll receive an email with a link to reset your password.
          </p>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-3, #94A3B8)' }}>
          <Link href="/login" className="underline" style={{ color: 'var(--color-accent, #1E40AF)' }}>
            Back to sign in
          </Link>
        </p>
      </LoginShell2030>
    );
  }

  return (
    <LoginShell2030>
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text, #0F172A)' }}>
          Forgot password
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-3, #94A3B8)' }}>
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-2, #475569)' }}>
            Email
          </label>
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
              Sending…
            </span>
          ) : (
            'Send reset link'
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
