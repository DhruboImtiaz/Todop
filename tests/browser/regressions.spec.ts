import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createBackup } from '../../src/utils/backup';
import { FONT_SIZES, STORAGE_KEY } from '../../src/utils/settings';
import { NOW, fixture, readData, seed, restore, selectBackup, readyOffline, newLog, dateTime } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test('mobile pickers commit correct local time and dismiss without losing the form draft', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await newLog(page, 'Picker regression');
  for (const kind of ['date', 'time']) {
    const trigger = page.getByRole('button', { name: `Select ${kind}`, exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: `Select ${kind}`, exact: true });
    await expect(dialog).toBeVisible();
    await expect(async () => {
      const box = (await dialog.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
      expect(box.y + box.height).toBeLessThanOrEqual(844);
      expect(Math.abs(box.x + box.width / 2 - 195)).toBeLessThan(1);
    }).toPass();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.getByLabel('Log Name', { exact: true })).toHaveValue('Picker regression');
  }
  await dateTime(page);
  await page.getByRole('button', { name: 'Create Log', exact: true }).click();
  const saved = (await readData(page)).logs[0];
  expect(saved.deadline).toBe('2026-10-31T09:30:00.000Z');
  await page.reload();
  await page.getByRole('heading', { name: 'Picker regression', exact: true }).click();
  await expect(page.locator('.date-picker-trigger')).toContainText('10/31/2026');
  await expect(page.locator('.time-picker-trigger')).toContainText('03:30 PM');
  for (const [period, expected] of [['AM', '2026-10-30T18:00:00.000Z'], ['PM', '2026-10-31T06:00:00.000Z']]) {
    await page.getByRole('button', { name: 'Select time', exact: true }).click();
    const clock = page.getByRole('dialog', { name: 'Select time', exact: true });
    await clock.getByRole('button', { name: '12 hours', exact: true }).click();
    await clock.getByRole('button', { name: '0 minutes', exact: true }).click();
    await clock.getByRole('button', { name: 'Choose hour', exact: true }).click();
    await clock.getByRole('button', { name: '12 hours', exact: true }).click();
    await clock.getByRole('button', { name: period, exact: true }).click();
    await clock.getByRole('button', { name: 'OK', exact: true }).click();
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    const actual = (await readData(page)).logs[0];
    // Midnight on Oct 31 is Oct 30 at 18:00 UTC.
    expect(actual.deadline).toBe(expected);
    expect(actual.id).toBe(saved.id);
    await page.getByRole('heading', { name: 'Picker regression', exact: true }).click();
  }
  expect(errors).toEqual([]);
});

test('popover stays on screen across the mobile breakpoint and short viewports', async ({ page }) => {
  await page.goto('/');
  await newLog(page, 'Resize draft');
  for (const kind of ['date', 'time']) {
    await page.getByRole('button', { name: `Select ${kind}`, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: `Select ${kind}`, exact: true });
    for (const viewport of [{ width: 479, height: 844 }, { width: 480, height: 844 }, { width: 844, height: 390 }, { width: 390, height: 300 }]) {
      await page.setViewportSize(viewport);
      await expect(async () => {
        const box = (await dialog.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      }).toPass();
    }
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByLabel('Log Name', { exact: true })).toHaveValue('Resize draft');
    await page.setViewportSize({ width: 390, height: 844 });
  }
});

test('month navigation, Cancel and outside dismissal discard only picker changes', async ({ page }) => {
  await page.goto('/');
  await newLog(page, 'Unsaved draft');
  const originalDate = await page.locator('.date-picker-trigger').innerText();
  const originalTime = await page.locator('.time-picker-trigger').innerText();
  await page.getByRole('button', { name: 'Select date', exact: true }).click();
  const calendar = page.getByRole('dialog', { name: 'Select date', exact: true });
  for (let index = 0; index < 3; index++) await calendar.getByRole('button', { name: 'Next month' }).click();
  await expect(calendar).toContainText('January 2027');
  await calendar.getByRole('button', { name: 'Previous month' }).click();
  await calendar.getByRole('button', { name: 'December 31, 2026', exact: true }).click();
  await calendar.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.date-picker-trigger')).toHaveText(originalDate);
  await page.getByRole('button', { name: 'Select time', exact: true }).click();
  await page.getByRole('button', { name: '3 hours', exact: true }).click();
  await page.locator('.picker-backdrop').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('.time-picker-trigger')).toHaveText(originalTime);
  await expect(page.getByLabel('Log Name', { exact: true })).toHaveValue('Unsaved draft');
});

