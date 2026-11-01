import { test, expect, type Page } from '@playwright/test';
import { emptyWorkspace } from '../../src/services/storage/supabaseRepository';
import { fixture, newLog, readData } from './helpers';
import { STORAGE_KEY } from '../../src/utils/settings';

test.use({ serviceWorkers: 'block' });

async function mockCloud(page: Page) {
  const user = { id: 'mock-user', email: 'qa@example.invalid', aud: 'authenticated', role: 'authenticated',
    app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() };
  const payload = Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now()/1000)+3600, aud: 'authenticated' })).toString('base64url');
  const access_token = `eyJhbGciOiJIUzI1NiJ9.${payload}.mock-signature`;
  let row = { data: emptyWorkspace(), revision: 0 };
  let failWrites = false;
  await page.context().route('https://*.supabase.co/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/auth/v1/token') return route.fulfill({ json: { access_token, refresh_token: 'mock-refresh', token_type: 'bearer', expires_in: 3600, user } });
    if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user });
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
    if (url.pathname === '/auth/v1/signup') return route.fulfill({ json: { ...user, identities: [{ provider: 'email' }] } });
    if (url.pathname === '/auth/v1/recover') return route.fulfill({ json: {} });
    if (url.pathname === '/rest/v1/planner_workspaces') {
      if (request.method() === 'GET') return route.fulfill({ json: [row] });
      if (request.method() === 'PATCH') {
        if (failWrites) return route.fulfill({ status: 400, json: { message: 'Service unavailable' } });
        const patch = request.postDataJSON();
        if (url.searchParams.get('revision') !== `eq.${row.revision}`) return route.fulfill({ status: 406, json: { code: 'PGRST116', details: '0 rows', message: 'No row' } });
        row = { data: patch.data, revision: patch.revision };
        return route.fulfill({ json: { revision: row.revision } });
      }
    }
    return route.fulfill({ status: 400, json: { message: 'Unexpected mock request' } });
  });
  return { access_token, row: () => row, fail: () => { failWrites = true; }, recover: () => { failWrites = false; } };
}

test('landing demo, mobile navigation, motion control and account entry', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Less in your head.More in your day.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.getByRole('button', { name: /Put the finishing touches/ }).click();
  await expect(page.getByText('2 of 3 done')).toBeVisible();
  await page.getByRole('tab', { name: 'Projects', exact: true }).click();
  await expect(page.getByRole('tabpanel')).toContainText('The next big thing');
  await page.getByRole('tab', { name: 'Calendar', exact: true }).click();
  await expect(page.getByRole('tabpanel')).toContainText('A little perspective');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Your space', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Pause motion', exact: true }).click();
  await expect(page.locator('.landing-page')).toHaveClass(/lp-still/);
  await page.getByRole('button', { name: 'Find your focus' }).click();
  await expect(page.getByRole('heading', { name: 'Create your account', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue without an account' }).click();
  await expect(page.getByRole('button', { name: 'Create new task log', exact: true })).toBeVisible();
});

test('signup confirmation, password reset and expired recovery are clear', async ({ page }) => {
  await mockCloud(page);
  await page.goto('/auth?mode=signup');
  await page.getByLabel('Email address').fill('qa@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Only-a-local-mock-password');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Check your email');
  await page.getByRole('button', { name: 'Back to sign in' }).click();
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toContainText('password reset link');
  await page.goto('/auth?mode=recovery');
  await expect(page.getByRole('button', { name: 'Save new password' })).toBeDisabled();
});

test('signed-in cloud saves persist, failed writes preserve drafts, sign-out isolates guest data', async ({ page }) => {
  const cloud = await mockCloud(page);
  const guest = fixture();
  await page.goto('/app');
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: STORAGE_KEY, data: guest });
  await page.goto('/auth');
  await page.getByLabel('Email address').fill('qa@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Only-a-local-mock-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await newLog(page, 'A cloud task');
  await page.getByRole('button', { name: 'Create Log', exact: true }).click();
  await expect(page.getByRole('button', { name: /Log: A cloud task/ })).toBeVisible();
  expect(cloud.row().data.logs[0].title).toBe('A cloud task');
  expect((await readData(page)).logs).toEqual(guest.logs);
  await page.reload();
  await expect(page.getByRole('button', { name: /Log: A cloud task/ })).toBeVisible();
  cloud.fail();
  await newLog(page, 'Keep this draft');
  await page.getByRole('button', { name: 'Create Log', exact: true }).click();
  await expect(page.getByLabel('Log Name', { exact: true })).toHaveValue('Keep this draft');
  await expect(page.getByRole('alert').filter({ hasText: /could not save/i }).first()).toBeVisible();
  cloud.recover();
  await page.getByRole('button', { name: 'Create Log', exact: true }).click();
  await expect(page.getByRole('button', { name: /Log: Keep this draft/ })).toBeVisible();
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Less in your head.');
  await page.goto('/app');
  await expect(page.getByRole('button', { name: /Log: QA early/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Log: A cloud task/ })).toHaveCount(0);
});


test('a recovery link opens password update and returns to the signed-in workspace', async ({ page }) => {
  const cloud = await mockCloud(page);
  await page.goto(`/auth?mode=recovery#access_token=${cloud.access_token}&refresh_token=mock-refresh&type=recovery&expires_in=3600&token_type=bearer`);
  await expect(page.getByRole('button', { name: 'Save new password' })).toBeEnabled();
  await page.getByLabel('Password', { exact: true }).fill('New-password-for-local-mock-only');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('button', { name: 'Create new task log', exact: true })).toBeVisible();
});
