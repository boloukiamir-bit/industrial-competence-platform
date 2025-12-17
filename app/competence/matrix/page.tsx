'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  getAllPositions,
  getEmployeesForPosition,
  getEmployeeCompetenceProfile,
  PositionSummary,
  MatrixColumn,
  MatrixRow,
} from '@/services/competence';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { Download, Users, AlertTriangle, TrendingUp, Target } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const DEMO_COMPETENCES = [
  { id: 'c1', label: 'Safety Training', requiredLevel: 3, groupName: 'Safety' },
  { id: 'c2', label: 'Machine Operation', requiredLevel: 4, groupName: 'Operations' },
  { id: 'c3', label: 'Quality Control', requiredLevel: 3, groupName: 'Quality' },
  { id: 'c4', label: 'First Aid', requiredLevel: 2, groupName: 'Safety' },
  { id: 'c5', label: 'Forklift Cert', requiredLevel: 3, groupName: 'Logistics' },
  { id: 'c6', label: 'Welding', requiredLevel: 4, groupName: 'Fabrication' },
  { id: 'c7', label: 'CNC Programming', requiredLevel: 3, groupName: 'Operations' },
  { id: 'c8', label: 'Lean Manufacturing', requiredLevel: 2, groupName: 'Process' },
];

const DEMO_EMPLOYEES = [
  { id: 'e1', name: 'Anna Lindqvist', levels: [3, 4, 3, 2, 3, 4, 3, 2] },
  { id: 'e2', name: 'Erik Johansson', levels: [3, 3, 2, 2, 2, 4, 3, 2] },
  { id: 'e3', name: 'Maria Svensson', levels: [2, 4, 3, 1, 3, 3, 2, 2] },
  { id: 'e4', name: 'Lars Andersson', levels: [3, 2, 3, 2, 3, 4, 1, 1] },
  { id: 'e5', name: 'Sofia Karlsson', levels: [3, 4, 2, 2, 2, 4, 3, 2] },
  { id: 'e6', name: 'Johan Eriksson', levels: [1, 3, 3, 2, 3, 2, 3, 2] },
  { id: 'e7', name: 'Karin Olsson', levels: [3, 4, 3, 2, 1, 4, 3, 2] },
  { id: 'e8', name: 'Peter Nilsson', levels: [3, 4, 3, 0, 3, 4, 3, 1] },
  { id: 'e9', name: 'Emma Larsson', levels: [2, 3, 2, 2, 2, 3, 2, 2] },
  { id: 'e10', name: 'Oscar Pettersson', levels: [3, 4, 3, 2, 3, 4, 3, 2] },
];

function computeStatus(current: number | null, required: number): 'OK' | 'GAP' | 'RISK' {
  if (current === null || current === 0) return 'RISK';
  if (current >= required) return 'OK';
  if (current >= required - 1) return 'GAP';
  return 'RISK';
}

function computeRiskLevel(statuses: ('OK' | 'GAP' | 'RISK')[]): 'LOW' | 'MEDIUM' | 'HIGH' {
  const riskCount = statuses.filter(s => s === 'RISK').length;
  const gapCount = statuses.filter(s => s === 'GAP').length;
  if (riskCount >= 2) return 'HIGH';
  if (riskCount >= 1 || gapCount >= 3) return 'MEDIUM';
  return 'LOW';
}

function generateDemoData(): { columns: MatrixColumn[], rows: MatrixRow[] } {
  const columns: MatrixColumn[] = DEMO_COMPETENCES.map(c => ({
    competenceId: c.id,
    label: c.label,
    groupName: c.groupName,
    requiredLevel: c.requiredLevel,
  }));

  const rows: MatrixRow[] = DEMO_EMPLOYEES.map(emp => {
    const items = emp.levels.map((level, idx) => {
      const required = DEMO_COMPETENCES[idx].requiredLevel;
      return {
        competenceId: DEMO_COMPETENCES[idx].id,
        status: computeStatus(level, required),
        level,
        requiredLevel: required,
      };
    });

    const statuses = items.map(i => i.status);
    const riskLevel = computeRiskLevel(statuses);

    return {
      employeeId: emp.id,
      employeeName: emp.name,
      riskLevel,
      items,
    };
  });

  return { columns, rows };
}

export default function CompetenceMatrixPage() {
  const { loading: authLoading } = useAuthGuard();

  if (authLoading) {
    return (
      <main className="hr-page">
        <p className="text-muted-foreground">Checking access...</p>
      </main>
    );
  }

  return <CompetenceMatrixContent />;
}

