# Testing Guide

This document explains how to run the test suite for the Industrial Competence Platform.

## Prerequisites

1. Ensure all dependencies are installed:
   ```bash
   npm install
   ```

2. For E2E tests, install Playwright browsers (if not already installed):
   ```bash
   npx playwright install --with-deps
   ```

## Running Tests

### Quick Start

Run tests using npx commands:

#### Unit Tests
```bash
npx jest --passWithNoTests
```

#### E2E Tests
```bash
npx playwright test
```

#### Accessibility Tests
```bash
npx playwright test tests/a11y/
```

#### Linting
```bash
npx eslint . --max-warnings=0
```

#### Format Check
```bash
npx prettier --check .
```

#### Type Checking
```bash
npx tsc --noEmit
```

### Full CI Pipeline

Run all checks in sequence:
```bash
npx eslint . && npx prettier --check . && npx tsc --noEmit && npx jest --passWithNoTests && npm run build && npx playwright test
```

## Demo Mode

To enable demo mode (shows seeded data in the Competence Matrix):

### Option 1: Query Parameter
Navigate to `/competence/matrix?demo=true` in your browser.

### Option 2: Environment Variable
1. Set environment variable:
   ```bash
   NEXT_PUBLIC_DEMO_MODE=true npm run dev
   ```

2. Or add to `.env.local`:
   ```
   NEXT_PUBLIC_DEMO_MODE=true
   ```

Demo mode displays:
- 10 sample employees with Swedish names
- 8 competences (Safety, Operations, Quality, Logistics, etc.)
- Realistic competence levels and gap analysis

## Test Structure

```
tests/
├── e2e/                      # End-to-end tests (Playwright)
│   └── competence-matrix.spec.ts
├── a11y/                     # Accessibility tests (Axe)
│   └── accessibility.spec.ts
└── unit/                     # Unit tests (Jest)
    └── competence-utils.test.ts
```

## Writing New Tests

### Unit Tests
Place in `tests/unit/` with `.test.ts` or `.test.tsx` extension.

### E2E Tests
Place in `tests/e2e/` with `.spec.ts` extension.

### Accessibility Tests
Place in `tests/a11y/` with `.spec.ts` extension. Use `@axe-core/playwright`.

## Accessibility Requirements

All pages must pass WCAG 2.0 Level AA. The test suite checks for:
- Color contrast (4.5:1 for normal text, 3:1 for large text)
- Keyboard navigation
- ARIA labels
- Focus management

## CI/CD Integration

The `npm run ci` command is designed for CI environments:
- Exit code 0 = all tests passed
- Exit code non-zero = at least one test failed

## Troubleshooting

### Playwright Browser Issues
If Playwright tests fail with browser errors:
```bash
npx playwright install --with-deps
```

### TypeScript Errors
Ensure TypeScript compiles cleanly:
```bash
npm run typecheck
```

### ESLint Configuration
ESLint config is in `eslint.config.mjs`. Adjust rules as needed.
