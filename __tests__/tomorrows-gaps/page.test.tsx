import '@testing-library/jest-dom';
import { render, screen, waitFor, act } from '@testing-library/react';
import TomorrowsGapsPage from '@/app/app/tomorrows-gaps/page';
import * as competenceService from '@/services/competence';

jest.mock('@/services/competence');

jest.mock('@/hooks/useAuthGuard', () => ({
  useAuthGuard: () => ({ loading: false }),
}));

jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: { value: number; className?: string }) => (
    <div data-testid="progress-bar" data-value={value} className={className}>
      Progress: {value}%
    </div>
  ),
}));

const mockPositionCoverage: competenceService.PositionCoverageSummary[] = [
  {
    positionId: 'pos-1',
    positionName: 'CNC Operator',
    site: 'Gothenburg',
    department: 'Production',
    minHeadcount: 5,
    availableCount: 2,
    gap: 3,
    riskLevel: 'HIGH',
  },
  {
    positionId: 'pos-2',
    positionName: 'Welder',
    site: 'Stockholm',
    department: 'Manufacturing',
    minHeadcount: 3,
    availableCount: 2,
    gap: 1,
    riskLevel: 'MEDIUM',
  },
  {
    positionId: 'pos-3',
    positionName: 'Quality Inspector',
    site: 'Gothenburg',
    department: 'Quality',
    minHeadcount: 2,
    availableCount: 2,
    gap: 0,
    riskLevel: 'LOW',
  },
];

