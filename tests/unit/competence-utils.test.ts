describe('Competence Matrix Utilities', () => {
  describe('computeStatus', () => {
    function computeStatus(current: number | null, required: number): 'OK' | 'GAP' | 'RISK' {
      if (current === null || current === 0) return 'RISK';
      if (current >= required) return 'OK';
      if (current >= required - 1) return 'GAP';
      return 'RISK';
    }

    it('should return OK when current level meets or exceeds required', () => {
      expect(computeStatus(3, 3)).toBe('OK');
      expect(computeStatus(4, 3)).toBe('OK');
      expect(computeStatus(5, 3)).toBe('OK');
    });

    it('should return GAP when current is one level below required', () => {
      expect(computeStatus(2, 3)).toBe('GAP');
      expect(computeStatus(3, 4)).toBe('GAP');
    });

    it('should return RISK when current is two or more levels below required', () => {
      expect(computeStatus(1, 3)).toBe('RISK');
      expect(computeStatus(1, 4)).toBe('RISK');
      expect(computeStatus(0, 3)).toBe('RISK');
    });

    it('should return RISK when current level is null', () => {
      expect(computeStatus(null, 3)).toBe('RISK');
    });

    it('should return RISK when current level is 0', () => {
      expect(computeStatus(0, 2)).toBe('RISK');
    });
  });

  describe('computeRiskLevel', () => {
    function computeRiskLevel(statuses: ('OK' | 'GAP' | 'RISK')[]): 'LOW' | 'MEDIUM' | 'HIGH' {
      const riskCount = statuses.filter(s => s === 'RISK').length;
      const gapCount = statuses.filter(s => s === 'GAP').length;
      if (riskCount >= 2) return 'HIGH';
      if (riskCount >= 1 || gapCount >= 3) return 'MEDIUM';
      return 'LOW';
    }

    it('should return LOW when all statuses are OK', () => {
      expect(computeRiskLevel(['OK', 'OK', 'OK', 'OK'])).toBe('LOW');
    });

    it('should return LOW when there are 1-2 GAPs but no RISK', () => {
      expect(computeRiskLevel(['OK', 'GAP', 'OK', 'OK'])).toBe('LOW');
      expect(computeRiskLevel(['OK', 'GAP', 'GAP', 'OK'])).toBe('LOW');
    });

    it('should return MEDIUM when there is 1 RISK', () => {
      expect(computeRiskLevel(['OK', 'RISK', 'OK', 'OK'])).toBe('MEDIUM');
    });

    it('should return MEDIUM when there are 3+ GAPs', () => {
      expect(computeRiskLevel(['GAP', 'GAP', 'GAP', 'OK'])).toBe('MEDIUM');
    });

    it('should return HIGH when there are 2+ RISKs', () => {
      expect(computeRiskLevel(['RISK', 'RISK', 'OK', 'OK'])).toBe('HIGH');
      expect(computeRiskLevel(['RISK', 'RISK', 'RISK', 'OK'])).toBe('HIGH');
    });
  });

  describe('Demo Data', () => {
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

    it('should have exactly 10 demo employees', () => {
      expect(DEMO_EMPLOYEES).toHaveLength(10);
    });

    it('should have unique employee IDs', () => {
      const ids = DEMO_EMPLOYEES.map(e => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have 8 competence levels per employee', () => {
      DEMO_EMPLOYEES.forEach(emp => {
        expect(emp.levels).toHaveLength(8);
      });
    });
  });
});
