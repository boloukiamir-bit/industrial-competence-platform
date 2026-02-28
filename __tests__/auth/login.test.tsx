import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import LoginPage from '@/app/login/page';
import * as authService from '@/services/auth';

jest.mock('@/services/auth');
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (authService.getSession as jest.Mock).mockResolvedValue(null);
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  it('renders the login form with "Sign in" title', async () => {
    await act(async () => {
      render(<LoginPage />);
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    });
  });

  it('renders email and password inputs and Sign in button', async () => {
    await act(async () => {
      render(<LoginPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('input-email')).toBeInTheDocument();
      expect(screen.getByTestId('input-password')).toBeInTheDocument();
      expect(screen.getByTestId('button-signin')).toBeInTheDocument();
      expect(screen.getByTestId('button-signin')).toHaveTextContent('Sign in');
    });
    expect(screen.getByTestId('link-forgot-password')).toHaveAttribute('href', '/forgot-password');
  });

  it('calls signInWithPassword on form submission', async () => {
    (authService.signInWithPassword as jest.Mock).mockResolvedValue({
      session: { access_token: 'at', refresh_token: 'rt' },
    });

    await act(async () => {
      render(<LoginPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('input-email')).toBeInTheDocument();
    });

    const emailInput = screen.getByTestId('input-email');
    const passwordInput = screen.getByTestId('input-password');
    const submitButton = screen.getByTestId('button-signin');

    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'user@test.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(authService.signInWithPassword).toHaveBeenCalledWith('user@test.com', 'password123');
    });
  });

  it('shows error message when sign in fails', async () => {
    (authService.signInWithPassword as jest.Mock).mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    });

    await act(async () => {
      render(<LoginPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('input-email')).toBeInTheDocument();
    });

    const emailInput = screen.getByTestId('input-email');
    const passwordInput = screen.getByTestId('input-password');
    const submitButton = screen.getByTestId('button-signin');

    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'user@test.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrong' } });
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
      expect(screen.getByTestId('error-message')).toHaveTextContent('Invalid login credentials');
    });
  });

  it('shows loading state during sign in', async () => {
    let resolveSignIn: (value: { session?: { access_token: string; refresh_token: string } }) => void;
    const signInPromise = new Promise<{ session?: { access_token: string; refresh_token: string } }>((resolve) => {
      resolveSignIn = resolve;
    });
    (authService.signInWithPassword as jest.Mock).mockReturnValue(signInPromise);

    await act(async () => {
      render(<LoginPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('input-email')).toBeInTheDocument();
    });

    const emailInput = screen.getByTestId('input-email');
    const passwordInput = screen.getByTestId('input-password');
    const submitButton = screen.getByTestId('button-signin');

    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'user@test.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);
    });

    expect(screen.getByTestId('button-signin')).toHaveTextContent('Signing in');

    await act(async () => {
      resolveSignIn!({ session: { access_token: 'at', refresh_token: 'rt' } });
    });
  });
});
