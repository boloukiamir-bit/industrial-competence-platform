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
  });

  it('renders the login form with "Sign in" title', async () => {
    await act(async () => {
      render(<LoginPage />);
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    });
  });

  it('renders email and password inputs', async () => {
    await act(async () => {
      render(<LoginPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('input-email')).toBeInTheDocument();
      expect(screen.getByTestId('input-password')).toBeInTheDocument();
    });
  });

  it('renders the sign in button', async () => {
    await act(async () => {
      render(<LoginPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('button-signin')).toBeInTheDocument();
      expect(screen.getByTestId('button-signin')).toHaveTextContent('Sign in');
    });
  });

  it('calls signInWithEmail on form submission', async () => {
    (authService.signInWithEmail as jest.Mock).mockResolvedValue({ user: { email: 'test@example.com' } });

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
      expect(authService.signInWithEmail).toHaveBeenCalledWith('user@test.com', 'password123');
    });
  });

  it('shows error message when login fails', async () => {
    (authService.signInWithEmail as jest.Mock).mockRejectedValue(new Error('Invalid credentials'));

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
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
      expect(screen.getByTestId('error-message')).toHaveTextContent('Invalid credentials');
    });
  });

  it('shows loading state during form submission', async () => {
    let resolveLogin: (value: unknown) => void;
    const loginPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });
    (authService.signInWithEmail as jest.Mock).mockReturnValue(loginPromise);

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
      resolveLogin!({ user: { email: 'user@test.com' } });
    });
  });
});