describe('TomorrowsGapsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the page title "Tomorrow\'s Gaps"', async () => {
    (competenceService.getPositionCoverageForDate as jest.Mock).mockResolvedValue([]);

    await act(async () => {
      render(<TomorrowsGapsPage />);
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Tomorrow's Gaps/i })).toBeInTheDocument();
    });
  });

  it('renders the subtitle', async () => {
    (competenceService.getPositionCoverageForDate as jest.Mock).mockResolvedValue([]);

    await act(async () => {
      render(<TomorrowsGapsPage />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Coverage and risk per position/i)).toBeInTheDocument();
    });
  });

  it('displays the date pill with tomorrow\'s date', async () => {
    (competenceService.getPositionCoverageForDate as jest.Mock).mockResolvedValue(mockPositionCoverage);

    await act(async () => {
      render(<TomorrowsGapsPage />);
    });

    await waitFor(() => {
      const datePill = screen.getByTestId('date-pill');
      expect(datePill).toBeInTheDocument();
      expect(datePill).toHaveTextContent(/Analyzing:/);
    });
  });

  it('shows loading state initially', async () => {
    let resolvePromise: (value: competenceService.PositionCoverageSummary[]) => void;
    const promise = new Promise<competenceService.PositionCoverageSummary[]>((resolve) => {
      resolvePromise = resolve;
    });
    (competenceService.getPositionCoverageForDate as jest.Mock).mockReturnValue(promise);

    render(<TomorrowsGapsPage />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

    await act(async () => {
      resolvePromise!(mockPositionCoverage);
    });
  });

  it('shows empty state when no positions have min_headcount defined', async () => {
    (competenceService.getPositionCoverageForDate as jest.Mock).mockResolvedValue([]);

    await act(async () => {
      render(<TomorrowsGapsPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    expect(screen.getByText(/No positions with minimum headcount defined/i)).toBeInTheDocument();
  });

  it('renders position cards when data is available', async () => {
    (competenceService.getPositionCoverageForDate as jest.Mock).mockResolvedValue(mockPositionCoverage);

    await act(async () => {
      render(<TomorrowsGapsPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('positions-grid')).toBeInTheDocument();
    });

    expect(screen.getByText('CNC Operator')).toBeInTheDocument();
    expect(screen.getByText('Welder')).toBeInTheDocument();
    expect(screen.getByText('Quality Inspector')).toBeInTheDocument();
  });

  it('displays risk levels (LOW, MEDIUM, HIGH) for positions', async () => {
    (competenceService.getPositionCoverageForDate as jest.Mock).mockResolvedValue(mockPositionCoverage);

    await act(async () => {
      render(<TomorrowsGapsPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('positions-grid')).toBeInTheDocument();
    });

    expect(screen.getByTestId('risk-badge-high')).toBeInTheDocument();
    expect(screen.getByTestId('risk-badge-medium')).toBeInTheDocument();
    expect(screen.getByTestId('risk-badge-low')).toBeInTheDocument();

    expect(screen.getByTestId('risk-badge-high')).toHaveTextContent('HIGH');
    expect(screen.getByTestId('risk-badge-medium')).toHaveTextContent('MEDIUM');
    expect(screen.getByTestId('risk-badge-low')).toHaveTextContent('LOW');
  });

  it('displays gap and minHeadcount values', async () => {
    (competenceService.getPositionCoverageForDate as jest.Mock).mockResolvedValue(mockPositionCoverage);

    await act(async () => {
      render(<TomorrowsGapsPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('positions-grid')).toBeInTheDocument();
    });

    const positionCards = screen.getAllByText(/Min Required/i);
    expect(positionCards.length).toBe(3);

    const gapLabels = screen.getAllByText(/^Gap$/);
    expect(gapLabels.length).toBe(3);

    const fullyCompetentLabels = screen.getAllByText(/Fully Competent/i);
    expect(fullyCompetentLabels.length).toBe(3);
  });

  it('displays KPI summary with correct counts', async () => {
    (competenceService.getPositionCoverageForDate as jest.Mock).mockResolvedValue(mockPositionCoverage);

    await act(async () => {
      render(<TomorrowsGapsPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('summary-kpis')).toBeInTheDocument();
    });

    expect(screen.getByText('Total Positions')).toBeInTheDocument();
    expect(screen.getByText('High Risk')).toBeInTheDocument();
    expect(screen.getByText('Medium Risk')).toBeInTheDocument();
    expect(screen.getByText('Low Risk')).toBeInTheDocument();
    expect(screen.getByText('Total Missing Headcount')).toBeInTheDocument();
  });

  it('shows error message when data fails to load', async () => {
    (competenceService.getPositionCoverageForDate as jest.Mock).mockRejectedValue(new Error('Network error'));

    await act(async () => {
      render(<TomorrowsGapsPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });

    expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to load gap analysis data');
  });

  it('displays site and department for positions', async () => {
    (competenceService.getPositionCoverageForDate as jest.Mock).mockResolvedValue(mockPositionCoverage);

    await act(async () => {
      render(<TomorrowsGapsPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('positions-grid')).toBeInTheDocument();
    });

    const gothenburgElements = screen.getAllByText('Gothenburg');
    expect(gothenburgElements.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText('Stockholm')).toBeInTheDocument();
    expect(screen.getByText('Production')).toBeInTheDocument();
    expect(screen.getByText('Manufacturing')).toBeInTheDocument();

    const qualityElements = screen.getAllByText('Quality');
    expect(qualityElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders progress bars for coverage percentage', async () => {
    (competenceService.getPositionCoverageForDate as jest.Mock).mockResolvedValue(mockPositionCoverage);

    await act(async () => {
      render(<TomorrowsGapsPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('positions-grid')).toBeInTheDocument();
    });

    const progressBars = screen.getAllByTestId('progress-bar');
    expect(progressBars.length).toBe(3);
  });

  it('renders link to competence matrix for each position', async () => {
    (competenceService.getPositionCoverageForDate as jest.Mock).mockResolvedValue(mockPositionCoverage);

    await act(async () => {
      render(<TomorrowsGapsPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('positions-grid')).toBeInTheDocument();
    });

    expect(screen.getByTestId('link-matrix-pos-1')).toBeInTheDocument();
    expect(screen.getByTestId('link-matrix-pos-2')).toBeInTheDocument();
    expect(screen.getByTestId('link-matrix-pos-3')).toBeInTheDocument();
  });
});