test('Calendar uses the shared save flow for assignment and drafted subtasks', async ({ page }) => {
  await seed(page);
  await page.goto('/calendar');
  await page.getByRole('gridcell', { name: /^2026-10-31,/ }).click();
  await page.getByRole('button', { name: /^Add log for / }).click();
  await page.getByLabel('Log Name', { exact: true }).fill('Calendar task');
  await page.getByRole('combobox', { name: 'Project (optional)', exact: true }).selectOption('beta');
  await page.getByRole('button', { name: 'ADD SUBTASK', exact: true }).click();
  for (const title of ['First step', 'Second step']) {
    await page.getByLabel('New subtask title').fill(title);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Create Log', exact: true }).click();
  const saved = (await readData(page)).logs.find(log => log.title === 'Calendar task')!;
  expect(saved.projectId).toBe('beta');
  expect(saved.deadline).toBe('2026-10-31T06:00:00.000Z');
  expect(saved.subtasks.map(subtask => subtask.title)).toEqual(['First step', 'Second step']);
  await page.reload();
  expect((await readData(page)).logs.find(log => log.id === saved.id)).toEqual(saved);
});

test('clearing and restoring a project deadline updates every scheduling view', async ({ page }) => {
  await seed(page);
  await page.goto('/projects/alpha');
  await page.getByRole('heading', { name: 'QA early', exact: true }).click();
  await page.getByLabel('No deadline', { exact: true }).check();
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  const undated = (await readData(page)).logs.find(log => log.id === 'early')!;
  expect(undated.deadline).toBeUndefined();
  expect(undated.subtasks).toEqual(fixture().logs[0].subtasks);
  const card = page.locator('.log-card').filter({ has: page.getByRole('heading', { name: 'QA early', exact: true }) });
  await expect(card.locator('.log-card-countdown')).toHaveCount(0);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'QA early', exact: true })).toBeHidden();
  await page.goto('/calendar');
  await expect(page.getByRole('heading', { name: 'QA early', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByLabel('Search logs by name').fill('QA early');
  await page.getByRole('heading', { name: 'QA early', exact: true }).click();
  await page.getByLabel('Set deadline', { exact: true }).check();
  await dateTime(page);
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  expect((await readData(page)).logs.find(log => log.id === 'early')?.deadline).toBe('2026-10-31T09:30:00.000Z');
  await page.goto('/calendar');
  await expect(page.getByRole('gridcell', { name: /^2026-10-31, 2 active/ })).toBeVisible();
});

test('first online visit fully precaches the app for offline reload and editing', async ({ page, context }) => {
  await seed(page);
  await readyOffline(page);
  const before = await readData(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'SETTINGS', exact: true })).toBeVisible();
  expect(await readData(page)).toEqual(before);
  for (const [path, heading] of [['/', 'UPCOMING'], ['/projects', 'Projects'], ['/projects/alpha', 'Alpha'], ['/search', 'SEARCH'], ['/calendar', 'CALENDAR'], ['/settings', 'SETTINGS']]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByLabel('Search logs by name').fill('  QA EARLY  ');
  await page.getByRole('heading', { name: 'QA early', exact: true }).click();
  await page.getByLabel('Log Name', { exact: true }).fill('Edited offline');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto('/');
  await expect(reopened.getByRole('heading', { name: 'Edited offline', exact: true })).toBeVisible();
  expect((await readData(reopened)).logs.find(log => log.id === 'early')?.subtasks).toEqual(before.logs[0].subtasks);
});

