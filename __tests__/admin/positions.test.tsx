import '@testing-library/jest-dom';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PositionsAdminPage from '@/app/admin/positions/page';
import * as adminCompetenceService from '@/services/adminCompetence';

jest.mock('@/services/adminCompetence');

jest.mock('@/hooks/useAuthGuard', () => ({
  useAuthGuard: () => ({ loading: false }),
}));

jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

const mockPositions: adminCompetenceService.PositionAdmin[] = [
  {
    id: 'pos-1',
    name: 'CNC Operator',
    description: 'Operates CNC machines',
    site: 'Gothenburg',
    department: 'Production',
    min_headcount: null,
  },
  {
    id: 'pos-2',
    name: 'Welder',
    description: null,
    site: 'Stockholm',
    department: 'Assembly',
    min_headcount: null,
  },
  {
    id: 'pos-3',
    name: 'Quality Inspector',
    description: 'Inspects product quality',
    site: null,
    department: 'Quality',
    min_headcount: null,
  },
];

describe('PositionsAdminPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (adminCompetenceService.listPositions as jest.Mock).mockResolvedValue(mockPositions);
  });

  it('renders the page title "Positions"', async () => {
    await act(async () => {
      render(<PositionsAdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Positions$/i })).toBeInTheDocument();
    });
  });

  it('renders the subtitle describing the page purpose', async () => {
    await act(async () => {
      render(<PositionsAdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Define roles, their headcount targets/i)).toBeInTheDocument();
    });
  });

  it('displays the positions panel with position names', async () => {
    await act(async () => {
      render(<PositionsAdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('panel-positions')).toBeInTheDocument();
    });

    expect(screen.getByText('CNC Operator')).toBeInTheDocument();
    expect(screen.getByText('Welder')).toBeInTheDocument();
    expect(screen.getByText('Quality Inspector')).toBeInTheDocument();
  });

  it('displays position descriptions when available', async () => {
    await act(async () => {
      render(<PositionsAdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Operates CNC machines')).toBeInTheDocument();
      expect(screen.getByText('Inspects product quality')).toBeInTheDocument();
    });
  });

  it('displays site and department columns', async () => {
    await act(async () => {
      render(<PositionsAdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Gothenburg')).toBeInTheDocument();
      expect(screen.getByText('Stockholm')).toBeInTheDocument();
      expect(screen.getByText('Production')).toBeInTheDocument();
      expect(screen.getByText('Assembly')).toBeInTheDocument();
      expect(screen.getByText('Quality')).toBeInTheDocument();
    });
  });

  it('displays the create position panel', async () => {
    await act(async () => {
      render(<PositionsAdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('panel-create-position')).toBeInTheDocument();
    });

    expect(screen.getByText('Create New Position')).toBeInTheDocument();
  });

  it('displays form fields for creating a position', async () => {
    await act(async () => {
      render(<PositionsAdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('input-position-name')).toBeInTheDocument();
      expect(screen.getByTestId('input-position-description')).toBeInTheDocument();
      expect(screen.getByTestId('input-position-site')).toBeInTheDocument();
      expect(screen.getByTestId('input-position-department')).toBeInTheDocument();
      expect(screen.getByTestId('input-position-min-headcount')).toBeInTheDocument();
    });
  });

  it('displays the create position button', async () => {
    await act(async () => {
      render(<PositionsAdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('button-create-position')).toBeInTheDocument();
    });
  });

  it('displays edit requirements buttons for each position', async () => {
    await act(async () => {
      render(<PositionsAdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('button-requirements-pos-1')).toBeInTheDocument();
      expect(screen.getByTestId('button-requirements-pos-2')).toBeInTheDocument();
      expect(screen.getByTestId('button-requirements-pos-3')).toBeInTheDocument();
    });
  });

  it('calls listPositions on mount', async () => {
    await act(async () => {
      render(<PositionsAdminPage />);
    });

    await waitFor(() => {
      expect(adminCompetenceService.listPositions).toHaveBeenCalled();
    });
  });

  it('shows error message when data fails to load', async () => {
    (adminCompetenceService.listPositions as jest.Mock).mockRejectedValue(new Error('Network error'));

    await act(async () => {
      render(<PositionsAdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Failed to load positions/i)).toBeInTheDocument();
    });
  });

  it('shows empty state message when no positions exist', async () => {
    (adminCompetenceService.listPositions as jest.Mock).mockResolvedValue([]);

    await act(async () => {
      render(<PositionsAdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByText(/No positions yet/i)).toBeInTheDocument();
    });
  });

  it('calls createPosition when form is submitted with valid data', async () => {
    const user = userEvent.setup();
    (adminCompetenceService.createPosition as jest.Mock).mockResolvedValue(undefined);

    await act(async () => {
      render(<PositionsAdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('input-position-name')).toBeInTheDocument();
    });

    await user.type(screen.getByTestId('input-position-name'), 'New Position');
    await user.type(screen.getByTestId('input-position-site'), 'Test Site');
    await user.click(screen.getByTestId('button-create-position'));

    await waitFor(() => {
      expect(adminCompetenceService.createPosition).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Position',
          site: 'Test Site',
        })
      );
    });
  });

  it('shows alert when trying to create position without name', async () => {
    const user = userEvent.setup();
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

    await act(async () => {
      render(<PositionsAdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('button-create-position')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('button-create-position'));

    expect(alertSpy).toHaveBeenCalledWith('Name is required');
    alertSpy.mockRestore();
  });
});
