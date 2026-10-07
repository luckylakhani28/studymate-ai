import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const fixture = fileURLToPath(new URL('./.fixtures/os-notes.pdf', import.meta.url));

test('a student registers, uploads notes, and reads the processed text', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Name').fill('E2E Student');
  await page.getByLabel('Email').fill(`e2e-${Date.now()}@example.com`);
  await page.getByLabel('Password').fill('secret123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Your library' })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(page.getByText('Ready', { exact: true })).toBeVisible({ timeout: 30_000 });

  await page.getByRole('link', { name: 'os-notes' }).click();
  await page.getByRole('button', { name: 'Source text' }).click();
  await expect(page.getByText(/Paging splits memory/)).toBeVisible();
});
