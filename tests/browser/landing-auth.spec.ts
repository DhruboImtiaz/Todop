import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { emptyWorkspace } from '../../src/services/storage/supabaseRepository';
import { fixture, newLog, readData, readyOffline, expectFontSize } from './helpers';
import { STORAGE_KEY } from '../../src/utils/settings';

test.use({ serviceWorkers: 'block' });

type CloudRequest = { url: string; method: string; body?: string };
type CloudReply = { json?: unknown; status?: number; disconnected?: boolean };

async function mockCloud(context: BrowserContext, mockFetch = false, identity = 'mock-user',
  teamApi?: (request: CloudRequest, id: string) => CloudReply | undefined) {
  const user = { id: identity, email: 'qa@example.invalid', aud: 'authenticated', role: 'authenticated',
    app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() };
  const payload = Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now()/1000)+3600, aud: 'authenticated' })).toString('base64url');
  const access_token = `eyJhbGciOiJIUzI1NiJ9.${payload}.mock-signature`;
  let row = { data: emptyWorkspace(), revision: 0 };
  let failWrites = false;
  let loseResponse = false;
  const disconnected = new Set<BrowserContext>();
  function respond(browserContext: BrowserContext, request: CloudRequest): CloudReply {
    if (disconnected.has(browserContext)) return { disconnected: true };
    const teamReply = teamApi?.(request, identity);
    if (teamReply) return teamReply;
    const url = new URL(request.url);
    if (url.pathname === '/auth/v1/token') return { json: { access_token, refresh_token: 'mock-refresh', token_type: 'bearer', expires_in: 3600, user } };
    if (url.pathname === '/auth/v1/user') return { json: user };
    if (url.pathname === '/auth/v1/logout') return { status: 204 };
    if (url.pathname === '/auth/v1/signup') return { json: { ...user, identities: [{ provider: 'email' }] } };
    if (url.pathname === '/auth/v1/recover') return { json: {} };
    if (url.pathname === '/rest/v1/planner_workspaces') {
      if (request.method === 'GET') return { json: [row] };
      if (request.method === 'PATCH') {
        if (failWrites) return { status: 400, json: { message: 'Service unavailable' } };
        const patch = JSON.parse(request.body!);
        if (url.searchParams.get('revision') !== `eq.${row.revision}`) return { json: null };
        row = { data: patch.data, revision: patch.revision };
        if (loseResponse) {
          loseResponse = false;
          disconnected.add(browserContext);
          return { disconnected: true };
        }
        return { json: { revision: row.revision } };
      }
    }
    return { status: 400, json: { message: 'Unexpected mock request' } };
  }
  async function attach(browserContext: BrowserContext, interceptFetch = false) {
    if (interceptFetch) {
      // With an active service worker, WebKit does not route these requests
      // through Playwright. Mock the SDK's fetch boundary in that context.
      await browserContext.exposeBinding('mockCloudRequest', (_, request: CloudRequest) => respond(browserContext, request));
      await browserContext.addInitScript(() => {
        const fetchFromBrowser = window.fetch.bind(window);
        const { mockCloudRequest } = window as typeof window & {
          mockCloudRequest(request: CloudRequest): Promise<CloudReply>;
        };
        window.fetch = async (input, init) => {
          const request = new Request(input, init);
          if (!new URL(request.url).hostname.endsWith('.supabase.co')) return fetchFromBrowser(input, init);
          const { json, status, disconnected } = await mockCloudRequest({
            url: request.url, method: request.method, body: request.body ? await request.text() : undefined,
          });
          if (disconnected) throw new TypeError('Network unavailable');
          return new Response(json === undefined ? null : JSON.stringify(json), {
            status, headers: { 'Content-Type': 'application/json' },
          });
        };
      });
      return;
    }
    await browserContext.route('https://*.supabase.co/**', async route => {
      const request = route.request();
      const reply = respond(browserContext, { url: request.url(), method: request.method(), body: request.postData() ?? undefined });
      if (reply.disconnected) return route.abort();
      return route.fulfill({ status: reply.status, json: reply.json });
    });
  }
  await attach(context, mockFetch);
  return {
    access_token, attach, row: () => row,
    fail: () => { failWrites = true; },
    disconnect: () => { disconnected.add(context); },
    loseNextResponse: () => { loseResponse = true; },
    recover: () => { failWrites = false; disconnected.delete(context); },
  };
}

