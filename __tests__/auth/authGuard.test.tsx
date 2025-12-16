import '@testing-library/jest-dom';
import { render, screen, waitFor, act } from '@testing-library/react';
import * as authService from '@/services/auth';

jest.mock('@/services/auth');

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

import { useAuthGuard } from '@/hooks/useAuthGuard';

function TestComponent() {
  const { loading } = useAuthGuard();

  if (loading) {
    return <div data-testid="loading">Loading...</div>;
  }

  return <div data-testid="content">Protected Content</div>;
}

describe('useAuthGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state while checking auth', async () => {
    let resolveAuth: (value: unknown) => void;
    const authPromise = new Promise((resolve) => {
      resolveAuth = resolve;
    });
    (authService.getAuthUser as jest.Mock).mockReturnValue(authPromise);

    await act(async () => {
      render(<TestComponent />);
    });

    expect(screen.getByTestId('loading')).toBeInTheDocument();

    await act(async () => {
      resolveAuth!(null);
    });
  });

  it('redirects to /login when user is null', async () => {
    (authService.getAuthUser as jest.Mock).mockResolvedValue(null);

    await act(async () => {
      render(<TestComponent />);
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('renders content when user is authenticated', async () => {
    (authService.getAuthUser as jest.Mock).mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
    });

    await act(async () => {
      render(<TestComponent />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('content')).toBeInTheDocument();
      expect(screen.getByTestId('content')).toHaveTextContent('Protected Content');
    });
  });

  it('does not redirect when user is authenticated', async () => {
    (authService.getAuthUser as jest.Mock).mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
    });

    await act(async () => {
      render(<TestComponent />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects to /login when getAuthUser throws an error', async () => {
    (authService.getAuthUser as jest.Mock).mockRejectedValue(new Error('Auth error'));

    await act(async () => {
      render(<TestComponent />);
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });
});