function CompetenceMatrixContent() {
  const [positions, setPositions] = useState<PositionSummary[]>([]);
  const [columns, setColumns] = useState<MatrixColumn[]>([]);
  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDemoMode = useMemo(() => {
    if (typeof window === 'undefined') return DEMO_MODE;
    const urlParams = new URLSearchParams(window.location.search);
    return DEMO_MODE || urlParams.get('demo') === 'true';
  }, []);

  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const [loadingPositions, setLoadingPositions] = useState(true);

  useEffect(() => {
    if (isDemoMode) {
      const { columns: demoCols, rows: demoRows } = generateDemoData();
      setColumns(demoCols);
      setRows(demoRows);
      setPositions([{ id: 'demo', name: 'Demo Position', site: null, department: 'Demo' }]);
      setSelectedPositionId('demo');
      setLoadingPositions(false);
      return;
    }

    async function loadPositions() {
      try {
        const posData = await getAllPositions();
        setPositions(posData);
      } catch (err) {
        console.error(err);
        setError('Failed to load positions');
      } finally {
        setLoadingPositions(false);
      }
    }
    loadPositions();
  }, []);

  useEffect(() => {
    if (isDemoMode) return;
    if (!selectedPositionId) {
      setColumns([]);
      setRows([]);
      return;
    }

    async function loadMatrix() {
      setLoadingMatrix(true);
      setError(null);
      try {
        const employees = await getEmployeesForPosition(selectedPositionId!);
        
        if (employees.length === 0) {
          setColumns([]);
          setRows([]);
          setLoadingMatrix(false);
          return;
        }

        const profiles = await Promise.all(
          employees.map((emp) => getEmployeeCompetenceProfile(emp.id))
        );

        const firstProfile = profiles[0];
        const mandatoryItems = firstProfile.items.filter((item) => item.mandatory);

        const cols: MatrixColumn[] = mandatoryItems.map((item) => ({
          competenceId: item.competenceId,
          label: item.competenceName,
          groupName: item.groupName,
          requiredLevel: item.requiredLevel,
        }));

        const matrixRows: MatrixRow[] = profiles.map((profile) => {
          const itemMap = new Map(
            profile.items.map((item) => [item.competenceId, item])
          );

          return {
            employeeId: profile.employee.id,
            employeeName: profile.employee.name,
            riskLevel: profile.summary.riskLevel,
            items: cols.map((col) => {
              const item = itemMap.get(col.competenceId);
              return {
                competenceId: col.competenceId,
                status: item?.status ?? 'N/A',
                level: item?.employeeLevel ?? null,
                requiredLevel: col.requiredLevel,
              };
            }),
          };
        });

        setColumns(cols);
        setRows(matrixRows);
      } catch (err) {
        console.error(err);
        setError('Failed to load competence matrix');
      } finally {
        setLoadingMatrix(false);
      }
    }

    loadMatrix();
  }, [selectedPositionId]);

  const kpis = useMemo(() => {
    if (rows.length === 0) return null;

    const atRisk = rows.filter(r => r.riskLevel === 'HIGH').length;
    const gapSkills = new Map<string, number>();
    let totalOk = 0;
    let totalCells = 0;

    rows.forEach(row => {
      row.items.forEach((item, idx) => {
        totalCells++;
        if (item.status === 'OK') totalOk++;
        if (item.status === 'GAP' || item.status === 'RISK') {
          const label = columns[idx]?.label || 'Unknown';
          gapSkills.set(label, (gapSkills.get(label) || 0) + 1);
        }
      });
    });

    const topGap = Array.from(gapSkills.entries())
      .sort((a, b) => b[1] - a[1])[0];

    const avgReadiness = totalCells > 0 ? Math.round((totalOk / totalCells) * 100) : 0;

    return {
      atRisk,
      topGapSkill: topGap ? topGap[0] : 'None',
      topGapCount: topGap ? topGap[1] : 0,
      avgReadiness,
    };
  }, [rows, columns]);

  const handleExportCSV = () => {
    if (rows.length === 0 || columns.length === 0) return;

    const headers = ['Employee', 'Risk Level', ...columns.map(c => c.label)];
    const csvRows = rows.map(row => {
      const cells = row.items.map(item => 
        item.level !== null ? `${item.level}/${item.requiredLevel}` : '-'
      );
      return [row.employeeName, row.riskLevel, ...cells];
    });

    const csv = [headers, ...csvRows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'competence-matrix.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedPosition = positions.find((p) => p.id === selectedPositionId);

  return (
    <TooltipProvider>
      <main className="hr-page" data-testid="competence-matrix-page">
        {error && (
          <div className="p-3 mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm" data-testid="error-message">
            {error}
          </div>
        )}

        <header className="hr-page__header">
          <div>
            <h1 className="hr-page__title" data-testid="text-page-title">Competence Matrix</h1>
            <p className="hr-page__subtitle">
              Compare all employees in a position against the required competences.
            </p>
          </div>
        </header>

        <div className="p-4 mb-6 rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-[280px]">
              {loadingPositions ? (
                <p className="text-sm text-muted-foreground">Loading positions...</p>
              ) : (
                <Select
                  value={selectedPositionId ?? ''}
                  onValueChange={(val) => setSelectedPositionId(val || null)}
                >
                  <SelectTrigger data-testid="select-position">
                    <SelectValue placeholder="Select a position..." />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.map((pos) => (
                      <SelectItem key={pos.id} value={pos.id} data-testid={`option-position-${pos.id}`}>
                        {pos.name}
                        {pos.department && ` (${pos.department})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedPosition && !loadingMatrix && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-employee-count">
                <Users className="w-4 h-4" />
                {rows.length} employee{rows.length !== 1 ? 's' : ''}
              </div>
            )}

            {rows.length > 0 && (
              <button
                onClick={handleExportCSV}
                className="ml-auto flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-border bg-background hover:bg-accent transition-colors"
                data-testid="button-export-csv"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            )}
          </div>
        </div>

        {kpis && selectedPositionId && !loadingMatrix && rows.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" data-testid="kpi-grid">
            <div className="p-4 rounded-lg border border-border bg-card" data-testid="kpi-employees">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Users className="w-4 h-4" />
                Total Employees
              </div>
              <div className="text-2xl font-semibold">{rows.length}</div>
            </div>
            <div className="p-4 rounded-lg border border-border bg-card" data-testid="kpi-at-risk">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <AlertTriangle className="w-4 h-4" />
                At Risk
              </div>
              <div className={`text-2xl font-semibold ${kpis.atRisk > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {kpis.atRisk}
              </div>
            </div>
            <div className="p-4 rounded-lg border border-border bg-card" data-testid="kpi-top-gap">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Target className="w-4 h-4" />
                Top Gap Skill
              </div>
              <div className="text-lg font-semibold truncate" title={kpis.topGapSkill}>
                {kpis.topGapSkill}
              </div>
              <div className="text-xs text-muted-foreground">{kpis.topGapCount} employees</div>
            </div>
            <div className="p-4 rounded-lg border border-border bg-card" data-testid="kpi-readiness">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <TrendingUp className="w-4 h-4" />
                Avg Readiness
              </div>
              <div className={`text-2xl font-semibold ${kpis.avgReadiness >= 80 ? 'text-green-600 dark:text-green-400' : kpis.avgReadiness >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                {kpis.avgReadiness}%
              </div>
            </div>
          </div>
        )}

        {!selectedPositionId && !loadingPositions && (
          <div className="p-6 rounded-lg border border-dashed border-border bg-muted/50 text-center">
            <p className="text-muted-foreground">Select a position above to view the competence matrix.</p>
          </div>
        )}

        {selectedPositionId && loadingMatrix && (
          <div className="p-6 rounded-lg border border-dashed border-border bg-muted/50 text-center">
            <p className="text-muted-foreground">Loading competence matrix...</p>
          </div>
        )}

        {selectedPositionId && !loadingMatrix && rows.length === 0 && (
          <div className="p-6 rounded-lg border border-dashed border-border bg-muted/50 text-center">
            <p className="text-muted-foreground">No employees found for this position.</p>
          </div>
        )}

        {selectedPositionId && !loadingMatrix && rows.length > 0 && columns.length > 0 && (
          <div className="hr-matrix-wrapper" data-testid="matrix-container">
            <table className="hr-competence-table" data-testid="matrix-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Employee</th>
                  <th style={{ minWidth: 80 }}>Risk</th>
                  {columns.map((col) => (
                    <th
                      key={col.competenceId}
                      style={{ minWidth: 100 }}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="hr-competence-name cursor-help">
                            <span className="max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap block">
                              {col.label.length > 12 ? col.label.slice(0, 12) + '...' : col.label}
                            </span>
                            {col.requiredLevel !== null && (
                              <span className="hr-level-chip">L{col.requiredLevel}</span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="text-sm">
                            <strong>{col.label}</strong>
                            {col.groupName && <span className="text-muted-foreground"> ({col.groupName})</span>}
                            <br />
                            Required Level: {col.requiredLevel}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.employeeId} data-testid={`row-employee-${row.employeeId}`}>
                    <td className="text-left">
                      <span className="font-medium text-foreground">{row.employeeName}</span>
                    </td>
                    <td>
                      <span className={`hr-risk-pill hr-risk-pill--${row.riskLevel.toLowerCase()}`}>
                        {row.riskLevel}
                      </span>
                    </td>
                    {row.items.map((cell, idx) => (
                      <td key={columns[idx].competenceId}>
                        <div className="hr-matrix-cell">
                          <span className="hr-matrix-cell__levels">
                            <strong>{cell.level !== null ? cell.level : '-'}</strong>
                            <span>/</span>
                            <span>{cell.requiredLevel ?? columns[idx]?.requiredLevel ?? '-'}</span>
                          </span>
                          <span
                            className={`hr-status-badge hr-status-badge--${cell.status.toLowerCase()}`}
                          >
                            {cell.status}
                          </span>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedPositionId && !loadingMatrix && rows.length > 0 && columns.length === 0 && (
          <div className="p-6 rounded-lg border border-dashed border-border bg-muted/50 text-center">
            <p className="text-muted-foreground">No mandatory competences defined for this position.</p>
          </div>
        )}
      </main>
    </TooltipProvider>
  );
}