test('countdowns recalculate on ticks, rescheduling and resume without replacing records', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  const card = page.locator('.log-card').filter({ has: page.getByRole('heading', { name: 'QA early', exact: true }) });
  await expect(card).toContainText('42 M');
  await page.clock.setFixedTime(new Date(NOW.getTime() + 60_000));
  await expect(card).toContainText('41 M', { timeout: 7000 });
  await card.getByRole('heading').click();
  await dateTime(page);
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(card).toContainText('1 D 5H 29M');
  const original = fixture().logs[0];
  expect((await readData(page)).logs.find(log => log.id === 'early')).toMatchObject({ id: original.id, projectId: original.projectId, subtasks: original.subtasks });
  await page.clock.setFixedTime(new Date('2026-11-01T10:00:00+06:00'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(card).toContainText('OVERDUE');
});

test('creating in a project honors the selected assignment and project deletion preserves every task', async ({ page }) => {
  await seed(page);
  await page.goto('/projects/alpha');
  await page.getByRole('button', { name: 'Add log to Alpha', exact: true }).click();
  await page.getByLabel('Log Name', { exact: true }).fill('Assigned to Beta');
  await page.getByRole('combobox', { name: 'Project (optional)', exact: true }).selectOption('beta');
  await page.getByRole('button', { name: 'Create Log', exact: true }).click();
  expect((await readData(page)).logs.find(log => log.title === 'Assigned to Beta')?.projectId).toBe('beta');
  await page.goto('/projects');
  const before = await readData(page);
  const openDelete = async () => {
    await page.getByRole('button', { name: 'Options for Alpha', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  };
  await openDelete();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await readData(page)).toEqual(before);
  await openDelete();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete Project', exact: true }).click();
  await page.reload();
  const after = await readData(page);
  expect(after.projects.map(project => project.id)).toEqual(['beta']);
  expect(after.logs).toHaveLength(before.logs.length);
  for (const original of before.logs) {
    const saved = after.logs.find(log => log.id === original.id)!;
    expect(saved).toMatchObject({ ...original, projectId: original.projectId === 'alpha' ? null : original.projectId, updatedAt: saved.updatedAt });
  }
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByLabel('Search logs by name').fill('undated');
  await page.getByRole('heading', { name: 'QA undated', exact: true }).click();
  await page.getByLabel('Log Name', { exact: true }).fill('Undated survivor');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  expect((await readData(page)).logs.find(log => log.id === 'undated')).toMatchObject({ title: 'Undated survivor', projectId: null });
  expect((await readData(page)).logs.find(log => log.id === 'undated')?.deadline).toBeUndefined();
});

test('Search includes the archive, sorts undated records last and edits the original record', async ({ page }) => {
  await seed(page);
  await page.goto('/search');
  const input = page.getByLabel('Search logs by name');
  await input.fill('  qA  ');
  await expect(page.getByRole('region', { name: 'ACTIVE', exact: true }).locator('.log-card-title')).toHaveText(['QA early', 'QA later', 'QA undated']);
  await expect(page.getByRole('region', { name: 'COMPLETED', exact: true }).locator('.log-card-title')).toHaveText(['QA completed-new', 'QA completed-old']);
  await page.getByRole('heading', { name: 'QA early', exact: true }).click();
  await page.getByRole('combobox', { name: 'Project (optional)', exact: true }).selectOption('beta');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  expect((await readData(page)).logs.find(log => log.id === 'early')?.projectId).toBe('beta');
  await page.getByRole('button', { name: 'Mark "QA completed-new" as active', exact: true }).click();
  expect((await readData(page)).logs.find(log => log.id === 'completed-new')?.completed).toBe(false);
  await page.getByRole('button', { name: 'Options for "QA later"', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'QA later', exact: true })).toBeHidden();
  expect((await readData(page)).logs.some(log => log.id === 'later')).toBe(false);
  await input.fill('   ');
  await expect(page.locator('.log-card')).toHaveCount(0);
  await input.fill('not-present');
  await expect(page.getByText('NO MATCHES', { exact: true })).toBeVisible();
});

for (const fontSize of FONT_SIZES) {
  test(`offline backup/restore preserves mixed records and ${fontSize} settings`, async ({ page, context }) => {
    await page.goto('/settings');
    await readyOffline(page);
    await context.setOffline(true);
    const initial = await readData(page);
    const data = fixture(fontSize);
    await selectBackup(page, createBackup(data));
    await page.getByRole('alertdialog').getByRole('button', { name: 'CANCEL', exact: true }).click();
    expect(await readData(page)).toEqual(initial);
    await restore(page, data);
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'BACKUP DATA', exact: true }).click();
    const backup = JSON.parse(await readFile((await (await downloaded).path())!, 'utf8'));
    await restore(page, { ...data, logs: [] });
    await selectBackup(page, backup);
    await page.getByRole('alertdialog').getByRole('button', { name: 'RESTORE DATA', exact: true }).click();
    await page.reload();
    expect(await readData(page)).toEqual(data);
    await expect(page.locator('html')).toHaveAttribute('data-font-size', fontSize);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
}

test('invalid backups and failed storage writes leave saved and displayed state intact', async ({ page }) => {
  await seed(page);
  const before = await readData(page);
  for (const invalid of ['{bad json', { ...createBackup(fixture()), backupVersion: 999 }]) {
    await selectBackup(page, invalid);
    await expect(page.getByRole('alert')).toContainText('No existing data was changed');
    expect(await readData(page)).toEqual(before);
  }
  await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(name, value) {
      if (name === key) throw new DOMException('Simulated storage full', 'QuotaExceededError');
      return original.call(this, name, value);
    };
  }, STORAGE_KEY);
  await selectBackup(page, createBackup({ ...fixture(), logs: [] }));
  await page.getByRole('alertdialog').getByRole('button', { name: 'RESTORE DATA', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Existing data was preserved');
  expect(await readData(page)).toEqual(before);
  await page.reload();
  expect(await readData(page)).toEqual(before);
});

test('a worker update preserves open-app data and unrelated caches', async ({ page, context, request }) => {
  await seed(page);
  await readyOffline(page);
  const before = await readData(page);
  await page.evaluate(() => caches.open('unrelated-app-cache'));
  try {
    await request.post('/__test/worker-revision?value=upgrade');
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
    await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.waiting?.state === 'installed');
    expect(await readData(page)).toEqual(before);
    await page.close();
    const reopened = await context.newPage();
    await context.setOffline(true);
    await reopened.goto('/settings');
    await expect(reopened.getByRole('heading', { name: 'SETTINGS', exact: true })).toBeVisible();
    expect(await readData(reopened)).toEqual(before);
    const keys = await reopened.evaluate(() => caches.keys());
    expect(keys).toContain('unrelated-app-cache');
    expect(keys.filter(key => key.startsWith('todop-cache-'))).toHaveLength(1);
    expect(keys.some(key => key.endsWith('-upgrade'))).toBe(true);
  } finally {
    await request.post('/__test/worker-revision');
  }
});

test('the production script policy blocks injected inline scripts while the app works', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.headers()['content-security-policy']).toContain("script-src 'self'");
  await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.__injected = true';
    document.body.append(script);
  });
  expect(await page.evaluate(() => '__injected' in window)).toBe(false);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'SEARCH', exact: true })).toBeVisible();
});
