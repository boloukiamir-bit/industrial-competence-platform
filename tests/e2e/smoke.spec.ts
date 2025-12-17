import { test, expect } from '@playwright/test';

test.describe('MVP Smoke Tests', () => {
  test('/ (landing page) should load', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Industrial Competence|Nadiplan/i);
    await expect(page.locator('body')).toBeVisible();
  });

  test('/login should load', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('input-email')).toBeVisible();
    await expect(page.getByTestId('input-password')).toBeVisible();
    await expect(page.getByTestId('button-signin')).toBeVisible();
  });

  test('/signup should load', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByTestId('input-email')).toBeVisible();
    await expect(page.getByTestId('input-password')).toBeVisible();
    await expect(page.getByTestId('input-confirm-password')).toBeVisible();
    await expect(page.getByTestId('button-signup')).toBeVisible();
  });

  test('/pricing should load as public page', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByTestId('button-select-business')).toBeVisible();
    await expect(page.getByTestId('button-select-enterprise')).toBeVisible();
  });

  test('/api/health should return OK', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('OK');
  });
});

test.describe('Gaps Page - Demo Mode', () => {
  test('should generate gaps table after clicking Generate button', async ({ page }) => {
    await page.goto('/app/gaps?demo=true');
    
    await expect(page.getByTestId('heading-tomorrows-gaps')).toBeVisible();
    
    await page.getByTestId('select-position').click();
    await page.getByRole('option', { name: 'Pressline 1' }).click();
    
    await page.getByTestId('button-generate-gaps').click();
    
    await expect(page.getByTestId('card-summary')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('gaps-table')).toBeVisible();
    await expect(page.getByTestId('text-employees-at-risk')).toBeVisible();
  });

  test('CSV export button should exist and be clickable', async ({ page }) => {
    await page.goto('/app/gaps?demo=true');
    
    await page.getByTestId('select-position').click();
    await page.getByRole('option', { name: 'Pressline 1' }).click();
    await page.getByTestId('button-generate-gaps').click();
    
    await expect(page.getByTestId('card-summary')).toBeVisible({ timeout: 5000 });
    
    const exportButton = page.getByTestId('button-export-csv');
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeEnabled();
    
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    await exportButton.click();
    
    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toMatch(/gaps-\d{4}-\d{2}-\d{2}\.csv/);
    }
  });
});

test.describe('Competence Matrix - Demo Mode', () => {
  test('should load competence matrix in demo mode', async ({ page }) => {
    await page.goto('/app/competence-matrix?demo=true');
    
    await page.waitForTimeout(2000);
    
    await expect(page.getByTestId('heading-competence-matrix')).toBeVisible();
  });
});
