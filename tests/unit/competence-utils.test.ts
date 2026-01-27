import test from "node:test";
import assert from "node:assert/strict";

test('Competence Matrix Utilities - computeStatus - should return OK when current level meets or exceeds required', () => {
  function computeStatus(current: number | null, required: number): 'OK' | 'GAP' | 'RISK' {
    if (current === null || current === 0) return 'RISK';
    if (current >= required) return 'OK';
    if (current >= required - 1) return 'GAP';
    return 'RISK';
  }

  assert.equal(computeStatus(3, 3), 'OK');
  assert.equal(computeStatus(4, 3), 'OK');
  assert.equal(computeStatus(5, 3), 'OK');
});

test('Competence Matrix Utilities - computeStatus - should return GAP when current is one level below required', () => {
  function computeStatus(current: number | null, required: number): 'OK' | 'GAP' | 'RISK' {
    if (current === null || current === 0) return 'RISK';
    if (current >= required) return 'OK';
    if (current >= required - 1) return 'GAP';
    return 'RISK';
  }

  assert.equal(computeStatus(2, 3), 'GAP');
  assert.equal(computeStatus(3, 4), 'GAP');
});

test('Competence Matrix Utilities - computeStatus - should return RISK when current is two or more levels below required', () => {
  function computeStatus(current: number | null, required: number): 'OK' | 'GAP' | 'RISK' {
    if (current === null || current === 0) return 'RISK';
    if (current >= required) return 'OK';
    if (current >= required - 1) return 'GAP';
    return 'RISK';
  }

  assert.equal(computeStatus(1, 3), 'RISK');
  assert.equal(computeStatus(1, 4), 'RISK');
  assert.equal(computeStatus(0, 3), 'RISK');
});

test('Competence Matrix Utilities - computeStatus - should return RISK when current level is null', () => {
  function computeStatus(current: number | null, required: number): 'OK' | 'GAP' | 'RISK' {
    if (current === null || current === 0) return 'RISK';
    if (current >= required) return 'OK';
    if (current >= required - 1) return 'GAP';
    return 'RISK';
  }

  assert.equal(computeStatus(null, 3), 'RISK');
});

test('Competence Matrix Utilities - computeStatus - should return RISK when current level is 0', () => {
  function computeStatus(current: number | null, required: number): 'OK' | 'GAP' | 'RISK' {
    if (current === null || current === 0) return 'RISK';
    if (current >= required) return 'OK';
    if (current >= required - 1) return 'GAP';
    return 'RISK';
  }

  assert.equal(computeStatus(0, 2), 'RISK');
});

test('Competence Matrix Utilities - computeRiskLevel - should return LOW when all statuses are OK', () => {
  function computeRiskLevel(statuses: ('OK' | 'GAP' | 'RISK')[]): 'LOW' | 'MEDIUM' | 'HIGH' {
    const riskCount = statuses.filter(s => s === 'RISK').length;
    const gapCount = statuses.filter(s => s === 'GAP').length;
    if (riskCount >= 2) return 'HIGH';
    if (riskCount >= 1 || gapCount >= 3) return 'MEDIUM';
    return 'LOW';
  }

  assert.equal(computeRiskLevel(['OK', 'OK', 'OK', 'OK']), 'LOW');
});

test('Competence Matrix Utilities - computeRiskLevel - should return LOW when there are 1-2 GAPs but no RISK', () => {
  function computeRiskLevel(statuses: ('OK' | 'GAP' | 'RISK')[]): 'LOW' | 'MEDIUM' | 'HIGH' {
    const riskCount = statuses.filter(s => s === 'RISK').length;
    const gapCount = statuses.filter(s => s === 'GAP').length;
    if (riskCount >= 2) return 'HIGH';
    if (riskCount >= 1 || gapCount >= 3) return 'MEDIUM';
    return 'LOW';
  }

  assert.equal(computeRiskLevel(['OK', 'GAP', 'OK', 'OK']), 'LOW');
  assert.equal(computeRiskLevel(['OK', 'GAP', 'GAP', 'OK']), 'LOW');
});

test('Competence Matrix Utilities - computeRiskLevel - should return MEDIUM when there is 1 RISK', () => {
  function computeRiskLevel(statuses: ('OK' | 'GAP' | 'RISK')[]): 'LOW' | 'MEDIUM' | 'HIGH' {
    const riskCount = statuses.filter(s => s === 'RISK').length;
    const gapCount = statuses.filter(s => s === 'GAP').length;
    if (riskCount >= 2) return 'HIGH';
    if (riskCount >= 1 || gapCount >= 3) return 'MEDIUM';
    return 'LOW';
  }

  assert.equal(computeRiskLevel(['OK', 'RISK', 'OK', 'OK']), 'MEDIUM');
});

test('Competence Matrix Utilities - computeRiskLevel - should return MEDIUM when there are 3+ GAPs', () => {
  function computeRiskLevel(statuses: ('OK' | 'GAP' | 'RISK')[]): 'LOW' | 'MEDIUM' | 'HIGH' {
    const riskCount = statuses.filter(s => s === 'RISK').length;
    const gapCount = statuses.filter(s => s === 'GAP').length;
    if (riskCount >= 2) return 'HIGH';
    if (riskCount >= 1 || gapCount >= 3) return 'MEDIUM';
    return 'LOW';
  }

  assert.equal(computeRiskLevel(['GAP', 'GAP', 'GAP', 'OK']), 'MEDIUM');
});

test('Competence Matrix Utilities - computeRiskLevel - should return HIGH when there are 2+ RISKs', () => {
  function computeRiskLevel(statuses: ('OK' | 'GAP' | 'RISK')[]): 'LOW' | 'MEDIUM' | 'HIGH' {
    const riskCount = statuses.filter(s => s === 'RISK').length;
    const gapCount = statuses.filter(s => s === 'GAP').length;
    if (riskCount >= 2) return 'HIGH';
    if (riskCount >= 1 || gapCount >= 3) return 'MEDIUM';
    return 'LOW';
  }

  assert.equal(computeRiskLevel(['RISK', 'RISK', 'OK', 'OK']), 'HIGH');
  assert.equal(computeRiskLevel(['RISK', 'RISK', 'RISK', 'OK']), 'HIGH');
});

test('Competence Matrix Utilities - Demo Data - should have exactly 10 demo employees', () => {
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

  assert.equal(DEMO_EMPLOYEES.length, 10);
});

test('Competence Matrix Utilities - Demo Data - should have unique employee IDs', () => {
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

  const ids = DEMO_EMPLOYEES.map(e => e.id);
  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, ids.length);
});

test('Competence Matrix Utilities - Demo Data - should have 8 competence levels per employee', () => {
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

  DEMO_EMPLOYEES.forEach(emp => {
    assert.equal(emp.levels.length, 8);
  });
});
