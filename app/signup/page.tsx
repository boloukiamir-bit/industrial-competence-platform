'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseReady } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabaseConfigured = isSupabaseReady();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!supabaseConfigured) {
      setErrorMsg('Authentication service is not configured.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('already registered')) {
          setErrorMsg('This email is already registered. Please sign in instead.');
        } else if (error.message.includes('valid email')) {
          setErrorMsg('Please enter a valid email address.');
        } else {
          setErrorMsg(error.message);
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        setSuccess(true);
        setTimeout(() => {
          router.replace('/app/org/select');
        }, 1500);
      }
    } catch (error: unknown) {
      console.error('Sign up error:', error);
      setErrorMsg(error instanceof Error ? error.message : 'Failed to sign up.');
      setLoading(false);
    }
  }

  if (success) {
    return (
      <main className="hr-page" style={{ maxWidth: 420, margin: '0 auto', paddingTop: 80 }}>
        <div className="hr-card" style={{ textAlign: 'center', padding: 32 }}>
          <div className="flex items-center justify-center gap-2 mb-4">
            <Loader2 className="w-5 h-5 animate-spin text-green-600" />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Account Created!</h2>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
            Redirecting to organization selection...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="hr-page" style={{ maxWidth: 420, margin: '0 auto', paddingTop: 80 }}>
      <h1 className="hr-page__title">Create Account</h1>
      <p className="hr-page__subtitle">
        Sign up for Nadiplan to manage your industrial competencies.
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
            autoComplete="new-password"
            required
            minLength={6}
            data-testid="input-password"
          />
          <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
            Minimum 6 characters
          </p>
        </div>

        <div className="hr-form-field">
          <label className="hr-form-label">Confirm Password</label>
          <input
            type="password"
            className="hr-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
            data-testid="input-confirm-password"
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
          data-testid="button-signup"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p style={{ marginTop: 16, fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center' }}>
        Already have an account?{' '}
        <Link href="/login" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }} data-testid="link-login">
          Sign in
        </Link>
      </p>

      <p style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
        <Link href="/pricing" style={{ textDecoration: 'underline' }} data-testid="link-pricing">
          View Pricing
        </Link>
      </p>
    </main>
  );
}
