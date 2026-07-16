import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('shows the navbar with all nav links', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('link', { name: /Time Sheet/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Settings/i })).toBeVisible();
  });

  test('Time Sheet link is active on homepage', async ({ page }) => {
    await page.goto('/');
    const link = page.getByRole('link', { name: /Time Sheet/i });
    await expect(link).toHaveClass(/active/);
  });
});

test.describe('Calendar', () => {
  test('shows the current month and year', async ({ page }) => {
    await page.goto('/');
    const now = new Date();
    const month = now.toLocaleString('default', { month: 'long' });
    const year = now.getFullYear().toString();

    await expect(page.locator('h2')).toContainText(month);
    await expect(page.locator('h2')).toContainText(year);
  });

  test('shows day-of-week headers', async ({ page }) => {
    await page.goto('/');
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      await expect(page.getByRole('columnheader', { name: day })).toBeVisible();
    }
  });

  test('shows view options', async ({ page }) => {
    await page.goto('/');
    for (const label of ['Day', 'Week', 'Month', 'Year']) {
      await expect(
        page.locator('label').filter({ hasText: label }),
      ).toBeVisible();
    }
  });

  test('shows navigation buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Today' })).toBeVisible();
    await expect(page.getByRole('button', { name: '<' })).toBeVisible();
    await expect(page.getByRole('button', { name: '>' })).toBeVisible();
  });

  test("highlights today's date", async ({ page }) => {
    await page.goto('/');
    const today = new Date().getDate();
    const todayCell = page.locator('[aria-current="date"]');
    await expect(todayCell).toBeVisible();
    await expect(todayCell).toContainText(today.toString());
  });
});