async function submitSignIn(page: Page) {
  await page.getByLabel('Email address').fill('qa@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Only-a-local-mock-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function signIn(page: Page) {
  await page.goto('/auth');
  await submitSignIn(page);
  await expect(page.getByRole('button', { name: 'Create new task log', exact: true })).toBeVisible();
}

async function createTask(page: Page, title: string, repeat?: 'daily' | 'weekly') {
  await newLog(page, title);
  if (repeat) await page.getByLabel('Repeat', { exact: true }).selectOption(repeat);
  await page.getByRole('button', { name: 'Create Log', exact: true }).click();
  await expect(page.getByRole('button', { name: new RegExp(`Log: ${title},`) })).toBeVisible();
}

async function renameTask(page: Page, title: string, nextTitle: string) {
  await page.getByRole('button', { name: new RegExp(`Log: ${title},`) }).click();
  await page.getByLabel('Log Name', { exact: true }).fill(nextTitle);
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(page.getByRole('button', { name: new RegExp(`Log: ${nextTitle},`) })).toBeVisible();
}

test('landing demo, mobile navigation, motion control and account entry', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Less in your head.More in your day.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.getByRole('button', { name: /Review the first design direction/ }).click();
  await expect(page.getByText('2 of 3 done')).toBeVisible();
  await page.getByRole('tab', { name: 'Projects', exact: true }).click();
  const panel = page.getByRole('tabpanel');
  await expect(panel.getByRole('link', { name: /Studio refresh.*1 of 2 done/ })).toHaveAttribute('href', '/projects/studio?demo=1');
  await expect(panel.getByRole('link', { name: /The next big thing/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Calendar', exact: true }).click();
  const deadlines = panel.getByRole('group', { name: 'Dates with deadlines' }).getByRole('button');
  await expect(deadlines.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.getByText('Step outside for a little while', { exact: true })).toBeVisible();
  await deadlines.nth(1).click();
  await expect(panel.getByText('Polish the project presentation', { exact: true })).toBeVisible();
  await expect(panel.getByText('Step outside for a little while', { exact: true })).toBeHidden();
  await expect(panel.getByRole('link', { name: 'Open Calendar' })).toHaveAttribute('href', '/calendar?demo=1');
  await page.getByRole('tab', { name: 'Roadmap', exact: true }).click();
  await expect(panel.getByText('Ready', { exact: true })).toBeVisible();
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

test('homepage previews roadmaps and sharing and respects motion controls', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Project Roadmaps' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Shared Workspaces' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Offline editing and sync' })).toBeVisible();

  const calendar = page.getByRole('tab', { name: 'Calendar', exact: true });
  await calendar.click();
  await calendar.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Roadmap', exact: true })).toBeFocused();
  const panel = page.getByRole('tabpanel');
  await expect(panel.getByText('Blocked', { exact: true })).toBeVisible();
  await expect(panel).toHaveCSS('animation-name', 'lp-preview-in');
  await panel.getByRole('button', { name: 'Mark complete' }).click();
  await expect(panel.getByText('Ready', { exact: true })).toBeVisible();

  const motion = page.getByRole('button', { name: 'Pause motion', exact: true });
  await motion.click();
  await expect(panel).toHaveCSS('animation-name', 'none');
  await page.getByRole('button', { name: 'Play motion', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('tab', { name: 'Workspaces', exact: true }).click();
  await expect(panel.getByRole('list', { name: 'Workspace members' })).toContainText('Jamie Chen');
  await expect(panel).not.toContainText('Sign in to share projects and roadmaps.');
  await expect(panel).not.toContainText('Shared edits need a connection.');
  await expect(panel).toHaveCSS('animation-name', 'none');
  await panel.getByRole('link', { name: 'Sign in to shared workspaces' }).click();
  await expect(page).toHaveURL(/auth\?next=%2Fworkspaces/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

  await page.goto('/');
  await page.getByRole('tab', { name: 'Roadmap', exact: true }).click();
  await page.getByRole('link', { name: 'Open the sample project' }).click();
  await page.getByRole('button', { name: 'Roadmap', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Project roadmap' })).toContainText('Depends on Review the first design direction');
});

test('switching homepage previews keeps the surrounding content in place', async ({ page }) => {
  for (const width of [320, 390, 1000, 1365]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready.then(() => true));
    await page.getByRole('tablist', { name: 'Explore the planner preview' }).scrollIntoViewIfNeeded();
    const layout = () => page.evaluate(() => ['.lp-hero-copy', '.lp-demo-tabs', '.lp-preview-stage', '.lp-usecases'].map(selector => {
      const { x, y, width, height } = document.querySelector(selector)!.getBoundingClientRect();
      return [x + scrollX, y + scrollY, width, height].map(Math.round);
    }));
    const original = await layout();
    const tablist = page.getByRole('tablist', { name: 'Explore the planner preview' });
    const originalScroll = await page.evaluate(() => scrollY);
    for (const name of ['Projects', 'Workspaces', 'Calendar', 'Workspaces', 'Roadmap', 'Upcoming']) {
      await tablist.getByRole('tab', { name, exact: true }).click();
      const panel = page.getByRole('tabpanel', { name, exact: true });
      await expect(panel).toBeVisible();
      expect(await layout(), `${name} changed the preview layout at ${width}px`).toEqual(original);
      expect(await page.evaluate(() => scrollY)).toBe(originalScroll);
      const [bodyBottom, footerTop, panelBottom, footerBottom] = await panel.evaluate(element => {
        const [body, footer] = element.children;
        return [body.getBoundingClientRect().bottom, footer.getBoundingClientRect().top,
          element.getBoundingClientRect().bottom, footer.getBoundingClientRect().bottom];
      });
      expect(footerTop - bodyBottom, `${name} left an extra gap at ${width}px`).toBeCloseTo(12, 0);
      expect(panelBottom).toBeCloseTo(footerBottom, 0);
    }
    await tablist.getByRole('tab', { name: 'Calendar', exact: true }).click();
    await page.getByRole('group', { name: 'Dates with deadlines' }).getByRole('button').last().click();
    expect(await layout()).toEqual(original);
    await tablist.getByRole('tab', { name: 'Roadmap', exact: true }).click();
    await page.getByRole('button', { name: 'Mark complete', exact: true }).click();
    await expect(page.getByRole('tabpanel').getByText('Ready', { exact: true })).toBeVisible();
    expect(await layout()).toEqual(original);
  }
});

test('signup confirmation, password reset and expired recovery are clear', async ({ page }) => {
  await mockCloud(page.context());
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

test('failed sync leaves tasks saved locally and sign-out isolates guest data', async ({ page }) => {
  const cloud = await mockCloud(page.context());
  const guest = fixture();
  await page.goto('/app');
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: STORAGE_KEY, data: guest });
  await signIn(page);
  await createTask(page, 'A cloud task');
  await expect.poll(() => cloud.row().data.logs[0]?.title).toBe('A cloud task');
  expect((await readData(page)).logs).toEqual(guest.logs);
  await page.reload();
  await expect(page.getByRole('button', { name: /Log: A cloud task/ })).toBeVisible();
  cloud.fail();
  await createTask(page, 'Keep this draft');
  await expect(page.getByRole('status').filter({ hasText: 'Sync unavailable. Changes saved on this device.' })).toBeVisible();
  expect(cloud.row().data.logs).toHaveLength(1);
  cloud.recover();
  await page.getByRole('button', { name: 'Retry sync' }).click();
  await expect.poll(() => cloud.row().data.logs.map(log => log.title)).toContain('Keep this draft');
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Less in your head.');
  await page.goto('/app');
  await expect(page.getByRole('button', { name: /Log: QA early/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Log: A cloud task/ })).toHaveCount(0);
});


test('a recovery link opens password update and returns to the signed-in workspace', async ({ page }) => {
  const cloud = await mockCloud(page.context());
  await page.goto(`/auth?mode=recovery#access_token=${cloud.access_token}&refresh_token=mock-refresh&type=recovery&expires_in=3600&token_type=bearer`);
  await expect(page.getByRole('button', { name: 'Save new password' })).toBeEnabled();
  await page.getByLabel('Password', { exact: true }).fill('New-password-for-local-mock-only');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('button', { name: 'Create new task log', exact: true })).toBeVisible();
});

test.describe('offline account workspace', () => {
  test.use({ serviceWorkers: 'allow' });

  test('offline tasks survive an expired session and reload, then merge with a second device', async ({ page, context, browser, baseURL, browserName }) => {
    const cloud = await mockCloud(context, browserName === 'webkit');
    await signIn(page);
    await createTask(page, 'Weekly review', 'weekly');
    await expect.poll(() => cloud.row().data.logs.length).toBe(1);
    const original = cloud.row().data.logs[0];
    await readyOffline(page);

    await context.setOffline(true);
    cloud.disconnect();
    await expect(page.getByText('Offline. You can keep editing.')).toBeVisible();
    await createTask(page, 'Created offline');
    await renameTask(page, 'Created offline', 'Edited offline');
    await page.getByRole('button', { name: 'Mark "Weekly review" as completed', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
    await expect(page.getByText('Offline. Changes saved on this device.')).toBeVisible();
    expect(cloud.row().data.logs).toEqual([original]);
    await page.evaluate(() => {
      const key = Object.keys(localStorage).find(name => /^sb-.*-auth-token$/.test(name))!;
      const session = JSON.parse(localStorage.getItem(key)!);
      session.expires_at = Math.floor(Date.now() / 1000) - 60;
      localStorage.setItem(key, JSON.stringify(session));
    });

    await page.reload();
    await expect(page.getByText('Offline. Changes saved on this device.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Log: Edited offline,/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Log: Weekly review,/ })).toHaveCount(1);

    const secondDevice = await browser.newContext({ baseURL, serviceWorkers: 'block' });
    try {
      await cloud.attach(secondDevice);
      const secondPage = await secondDevice.newPage();
      await signIn(secondPage);
      await createTask(secondPage, 'Added from another device');
      await expect.poll(() => cloud.row().data.logs.length).toBe(2);
      cloud.recover();
      await context.setOffline(false);
      await expect.poll(() => cloud.row().data.logs.length, { timeout: 15_000 }).toBe(4);
      const logs = cloud.row().data.logs;
      const completed = logs.find(log => log.id === original.id)!;
      const remaining = logs.filter(log => log.title === original.title && !log.completed);
      expect(completed.completed).toBe(true);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(completed.nextOccurrenceId);
      expect(logs.map(log => log.title)).toContain('Added from another device');

      await secondPage.reload();
      await expect(secondPage.getByRole('button', { name: /Log: Edited offline,/ })).toBeVisible();
      await expect(secondPage.getByRole('button', { name: /Log: Weekly review,/ })).toHaveCount(1);
      await secondPage.goto('/search');
      await secondPage.getByLabel('Search logs by name').fill('Weekly review');
      await expect(secondPage.getByRole('region', { name: 'COMPLETED', exact: true })
        .getByRole('button', { name: /Log: Weekly review, status: Completed/ })).toHaveCount(1);
      await expect(page.getByRole('button', { name: /Log: Added from another device,/ })).toBeVisible();
    } finally {
      await secondDevice.close();
    }
  });
});

test('an interrupted response retries the same completion once and preserves later edits', async ({ page, context }) => {
  const cloud = await mockCloud(context);
  await signIn(page);
  await createTask(page, 'Daily review', 'daily');
  await expect.poll(() => cloud.row().revision).toBe(1);

  cloud.loseNextResponse();
  await page.getByRole('button', { name: 'Mark "Daily review" as completed', exact: true }).click();
  await expect(page.getByText('Sync unavailable. Changes saved on this device.')).toBeVisible();
  const completed = cloud.row().data.logs.find(log => log.completed)!;
  expect(completed.nextOccurrenceId).toBeTruthy();
  await renameTask(page, 'Daily review', 'Next daily review');
  await page.reload();
  await expect(page.getByRole('button', { name: /Log: Next daily review,/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry sync' })).toBeVisible({ timeout: 12_000 });
  cloud.recover();
  await page.getByRole('button', { name: 'Retry sync' }).click();
  await expect.poll(() => cloud.row().revision).toBe(3);
  const logs = cloud.row().data.logs;
  expect(logs).toHaveLength(2);
  expect(logs.find(log => log.id === completed.nextOccurrenceId)?.title).toBe('Next daily review');
});

test('same-task changes stay local until the conflict is resolved explicitly', async ({ page, context, browser, baseURL }) => {
  const cloud = await mockCloud(context);
  await signIn(page);
  await createTask(page, 'Shared task');
  await expect.poll(() => cloud.row().revision).toBe(1);
  await context.setOffline(true);
  await renameTask(page, 'Shared task', 'Phone edit');

  const secondDevice = await browser.newContext({ baseURL, serviceWorkers: 'block' });
  try {
    await cloud.attach(secondDevice);
    const secondPage = await secondDevice.newPage();
    await signIn(secondPage);
    await renameTask(secondPage, 'Shared task', 'Desktop edit');
    await expect.poll(() => cloud.row().revision).toBe(2);

    await context.setOffline(false);
    await expect(page.getByRole('alert').filter({ hasText: /Phone edit.*changed on both devices/ })).toBeVisible();
    expect(cloud.row().data.logs[0].title).toBe('Desktop edit');
    await expect(page.getByRole('button', { name: /Log: Phone edit,/ })).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download device backup' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^todop-backup-.*\.json$/);
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: 'Use cloud version' }).click();
    await expect(page.getByRole('button', { name: /Log: Phone edit,/ })).toBeVisible();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Use cloud version' }).click();
    await expect(page.getByRole('button', { name: /Log: Desktop edit,/ })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'Sync conflict' })).toHaveCount(0);
  } finally {
    await secondDevice.close();
  }
});

test('a workspace invitation resumes after sign-in and shares a project across accounts', async ({ page, context, browser, baseURL }) => {
  const teamId = '32c9fec8-77aa-4a97-9223-5f3c9b53566d';
  const inviteId = '2a9efed7-c9e3-4c7a-a332-0058e177d635';
  let name = '';
  let invited = false;
  let member = false;
  let snapshot = { data: emptyWorkspace(), revision: 0 };
  function teamApi(request: CloudRequest, identity: string): CloudReply | undefined {
    const path = new URL(request.url).pathname;
    const owner = identity === 'owner';
    if (path === '/rest/v1/team_workspaces') {
      if (request.method === 'POST') name = JSON.parse(request.body!).name;
      if (!name || (!owner && !member)) return { json: [] };
      if (request.method === 'PATCH') {
        snapshot = { data: JSON.parse(request.body!).data, revision: snapshot.revision + 1 };
        return { json: [{ revision: snapshot.revision }] };
      }
      const row = { id: teamId, name, owner_id: 'owner', ...snapshot };
      return { json: request.method === 'POST' ? row : [row] };
    }
    if (path === '/rest/v1/team_workspace_members') {
      if (request.method === 'DELETE') member = false;
      return { json: member ? [{ user_id: 'collaborator', display_name: 'Jamie' }] : [] };
    }
    if (path === '/rest/v1/team_workspace_invites') {
      if (request.method === 'POST') invited = true;
      return { json: invited ? [{ token: inviteId, expires_at: '2099-01-01T00:00:00Z' }] : [] };
    }
    if (path === '/rest/v1/rpc/join_team_workspace') {
      expect(JSON.parse(request.body!)).toEqual({ invite_token: inviteId, member_name: 'Jamie' });
      member = true;
      invited = false;
      return { json: teamId };
    }
  }
  const personal = await mockCloud(context, false, 'owner', teamApi);
  await signIn(page);
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Large', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-font-size', 'large');
  const guestStorage = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  await page.goto('/projects');
  await page.getByRole('button', { name: 'Shared workspaces', exact: true }).click();
  await page.getByLabel('Workspace name').fill('Release team');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Release team' })).toBeVisible();
  await page.getByRole('button', { name: 'Create new project' }).click();
  await page.getByLabel('Project Name').fill('Launch');
  await page.getByRole('button', { name: 'Create Project', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open project: Launch' })).toBeVisible();
  await page.getByText('Members and invitations', { exact: true }).click();
  await page.getByRole('button', { name: 'Create invite link' }).click();
  const linkField = page.getByLabel('Invite link 1', { exact: true });
  await expect(linkField).toHaveValue(new RegExp(inviteId));
  const link = await linkField.inputValue();

  const collaborator = await browser.newContext({ baseURL, serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  try {
    await mockCloud(collaborator, false, 'collaborator', teamApi);
    const secondPage = await collaborator.newPage();
    await secondPage.goto(link);
    await expect(secondPage.getByText('Sign in to open a shared workspace or accept an invitation.')).toBeVisible();
    await expect(secondPage.getByRole('button', { name: 'Accept invitation' })).toHaveCount(0);
    await secondPage.getByRole('button', { name: 'Sign in', exact: true }).click();
    await submitSignIn(secondPage);
    await secondPage.getByLabel('Display name').fill('Jamie');
    await secondPage.getByRole('button', { name: 'Accept invitation' }).click();
    await secondPage.getByRole('button', { name: 'Open project: Launch' }).click();
    await secondPage.getByRole('button', { name: 'Add log to Launch' }).click();
    await secondPage.getByLabel('Log Name', { exact: true }).fill('Review release');
    await secondPage.getByRole('button', { name: 'Create Log', exact: true }).click();
    await expect(secondPage.getByRole('button', { name: /Log: Review release,/ })).toBeVisible();
    await secondPage.getByRole('button', { name: 'Roadmap', exact: true }).click();
    await expect(secondPage.getByRole('region', { name: 'Project roadmap' })).toContainText('Review release');

    await page.reload();
    await expectFontSize(page.getByRole('heading', { name: 'Release team' }), 25.2);
    await page.getByText('Members and invitations', { exact: true }).click();
    await expect(page.getByText('Jamie', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Open project: Launch' }).click();
    await expect(page.getByRole('button', { name: /Log: Review release,/ })).toBeVisible();
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(guestStorage);
    expect(personal.row().data.projects).toEqual([]);
    await page.getByRole('button', { name: 'Back to Projects' }).click();
    await page.getByText('Members and invitations', { exact: true }).click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Remove Jamie' }).click();
    await expect(page.getByText('Jamie', { exact: true })).toHaveCount(0);
    await secondPage.reload();
    await expect(secondPage.getByRole('alert')).toContainText('This workspace is unavailable to your account.');
  } finally {
    await collaborator.close();
  }
});
