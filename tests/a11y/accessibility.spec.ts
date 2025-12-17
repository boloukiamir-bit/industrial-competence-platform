import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test('competence matrix page should pass accessibility checks', async ({ page }) => {
    await page.goto('/competence/matrix');
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude('.hr-matrix-wrapper')
      .analyze();
    
    const seriousViolations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );
    
    if (seriousViolations.length > 0) {
      console.log('Accessibility violations found:');
      seriousViolations.forEach(violation => {
        console.log(`- ${violation.id}: ${violation.description}`);
        console.log(`  Impact: ${violation.impact}`);
        console.log(`  Nodes: ${violation.nodes.length}`);
      });
    }
    
    expect(seriousViolations).toHaveLength(0);
  });

  test('login page should pass accessibility checks', async ({ page }) => {
    await page.goto('/login');
    
    await page.waitForLoadState('networkidle');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    const seriousViolations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );
    
    expect(seriousViolations).toHaveLength(0);
  });

  test('color contrast should meet AA standards on matrix', async ({ page }) => {
    await page.goto('/competence/matrix');
    
    await page.waitForLoadState('networkidle');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['cat.color'])
      .analyze();
    
    const contrastViolations = accessibilityScanResults.violations.filter(
      v => v.id === 'color-contrast' && (v.impact === 'critical' || v.impact === 'serious')
    );
    
    expect(contrastViolations).toHaveLength(0);
  });
});
