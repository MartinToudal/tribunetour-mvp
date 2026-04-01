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
    const saveNoteButton = page.getByRole('button', { name: 'Gem note' });
    const noteValue = `E2E note ${Date.now()}`;

    await noteField.fill(noteValue);
    await saveNoteButton.click();
    await expect(page.getByText('Noten er gemt.')).toBeVisible();

    await noteField.fill('');
    await saveNoteButton.click();
    await expect(saveNoteButton).toBeDisabled();
    await expect(noteField).toHaveValue('');
  });

  test('can save a review with details and load it again after reload', async ({ page }) => {
    await page.goto(`/stadiums/${stadiumId}`);
    await expect(page.getByText('Personlig anmeldelse')).toBeVisible();

    const matchLabel = `E2E kamp ${Date.now()}`;
    const summary = `E2E review summary ${Date.now()}`;
    const tags = 'e2e,test';
    const categoryNote = `E2E category note ${Date.now()}`;

    await page.getByRole('textbox', { name: 'Kamp' }).fill(matchLabel);

    const atmosphereCard = page
      .getByText('Atmosfære og lyd')
      .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');

    await atmosphereCard.getByRole('button', { name: '+' }).click();
    await expect(atmosphereCard.getByText('5/10')).toBeVisible();
    await atmosphereCard.getByPlaceholder('Valgfri note til denne kategori…').fill(categoryNote);

    await page.getByRole('textbox', { name: 'Kort opsummering' }).fill(summary);
    await page.getByRole('textbox', { name: 'Tags' }).fill(tags);

    await page.getByRole('button', { name: 'Gem anmeldelse' }).click();
    await expect(page.getByText('Anmeldelsen er gemt.')).toBeVisible();

    await page.reload();
    await expect(page.getByText('Personlig anmeldelse')).toBeVisible();

    await expect(page.getByRole('textbox', { name: 'Kamp' })).toHaveValue(matchLabel);
    await expect(page.getByRole('textbox', { name: 'Kort opsummering' })).toHaveValue(summary);
    await expect(page.getByRole('textbox', { name: 'Tags' })).toHaveValue(tags);

    const reloadedAtmosphereCard = page
      .getByText('Atmosfære og lyd')
      .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');

    await expect(reloadedAtmosphereCard.getByText('5/10')).toBeVisible();
    await expect(reloadedAtmosphereCard.getByPlaceholder('Valgfri note til denne kategori…')).toHaveValue(categoryNote);
  });

  test('can upload, update and delete a photo', async ({ page }) => {
    await page.goto(`/stadiums/${stadiumId}`);
    await expect(page.getByText('Personlige billeder')).toBeVisible();

    const uploadCaption = `E2E upload caption ${Date.now()}`;
    const updatedCaption = `E2E updated caption ${Date.now()}`;
    const photoCard = page
      .getByText('Personlige billeder')
      .locator('xpath=ancestor::div[contains(@class,"site-card-soft")][1]');

    await page.getByRole('textbox', { name: 'Valgfri billedtekst til næste upload' }).fill(uploadCaption);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'e2e-photo.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn7n6kAAAAASUVORK5CYII=',
        'base64'
      ),
    });

    await expect(page.getByText('Fotoændringen er gemt.')).toBeVisible();
    const newestPhoto = photoCard.locator('article').first();
    await expect(newestPhoto.getByRole('textbox', { name: 'Billedtekst' })).toHaveValue(uploadCaption);

    await newestPhoto.getByRole('textbox', { name: 'Billedtekst' }).fill(updatedCaption);
    await newestPhoto.getByRole('button', { name: 'Gem billedtekst' }).click();
    await expect(page.getByText('Fotoændringen er gemt.')).toBeVisible();

    const uploadedFileName = ((await newestPhoto.locator('.text-sm.font-medium.text-white').first().textContent()) ?? '').trim();
    expect(uploadedFileName).not.toBe('');

    await page.reload();
    await expect(page.getByText('Personlige billeder')).toBeVisible();
    const reloadedPhoto = photoCard.locator('article').filter({ hasText: uploadedFileName }).first();
    await expect(reloadedPhoto.getByRole('textbox', { name: 'Billedtekst' })).toHaveValue(updatedCaption);

    await reloadedPhoto.getByRole('button', { name: 'Slet billede' }).click();
    await expect(page.getByText('Fotoændringen er gemt.')).toBeVisible();
    await expect(photoCard.locator('article').filter({ hasText: uploadedFileName })).toHaveCount(0);
  });
});
