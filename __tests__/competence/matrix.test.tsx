import '@testing-library/jest-dom';
import { render, screen, waitFor, act } from '@testing-library/react';
import CompetenceMatrixPage from '@/app/competence/matrix/page';
import * as competenceService from '@/services/competence';

jest.mock('@/services/competence');

jest.mock('@/hooks/useAuthGuard', () => ({
  useAuthGuard: () => ({ loading: false }),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: any) => (
    <div data-testid="mock-select" data-value={value}>
      {children}
      <button data-testid="mock-select-trigger" onClick={() => onValueChange && onValueChange('pos-1')}>
        Trigger
      </button>
    </div>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => (
    <div data-testid={`option-position-${value}`}>{children}</div>
  ),
  SelectTrigger: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}));

const mockPositions: competenceService.PositionSummary[] = [
  { id: 'pos-1', name: 'CNC Operator', site: 'Gothenburg', department: 'Production' },
  { id: 'pos-2', name: 'Welder', site: 'Gothenburg', department: 'Production' },
  { id: 'pos-3', name: 'Quality Inspector', site: 'Stockholm', department: 'Quality' },
];

const mockEmployees: competenceService.SimpleEmployee[] = [
  { id: 'emp-1', name: 'Anna Lindberg' },
  { id: 'emp-2', name: 'Erik Johansson' },
];

const mockProfile1: competenceService.EmployeeCompetenceProfile = {
  employee: { id: 'emp-1', name: 'Anna Lindberg', positionName: 'CNC Operator' },
  summary: { riskLevel: 'LOW', gapCount: 0, totalRequired: 2, coveragePercent: 100, expiredCount: 0 },
  items: [
    {
      competenceId: 'comp-1',
      competenceName: 'CNC-programmering',
      competenceCode: 'CNC',
      groupName: 'Technical',
      requiredLevel: 3,
      mandatory: true,
      employeeLevel: 3,
      validTo: '2026-01-01',
      status: 'OK',
      riskReason: null,
      isSafetyCritical: false,
    },
    {
      competenceId: 'comp-2',
      competenceName: 'Truckkort',
      competenceCode: 'TK',
      groupName: 'Safety',
      requiredLevel: 2,
      mandatory: true,
      employeeLevel: 2,
      validTo: '2025-06-01',
      status: 'OK',
      riskReason: null,
      isSafetyCritical: true,
    },
  ],
};

const mockProfile2: competenceService.EmployeeCompetenceProfile = {
  employee: { id: 'emp-2', name: 'Erik Johansson', positionName: 'CNC Operator' },
  summary: { riskLevel: 'MEDIUM', gapCount: 1, totalRequired: 2, coveragePercent: 50, expiredCount: 0 },
  items: [
    {
      competenceId: 'comp-1',
      competenceName: 'CNC-programmering',
      competenceCode: 'CNC',
      groupName: 'Technical',
      requiredLevel: 3,
      mandatory: true,
      employeeLevel: 2,
      validTo: '2026-01-01',
      status: 'RISK',
      riskReason: 'Too low level',
      isSafetyCritical: false,
    },
    {
      competenceId: 'comp-2',
      competenceName: 'Truckkort',
      competenceCode: 'TK',
      groupName: 'Safety',
      requiredLevel: 2,
      mandatory: true,
      employeeLevel: null,
      validTo: null,
      status: 'N/A',
      riskReason: 'Missing competence',
      isSafetyCritical: true,
    },
  ],
};

