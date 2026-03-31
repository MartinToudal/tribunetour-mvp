import { expect, test, type Page } from '@playwright/test';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const stadiumId = process.env.E2E_STADIUM_ID ?? 'vff';

const hasCredentials = Boolean(email && password);

async function login(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /^Log ind$/ }).first().click();
  await page.getByPlaceholder('din@email.dk').fill(email!);
  await page.getByPlaceholder('Adgangskode').fill(password!);
  await page.getByRole('button', { name: /^Log ind$/ }).last().click();

  const userButton = page.getByRole('button', { name: email! });

  try {
    await expect(userButton).toBeVisible({ timeout: 8_000 });
    return;
  } catch {
    const errorText = (await page.locator('p.text-rose-300').first().textContent().catch(() => null))?.trim() ?? '';
    if (errorText) {
      await page.getByRole('button', { name: 'Opret konto' }).click();
      await expect(userButton).toBeVisible({ timeout: 15_000 });
      return;
    }
    throw new Error('Kunne hverken logge ind eller bootstrappe e2e-kontoen.');
  }
}

test.describe('authenticated regression', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredentials, 'Kræver dedikeret e2e-testkonto via E2E_EMAIL og E2E_PASSWORD.');
    await login(page);
  });

  test('can toggle visited from My page and restore original state', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Find dit næste stadion' })).toBeVisible();

    const stadiumLink = page.locator(`a[href="/stadiums/${stadiumId}"]`).first();
    const targetRow = stadiumLink.locator('xpath=ancestor::li[1]');
    await expect(targetRow).toBeVisible();

    const actionButton = targetRow.getByRole('button');
    const initialLabel = (await actionButton.innerText()).trim();

    await actionButton.click();
    const toggledLabel = initialLabel === 'Marker som besøgt' ? 'Marker som ubesøgt' : 'Marker som besøgt';
    await expect(actionButton).toHaveText(toggledLabel);

    await actionButton.click();
    await expect(actionButton).toHaveText(initialLabel);
  });

  test('can update weekend plan and clear it again', async ({ page }) => {
    await page.goto('/matches');
    await expect(page.getByText('Weekendplan')).toBeVisible();

    const clearButton = page.getByRole('button', { name: 'Ryd plan' });
    if (await clearButton.isEnabled()) {
      await clearButton.click();
      await expect(page.getByText('Din plan er tom endnu. Brug “Tilføj til plan” på kampene nedenfor.')).toBeVisible();
    }

    const addButton = page.getByRole('button', { name: 'Tilføj til plan' }).first();
    await addButton.click();
    await expect(page.getByRole('button', { name: 'I plan' }).first()).toBeVisible();
    await expect(clearButton).toBeEnabled();

    await clearButton.click();
    await expect(page.getByText('Din plan er tom endnu. Brug “Tilføj til plan” på kampene nedenfor.')).toBeVisible();
  });

  test('can save and clear a note on stadium detail', async ({ page }) => {
    await page.goto(`/stadiums/${stadiumId}`);
    await expect(page.getByRole('heading', { name: new RegExp(`Status, note og anmeldelse for`, 'i') })).toBeVisible();

    const noteField = page.getByPlaceholder('Skriv din note om stadionet her…');
    const noteValue = `E2E note ${Date.now()}`;

    await noteField.fill(noteValue);
    await page.getByRole('button', { name: 'Gem note' }).click();
    await expect(page.getByText('Noten er gemt.')).toBeVisible();

    await noteField.fill('');
    await page.getByRole('button', { name: 'Gem note' }).click();
    await expect(page.getByText('Noten er gemt.')).toBeVisible();
  });
});
