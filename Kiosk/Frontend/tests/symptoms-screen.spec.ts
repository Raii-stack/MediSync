import { expect, test } from '@playwright/test';

test.describe('Symptoms screen', () => {
  test('clicking Fever toggles selected state', async ({ page }) => {
    await page.goto('/triage');

    const feverCard = page.getByRole('button', { name: 'Fever' });
    await expect(feverCard).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText('1 selected')).toBeVisible();

    await feverCard.click();
    await expect(feverCard).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('2 selected')).toBeVisible();

    await feverCard.click();
    await expect(feverCard).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText('1 selected')).toBeVisible();
  });
});
