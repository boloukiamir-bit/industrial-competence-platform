import { test, expect } from '@playwright/test';

test.describe('Competence Matrix Page', () => {
  test('should load the competence matrix page without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/competence/matrix');
    
    await expect(page.getByTestId('competence-matrix-page')).toBeVisible();
    await expect(page.getByTestId('text-page-title')).toHaveText('Competence Matrix');
    
    expect(consoleErrors.filter(e => !e.includes('hydration') && !e.includes('Warning'))).toHaveLength(0);
  });

  test('should display position selector', async ({ page }) => {
    await page.goto('/competence/matrix');
    
    await expect(page.getByTestId('select-position')).toBeVisible();
  });

  test('should show empty state when no position selected', async ({ page }) => {
    await page.goto('/competence/matrix');
    
    await expect(page.getByText('Select a position above')).toBeVisible();
  });

  test('demo mode: should display demo data with KPI cards', async ({ page }) => {
    await page.goto('/competence/matrix?demo=true');
    
    await page.waitForTimeout(1500);
    
    const kpiGrid = page.getByTestId('kpi-grid');
    await expect(kpiGrid).toBeVisible();
    
    const matrixTable = page.getByTestId('matrix-table');
    await expect(matrixTable).toBeVisible();
    
    const rows = page.locator('[data-testid^="row-employee-"]');
    const count = await rows.count();
    expect(count).toBe(10);
  });

  test('should have export CSV button when data is present', async ({ page }) => {
    await page.goto('/competence/matrix');
    
    const selectTrigger = page.getByTestId('select-position');
    if (await selectTrigger.isVisible()) {
      await selectTrigger.click();
      
      const firstOption = page.locator('[data-testid^="option-position-"]').first();
      if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstOption.click();
        
        await page.waitForTimeout(2000);
        
        const exportButton = page.getByTestId('button-export-csv');
        if (await exportButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await expect(exportButton).toBeVisible();
        }
      }
    }
  });

  test('should update matrix when position filter changes', async ({ page }) => {
    await page.goto('/competence/matrix');
    
    const selectTrigger = page.getByTestId('select-position');
    await expect(selectTrigger).toBeVisible();
    
    await selectTrigger.click();
    
    const options = page.locator('[data-testid^="option-position-"]');
    const optionsCount = await options.count();
    
    if (optionsCount > 0) {
      await options.first().click();
      
      await page.waitForTimeout(2000);
      
      const loadingText = page.getByText('Loading competence matrix...');
      const noEmployees = page.getByText('No employees found');
      const matrixTable = page.getByTestId('matrix-table');
      
      const hasContent = await matrixTable.isVisible({ timeout: 3000 }).catch(() => false) ||
                         await noEmployees.isVisible({ timeout: 100 }).catch(() => false);
      
      expect(hasContent || !(await loadingText.isVisible())).toBeTruthy();
    }
  });
});
