'use client';

import { useEffect, useState } from 'react';
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

export default function CompetenceMatrixPage() {
  const [positions, setPositions] = useState<PositionSummary[]>([]);
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const [columns, setColumns] = useState<MatrixColumn[]>([]);
  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(true);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

  const selectedPosition = positions.find((p) => p.id === selectedPositionId);

  return (
    <main className="hr-page" data-testid="competence-matrix-page">
      {error && (
        <div className="hr-error mb-4" data-testid="error-message">
          {error}
        </div>
      )}

      <header className="hr-page__header">
        <div>
          <h1 className="hr-page__title">Competence Matrix</h1>
          <p className="hr-page__subtitle">
            Compare all employees in a position against the required competences.
          </p>
        </div>
      </header>

      <div className="hr-matrix-controls">
        <div className="hr-matrix-controls__select">
          {loadingPositions ? (
            <p className="hr-matrix-controls__count">Loading positions...</p>
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
          <span className="hr-matrix-controls__count" data-testid="text-employee-count">
            {rows.length} employee{rows.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {!selectedPositionId && !loadingPositions && (
        <div className="hr-empty">
          <p>Select a position above to view the competence matrix.</p>
        </div>
      )}

      {selectedPositionId && loadingMatrix && (
        <div className="hr-empty">
          <p>Loading competence matrix...</p>
        </div>
      )}

      {selectedPositionId && !loadingMatrix && rows.length === 0 && (
        <div className="hr-empty">
          <p>No employees found for this position.</p>
        </div>
      )}

      {selectedPositionId && !loadingMatrix && rows.length > 0 && columns.length > 0 && (
        <div className="hr-matrix-wrapper">
          <table className="hr-competence-table" data-testid="matrix-table">
            <thead>
              <tr>
                <th style={{ minWidth: 150 }}>Employee</th>
                <th style={{ minWidth: 80 }}>Risk</th>
                {columns.map((col) => (
                  <th
                    key={col.competenceId}
                    style={{ minWidth: 100 }}
                    title={col.label}
                  >
                    <div className="hr-competence-name">
                      <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {col.label.length > 15 ? col.label.slice(0, 15) + '...' : col.label}
                      </span>
                      {col.requiredLevel !== null && (
                        <span className="hr-level-chip">L{col.requiredLevel}</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.employeeId} data-testid={`row-employee-${row.employeeId}`}>
                  <td>
                    <span className="font-medium">{row.employeeName}</span>
                  </td>
                  <td>
                    <span className={`hr-risk-pill hr-risk-pill--${row.riskLevel.toLowerCase()}`}>
                      {row.riskLevel}
                    </span>
                  </td>
                  {row.items.map((cell, idx) => (
                    <td key={columns[idx].competenceId}>
                      <div className="hr-matrix-cell">
                        <span className="hr-matrix-cell__level">
                          {cell.level !== null ? cell.level : '-'}
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
        <div className="hr-empty">
          <p>No mandatory competences defined for this position.</p>
        </div>
      )}
    </main>
  );
}
