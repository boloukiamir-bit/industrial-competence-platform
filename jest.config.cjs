module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/tests/unit/**/*.test.ts', '**/tests/unit/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: true,
    }],
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  modulePathIgnorePatterns: [
    '<rootDir>/.cache/',
    '<rootDir>/node_modules/',
  ],
  haste: {
    enableSymlinks: false,
  },
  watchPathIgnorePatterns: [
    '<rootDir>/.cache/',
  ],
};
