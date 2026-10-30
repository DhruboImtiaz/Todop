import { expect, type Page } from '@playwright/test';
import { createBackup } from '../../src/utils/backup';
import { STORAGE_KEY } from '../../src/utils/settings';
import type { AppDataSchema, AppFontSize, Log } from '../../src/types';

export const NOW = new Date('2026-10-30T10:00:00+06:00');
const timestamp = '2026-10-29T04:00:00.000Z';
export function fixture(fontSize: AppFontSize = 'medium'): AppDataSchema {
  const log = (id: string, patch: Partial<Log> = {}): Log => ({
    id, title: `QA ${id}`, projectId: 'alpha', completed: false, subtasks: [],
    createdAt: timestamp, updatedAt: timestamp, ...patch,
  });
  return {
    version: 1,
    settings: { theme: 'dark', fontSize },
    projects: ['beta', 'alpha'].map((id, order) => ({ id, name: id === 'alpha' ? 'Alpha' : 'Beta', order, createdAt: timestamp, updatedAt: timestamp })),
    logs: [
      log('early', { deadline: '2026-10-30T04:42:00.000Z', subtasks: [false, true].map((completed, index) => ({ id: `sub-${index}`, title: `Step ${index}`, completed, createdAt: timestamp, updatedAt: timestamp })) }),
      log('later', { projectId: 'beta', deadline: '2026-10-31T09:30:00.000Z' }),
      log('undated'),
      log('completed-old', { completed: true }),
      log('completed-new', { projectId: 'beta', completed: true, updatedAt: '2026-10-30T03:00:00.000Z' }),
      log('description-only', { title: 'Another task', description: 'QA appears only in this description', projectId: null, deadline: '2026-11-02T04:00:00.000Z' }),
    ],
  };
}

export const readData = (page: Page): Promise<AppDataSchema> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
export async function selectBackup(page: Page, content: unknown) {
  await page.locator('input[type=file]').setInputFiles({
    name: 'todop-test-backup.json', mimeType: 'application/json',
    buffer: Buffer.from(typeof content === 'string' ? content : JSON.stringify(content)),
  });
}
export async function restore(page: Page, data = fixture()) {
  await selectBackup(page, createBackup(data));
  await page.getByRole('alertdialog').getByRole('button', { name: 'RESTORE DATA', exact: true }).click();
  await expect(page.getByText(/DATA RESTORED:/)).toBeVisible();
}
export async function seed(page: Page, data = fixture()) {
  await page.goto('/settings');
  await restore(page, data);
}
export async function readyOffline(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller);
}
export async function newLog(page: Page, title: string) {
  await page.getByRole('button', { name: 'Create new task log', exact: true }).click();
  await expect(page.getByLabel('Log Name', { exact: true })).toBeFocused();
  await page.getByLabel('Log Name', { exact: true }).fill(title);
}
export async function dateTime(page: Page, date = 'October 31, 2026', hour = 3, minute = 30, period = 'PM') {
  await page.getByRole('button', { name: 'Select date', exact: true }).click();
  const calendar = page.getByRole('dialog', { name: 'Select date', exact: true });
  await calendar.getByRole('button', { name: date, exact: true }).click();
  await calendar.getByRole('button', { name: 'OK', exact: true }).click();
  await page.getByRole('button', { name: 'Select time', exact: true }).click();
  const clock = page.getByRole('dialog', { name: 'Select time', exact: true });
  await clock.getByRole('button', { name: `${hour} hours`, exact: true }).click();
  await clock.getByRole('button', { name: `${minute} minutes`, exact: true }).click();
  await clock.getByRole('button', { name: period, exact: true }).click();
  await clock.getByRole('button', { name: 'OK', exact: true }).click();
}
