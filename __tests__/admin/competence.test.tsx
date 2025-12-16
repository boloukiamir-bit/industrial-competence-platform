import '@testing-library/jest-dom';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CompetenceAdminPage from '@/app/admin/competence/page';
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

const mockGroups: adminCompetenceService.CompetenceGroup[] = [
  { id: 'grp-1', name: 'Technical Skills', description: 'Technical competencies', sort_order: 1 },
  { id: 'grp-2', name: 'Safety', description: 'Safety-related certifications', sort_order: 2 },
];

const mockCompetences: adminCompetenceService.Competence[] = [
  {
    id: 'comp-1',
    group_id: 'grp-1',
    code: 'CNC',
    name: 'CNC Programming',
    description: 'CNC machine programming',
    is_safety_critical: false,
    active: true,
  },
  {
    id: 'comp-2',
    group_id: 'grp-2',
    code: 'TK',
    name: 'Forklift License',
    description: 'Truckkort',
    is_safety_critical: true,
    active: true,
  },
  {
    id: 'comp-3',
    group_id: null,
    code: null,
    name: 'General Safety',
    description: null,
    is_safety_critical: false,
    active: false,
  },
];

describe('CompetenceAdminPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (adminCompetenceService.listCompetenceGroups as jest.Mock).mockResolvedValue(mockGroups);
    (adminCompetenceService.listCompetences as jest.Mock).mockResolvedValue(mockCompetences);
  });

  it('renders the page title "Competence Admin"', async () => {
    await act(async () => {
      render(<CompetenceAdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Competence Admin/i })).toBeInTheDocument();
    });
  });

  it('renders the subtitle describing the page purpose', async () => {
    await act(async () => {
      render(<CompetenceAdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Manage competence groups and competences/i)).toBeInTheDocument();
    });
  });

  it('displays the Groups panel with group names', async () => {
    await act(async () => {
      render(<CompetenceAdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('panel-groups')).toBeInTheDocument();
    });

    expect(screen.getByTestId('group-row-grp-1')).toBeInTheDocument();
    expect(screen.getByTestId('group-row-grp-2')).toBeInTheDocument();
    expect(screen.getAllByText('Technical Skills').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Safety').length).toBeGreaterThan(0);
  });

  it('displays the Competences panel with competence names', async () => {
    await act(async () => {
      render(<CompetenceAdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('panel-competences')).toBeInTheDocument();
    });

    expect(screen.getByText('CNC Programming')).toBeInTheDocument();
    expect(screen.getByText('Forklift License')).toBeInTheDocument();
    expect(screen.getByText('General Safety')).toBeInTheDocument();
  });

  it('displays competence codes in the table', async () => {
    await act(async () => {
      render(<CompetenceAdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('CNC')).toBeInTheDocument();
      expect(screen.getByText('TK')).toBeInTheDocument();
    });
  });

  it('shows safety-critical indicator for safety competences', async () => {
    await act(async () => {
      render(<CompetenceAdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('panel-competences')).toBeInTheDocument();
    });

    const safetyIndicators = screen.getAllByText('Yes');
    expect(safetyIndicators.length).toBeGreaterThan(0);
  });

  it('shows active/inactive status for competences', async () => {
    await act(async () => {
      render(<CompetenceAdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('panel-competences')).toBeInTheDocument();
    });

    const activeButtons = screen.getAllByRole('button');
    expect(activeButtons.length).toBeGreaterThan(0);
  });

  it('calls listCompetenceGroups and listCompetences on mount', async () => {
    await act(async () => {
      render(<CompetenceAdminPage />);
    });

    await waitFor(() => {
      expect(adminCompetenceService.listCompetenceGroups).toHaveBeenCalled();
      expect(adminCompetenceService.listCompetences).toHaveBeenCalled();
    });
  });

  it('shows error message when data fails to load', async () => {
    (adminCompetenceService.listCompetenceGroups as jest.Mock).mockRejectedValue(new Error('Network error'));

    await act(async () => {
      render(<CompetenceAdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Failed to load data/i)).toBeInTheDocument();
    });
  });

  it('displays "No groups yet" message when groups list is empty', async () => {
    (adminCompetenceService.listCompetenceGroups as jest.Mock).mockResolvedValue([]);
    (adminCompetenceService.listCompetences as jest.Mock).mockResolvedValue([]);

    await act(async () => {
      render(<CompetenceAdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByText(/No groups yet/i)).toBeInTheDocument();
    });
  });
});
