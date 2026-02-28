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

  it('renders email input and send magic link button (no password)', async () => {
    await act(async () => {
      render(<LoginPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('input-email')).toBeInTheDocument();
      expect(screen.getByTestId('button-signin')).toBeInTheDocument();
      expect(screen.getByTestId('button-signin')).toHaveTextContent('Send magic link');
    });
    expect(screen.queryByTestId('input-password')).not.toBeInTheDocument();
  });

  it('calls signInWithOtp on form submission', async () => {
    (authService.signInWithOtp as jest.Mock).mockResolvedValue({});

    await act(async () => {
      render(<LoginPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('input-email')).toBeInTheDocument();
    });

    const emailInput = screen.getByTestId('input-email');
    const submitButton = screen.getByTestId('button-signin');

    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'user@test.com' } });
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(authService.signInWithOtp).toHaveBeenCalledWith('user@test.com');
    });
  });

  it('shows error message when send link fails', async () => {
    (authService.signInWithOtp as jest.Mock).mockResolvedValue({
      error: { message: 'Invalid credentials' },
    });

    await act(async () => {
      render(<LoginPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('input-email')).toBeInTheDocument();
    });

    const emailInput = screen.getByTestId('input-email');
    const submitButton = screen.getByTestId('button-signin');

    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'user@test.com' } });
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
      expect(screen.getByTestId('error-message')).toHaveTextContent('Invalid credentials');
    });
  });

  it('shows deterministic success message after sending link', async () => {
    (authService.signInWithOtp as jest.Mock).mockResolvedValue({});

    await act(async () => {
      render(<LoginPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('input-email')).toBeInTheDocument();
    });

    const emailInput = screen.getByTestId('input-email');
    const submitButton = screen.getByTestId('button-signin');

    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'user@test.com' } });
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('success-message')).toBeInTheDocument();
      expect(screen.getByTestId('success-message')).toHaveTextContent(
        'If an account exists, we sent a sign-in link.'
      );
    });
  });

  it('shows loading state during send', async () => {
    let resolveSend: (value: { error?: { message: string } }) => void;
    const sendPromise = new Promise<{ error?: { message: string } }>((resolve) => {
      resolveSend = resolve;
    });
    (authService.signInWithOtp as jest.Mock).mockReturnValue(sendPromise);

    await act(async () => {
      render(<LoginPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('input-email')).toBeInTheDocument();
    });

    const emailInput = screen.getByTestId('input-email');
    const submitButton = screen.getByTestId('button-signin');

    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'user@test.com' } });
      fireEvent.click(submitButton);
    });

    expect(screen.getByTestId('button-signin')).toHaveTextContent('Sending');

    await act(async () => {
      resolveSend!({});
    });
  });
});
