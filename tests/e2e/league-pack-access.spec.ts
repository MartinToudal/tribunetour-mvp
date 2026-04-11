import { expect, test, type Page } from '@playwright/test';

type Credentials = {
  email: string;
  password: string;
};

const entitledCredentials = readCredentials(
  process.env.E2E_ENTITLED_EMAIL ?? process.env.E2E_EMAIL,
  process.env.E2E_ENTITLED_PASSWORD ?? process.env.E2E_PASSWORD
);
const standardCredentials = readCredentials(
  process.env.E2E_STANDARD_EMAIL,
  process.env.E2E_STANDARD_PASSWORD
);

function readCredentials(email: string | undefined, password: string | undefined): Credentials | null {
  if (!email || !password) {
    return null;
  }

  return { email, password };
}

async function login(page: Page, credentials: Credentials) {
  await page.goto('/');
  await page.getByRole('button', { name: /^Log ind$/ }).first().click();
  await page.getByPlaceholder('din@email.dk').fill(credentials.email);
  await page.getByPlaceholder('Adgangskode').fill(credentials.password);
  await page.getByRole('button', { name: /^Log ind$/ }).last().click();

  const userButton = page.getByRole('button', { name: credentials.email });

  try {
    await expect(userButton).toBeVisible({ timeout: 10_000 });
  } catch {
    const errorText = (await page.locator('p.text-rose-300').first().textContent().catch(() => null))?.trim() ?? '';
    if (errorText) {
      throw new Error(`Login fejlede for ${credentials.email}: ${errorText}`);
    }
    throw new Error(`Login fejlede for ${credentials.email} uden synlig fejltekst.`);
  }
}

async function expectGermanyVisibleOnStadiums(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Find dit næste stadion' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tyskland' })).toBeVisible();
  await page.getByRole('button', { name: 'Tyskland' }).click();
  await expect(page.getByText('Hamburger SV')).toBeVisible();
}

async function expectGermanyHiddenOnStadiums(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Find dit næste stadion' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tyskland' })).toHaveCount(0);
  await expect(page.getByText('Hamburger SV')).toHaveCount(0);
}

async function expectGermanyVisibleOnMatches(page: Page) {
  await page.goto('/matches');
  await expect(page.getByRole('heading', { name: 'Kommende kampe' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tyskland' })).toBeVisible();
  await page.getByRole('button', { name: 'Tyskland' }).click();
  await expect(page.getByText('VfB Stuttgart – Hamburger SV')).toBeVisible();
}

async function expectGermanyHiddenOnMatches(page: Page) {
  await page.goto('/matches');
  await expect(page.getByRole('heading', { name: 'Kommende kampe' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tyskland' })).toHaveCount(0);
}

async function expectGermanyVisibleOnMy(page: Page) {
  await page.goto('/my');
  await expect(page.getByRole('heading', { name: 'Overblik over dine stadionbesøg' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tyskland' })).toBeVisible();
}

async function expectGermanyHiddenOnMy(page: Page) {
  await page.goto('/my');
  await expect(page.getByRole('heading', { name: 'Overblik over dine stadionbesøg' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tyskland' })).toHaveCount(0);
}

test.describe('league pack access', () => {
  test('entitled user can see Germany across main surfaces', async ({ page }) => {
    test.skip(!entitledCredentials, 'Kræver E2E_ENTITLED_EMAIL/E2E_ENTITLED_PASSWORD eller E2E_EMAIL/E2E_PASSWORD.');

    await login(page, entitledCredentials!);
    await expectGermanyVisibleOnStadiums(page);
    await expectGermanyVisibleOnMatches(page);
    await expectGermanyVisibleOnMy(page);
  });

  test('standard user does not see Germany', async ({ page }) => {
    test.skip(!standardCredentials, 'Kræver E2E_STANDARD_EMAIL og E2E_STANDARD_PASSWORD.');

    await login(page, standardCredentials!);
    await expectGermanyHiddenOnStadiums(page);
    await expectGermanyHiddenOnMatches(page);
    await expectGermanyHiddenOnMy(page);
  });
});
