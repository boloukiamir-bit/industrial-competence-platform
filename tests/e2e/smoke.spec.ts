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

test.describe('Protected App Routes - Auth Redirect', () => {
  test('/app/gaps should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/app/gaps');
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page.getByTestId('input-email')).toBeVisible();
  });

  test('/app/competence-matrix should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/app/competence-matrix');
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page.getByTestId('input-email')).toBeVisible();
  });
});

test.describe('Legacy Public Routes', () => {
  test('/competence/matrix should redirect to login', async ({ page }) => {
    await page.goto('/competence/matrix');
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page.getByTestId('input-email')).toBeVisible();
  });
});
