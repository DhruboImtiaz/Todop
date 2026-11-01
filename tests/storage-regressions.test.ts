import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LocalStorageRepository } from '../src/services/storage/localStorageRepository';
import { SupabaseRepository, emptyWorkspace } from '../src/services/storage/supabaseRepository';
import { createBackup, validateBackup } from '../src/utils/backup';
import { STORAGE_KEY } from '../src/utils/settings';

const values = new Map<string, string>();
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); },
  removeItem: key => { values.delete(key); }, clear: () => values.clear(), length: 0, key: () => null };
const local = new LocalStorageRepository();
await assert.rejects(() => local.createLog({ title: ' ' }), /empty/);
await assert.rejects(() => local.createLog({ title: 'invalid', deadline: 'yesterday-ish' }), /deadline/);
await assert.rejects(() => local.createLog({ title: 'orphan', projectId: 'missing' }), /Project/);
const project = await local.createProject('A project');
await assert.rejects(() => local.reorderProjects([project.id, project.id]), /exactly once/);
const log = await local.createLog({ title: 'Keep the important data', description: 'Clear me', projectId: project.id });
await local.updateLog({ id: log.id, description: '' });
assert.equal((await local.getLogById(log.id))?.description, undefined);
const data = await local.exportData();
for (const corrupt of [
  { ...data, version: 99 },
  { ...data, logs: [...data.logs, data.logs[0]] },
  { ...data, logs: [{ ...log, createdAt: 'invalid' }] },
  { ...data, logs: [{ ...log, projectId: 'missing' }] },
]) {
  assert.equal(validateBackup(createBackup(corrupt)).valid, false);
  await assert.rejects(() => local.importData(corrupt));
}
assert.equal((await local.getLogs()).length, 1);
const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
saved.settings = { theme: 'invalid', fontSize: 'invalid' };
localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
assert.equal((await new LocalStorageRepository().getLogs()).length, 1, 'bad appearance must not erase tasks');

// Model the HTTP contract, including row-version compare-and-swap and failed writes.
let row = { data: emptyWorkspace(), revision: 0 };
let failWrites = false;
const client = { from: () => {
  let patch: Partial<typeof row> | undefined;
  let expected: number | undefined;
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => { if (key === 'revision') expected = value as number; return query; },
    update: (value: typeof row) => { patch = value; return query; },
    maybeSingle: async () => {
      if (!patch) return { data: structuredClone(row), error: null };
      if (failWrites) return { data: null, error: { message: 'Network unavailable' } };
      if (expected !== row.revision) return { data: null, error: null };
      row = { ...row, ...structuredClone(patch) };
      return { data: { revision: row.revision }, error: null };
    },
  };
  return query;
} } as unknown as SupabaseClient;
const cloud = new SupabaseRepository(client, 'user-a');
await cloud.refresh();
const cloudProject = await cloud.createProject('Cloud project');
const cloudLog = await cloud.createLog({ title: 'Cloud task', projectId: cloudProject.id, draftSubtasks: ['First step'] });
await cloud.toggleLogCompletion(cloudLog.id);
assert.equal(cloud.getSnapshot().logs[0].subtasks[0].completed, true);
const deviceCopy = localStorage.getItem(STORAGE_KEY);
await cloud.updateSettings({ theme: 'dark' });
assert.equal(localStorage.getItem(STORAGE_KEY), deviceCopy, 'cloud data must not leak into guest storage');
failWrites = true;
const previous = structuredClone(cloud.getSnapshot());
await assert.rejects(() => cloud.createLog({ title: 'Do not pretend this saved' }), /not saved/);
assert.deepEqual(cloud.getSnapshot(), previous);
failWrites = false;
const otherDevice = new SupabaseRepository(client, 'user-a');
const results = await Promise.allSettled([cloud.createLog({ title: 'Concurrent A' }), otherDevice.createLog({ title: 'Concurrent B' })]);
assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
assert.equal(results.filter(result => result.status === 'rejected').length, 1);
assert.equal(row.data.logs.length, 2, 'one accepted write plus original task');
await cloud.importData(data);
assert.equal(cloud.getSnapshot().logs[0].title, 'Keep the important data');
const beforeEdit = await cloud.getLogById(log.id);
await cloud.updateLog({ id: log.id, title: 'A newer edit' });
await assert.rejects(() => cloud.updateLog({ id: log.id, title: 'A stale edit', expectedFields: {
  title: beforeEdit!.title, description: beforeEdit!.description, deadline: beforeEdit!.deadline, projectId: beforeEdit!.projectId,
} }), /changed since/);
await cloud.deleteProject(project.id);
assert.equal(cloud.getSnapshot().logs[0].projectId, null);
const localCount = (await local.getLogs()).length;
await Promise.all([local.createLog({ title: 'Concurrent local A' }), local.createLog({ title: 'Concurrent local B' })]);
assert.equal((await local.getLogs()).length, localCount + 2);
console.log('✓ Storage regressions: validation, failure rollback, shared cloud operations, account isolation and concurrent-write protection');
