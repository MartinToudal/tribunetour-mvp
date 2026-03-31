import { expect, test } from '@playwright/test';

test.describe('guest smoke', () => {
  test('front page loads with stadium overview', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Planlæg stadionture og hold styr på dine besøg.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Find dit næste stadion' })).toBeVisible();
    await expect(page.getByPlaceholder('Søg stadion, klub, by…')).toBeVisible();
  });

  test('matches page loads with filters and fixtures', async ({ page }) => {
    await page.goto('/matches');

    await expect(page.getByRole('heading', { name: 'Kommende kampe' })).toBeVisible();
    await expect(page.getByPlaceholder('Søg runde, klub eller stadion…')).toBeVisible();
    await expect(page.getByRole('button', { name: '14 dage' })).toBeVisible();
  });

  test('my page loads and shows overview shell', async ({ page }) => {
    await page.goto('/my');

    await expect(page.getByRole('heading', { name: 'Overblik over dine stadionbesøg' })).toBeVisible();
    await expect(page.getByText('Se hvor mange stadions du har besøgt, hvor mange der mangler')).toBeVisible();
  });
});
