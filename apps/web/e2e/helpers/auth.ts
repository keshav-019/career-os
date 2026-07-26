import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Signs in via the real login form. Uses a throwaway CareerOS account created specifically for this test suite -
 * override with E2E_TEST_EMAIL / E2E_TEST_PASSWORD for a different account (e.g. in CI).
 *
 * Not reused across tests via storageState: Firebase Auth's web SDK persists sessions via IndexedDB, which
 * Playwright's storageState() doesn't reliably snapshot - see playwright.config.ts's comment. Each test just
 * signs in for real instead.
 */
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || "testing@gmail.com";
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || "12345678";

export async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.locator("#auth-email").fill(TEST_EMAIL);
  await page.locator("#auth-password").fill(TEST_PASSWORD);
  await page.locator("button.auth-submit").click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
}