describe('CompetenceMatrixPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the page title "Competence Matrix"', async () => {
    (competenceService.getAllPositions as jest.Mock).mockResolvedValue(mockPositions);

    await act(async () => {
      render(<CompetenceMatrixPage />);
    });

    expect(screen.getByRole('heading', { name: /Competence Matrix/i })).toBeInTheDocument();
  });

  it('renders the positions dropdown after loading', async () => {
    (competenceService.getAllPositions as jest.Mock).mockResolvedValue(mockPositions);

    await act(async () => {
      render(<CompetenceMatrixPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('select-position')).toBeInTheDocument();
    });
  });

  it('displays "Select a position above" prompt when no position is selected', async () => {
    (competenceService.getAllPositions as jest.Mock).mockResolvedValue(mockPositions);

    await act(async () => {
      render(<CompetenceMatrixPage />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Select a position above to view/i)).toBeInTheDocument();
    });
  });

  it('renders matrix table with employee rows and competence columns after selecting a position', async () => {
    (competenceService.getAllPositions as jest.Mock).mockResolvedValue(mockPositions);
    (competenceService.getEmployeesForPosition as jest.Mock).mockResolvedValue(mockEmployees);
    (competenceService.getEmployeeCompetenceProfile as jest.Mock)
      .mockResolvedValueOnce(mockProfile1)
      .mockResolvedValueOnce(mockProfile2);

    await act(async () => {
      render(<CompetenceMatrixPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('select-position')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('mock-select-trigger').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('matrix-table')).toBeInTheDocument();
    });

    expect(screen.getByText('Anna Lindberg')).toBeInTheDocument();
    expect(screen.getByText('Erik Johansson')).toBeInTheDocument();
    expect(screen.getByText(/CNC-program/i)).toBeInTheDocument();
    expect(screen.getByText(/Truckkort/i)).toBeInTheDocument();
  });

  it('shows OK, RISK, and N/A status labels in matrix cells', async () => {
    (competenceService.getAllPositions as jest.Mock).mockResolvedValue(mockPositions);
    (competenceService.getEmployeesForPosition as jest.Mock).mockResolvedValue(mockEmployees);
    (competenceService.getEmployeeCompetenceProfile as jest.Mock)
      .mockResolvedValueOnce(mockProfile1)
      .mockResolvedValueOnce(mockProfile2);

    await act(async () => {
      render(<CompetenceMatrixPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('select-position')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('mock-select-trigger').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('matrix-table')).toBeInTheDocument();
    });

    const statusBadges = screen.getAllByText(/^(OK|RISK|N\/A)$/);
    const statusTexts = statusBadges.map((badge) => badge.textContent);

    expect(statusTexts).toContain('OK');
    expect(statusTexts).toContain('RISK');
    expect(statusTexts).toContain('N/A');
  });

  it('displays employee count after selecting a position', async () => {
    (competenceService.getAllPositions as jest.Mock).mockResolvedValue(mockPositions);
    (competenceService.getEmployeesForPosition as jest.Mock).mockResolvedValue(mockEmployees);
    (competenceService.getEmployeeCompetenceProfile as jest.Mock)
      .mockResolvedValueOnce(mockProfile1)
      .mockResolvedValueOnce(mockProfile2);

    await act(async () => {
      render(<CompetenceMatrixPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('select-position')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('mock-select-trigger').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('text-employee-count')).toBeInTheDocument();
    });

    expect(screen.getByTestId('text-employee-count')).toHaveTextContent('2 employees');
  });

  it('shows error message when positions fail to load', async () => {
    (competenceService.getAllPositions as jest.Mock).mockRejectedValue(new Error('Network error'));

    await act(async () => {
      render(<CompetenceMatrixPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });

    expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to load positions');
  });

  it('shows error message when matrix data fails to load', async () => {
    (competenceService.getAllPositions as jest.Mock).mockResolvedValue(mockPositions);
    (competenceService.getEmployeesForPosition as jest.Mock).mockRejectedValue(new Error('Network error'));

    await act(async () => {
      render(<CompetenceMatrixPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('select-position')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('mock-select-trigger').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });

    expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to load competence matrix');
  });

  it('shows "No employees found" message when position has no employees', async () => {
    (competenceService.getAllPositions as jest.Mock).mockResolvedValue(mockPositions);
    (competenceService.getEmployeesForPosition as jest.Mock).mockResolvedValue([]);

    await act(async () => {
      render(<CompetenceMatrixPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('select-position')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('mock-select-trigger').click();
    });

    await waitFor(() => {
      expect(screen.getByText(/No employees found for this position/i)).toBeInTheDocument();
    });
  });
});
