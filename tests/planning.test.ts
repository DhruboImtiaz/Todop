import assert from "node:assert/strict";
import { LocalStorageRepository } from "../src/services/storage/localStorageRepository";
import { STORAGE_KEY, LEGACY_STORAGE_KEY } from "../src/utils/settings";
import { createBackup, validateBackup } from "../src/utils/backup";
import { nextRecurringDeadline, isDateKey } from "../src/utils/planning";
import { createDemoData } from "../src/utils/demo";

const values = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => {
    values.set(k, v);
  },
  removeItem: (k) => {
    values.delete(k);
  },
  clear: () => values.clear(),
  length: 0,
  key: () => null,
};
const legacy = {
  version: 1,
  logs: [],
  projects: [],
  settings: { theme: "dark", fontSize: "large" },
};
localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacy));
const repo = new LocalStorageRepository();
assert.equal(repo.getSnapshot().version, 2);
assert.equal(repo.getSnapshot().settings.theme, "dark");
assert.equal(
  localStorage.getItem(LEGACY_STORAGE_KEY),
  JSON.stringify(legacy),
  "leave the old app copy untouched",
);
assert.equal(JSON.parse(localStorage.getItem(STORAGE_KEY)!).version, 2);
assert.equal(isDateKey("2026-02-30"), false);
const today = "2026-11-01";
const tasks = await Promise.all(
  ["One", "Two", "Three", "Four"].map((title) => repo.createLog({ title })),
);
await repo.planMyDay(tasks[0].id, today);
await repo.planMyDay(tasks[1].id, today);
const parallel = await Promise.allSettled([
  repo.planMyDay(tasks[2].id, today),
  repo.planMyDay(tasks[3].id, today),
]);
assert.equal(parallel.filter((r) => r.status === "fulfilled").length, 1);
assert.equal((await repo.getLogs()).filter((l) => l.myDay === today).length, 3);
await repo.planMyDay(tasks[0].id, null);
assert.equal(
  (await repo.getLogById(tasks[0].id))?.deadline,
  undefined,
  "My Day works without a deadline",
);
await assert.rejects(
  () => repo.planMyDay(tasks[0].id, "2026-02-30"),
  /Invalid/,
);

const focusChange = (await repo.changeLogCompletion(tasks[1].id))!;
await repo.planMyDay(tasks[0].id, today);
await repo.planMyDay(tasks[3].id, today);
await assert.rejects(
  () =>
    repo.undoCompletion(focusChange.previous, focusChange.updated.updatedAt),
  /three tasks/,
);
await assert.rejects(
  () => repo.toggleLogCompletion(tasks[1].id),
  /three tasks/,
);
await repo.planMyDay(tasks[0].id, null);
await repo.undoCompletion(focusChange.previous, focusChange.updated.updatedAt);
assert.equal(
  (await repo.getLogs()).filter((l) => !l.completed && l.myDay === today)
    .length,
  3,
);
assert.throws(
  () =>
    nextRecurringDeadline("+275760-09-12T10:00:00.000Z", {
      frequency: "monthly",
      interval: 365,
    }),
  /supported date range/,
);
assert.throws(
  () =>
    nextRecurringDeadline(
      new Date().toISOString(),
      { frequency: "daily", interval: 1 },
      new Date(NaN),
    ),
  /Invalid repeat schedule/,
);

const project = await repo.createProject("A project");
const repeat = await repo.createLog({
  title: "Repeat me",
  projectId: project.id,
  priority: "high",
  deadline: "2026-01-31T10:00:00Z",
  recurrence: { frequency: "monthly", interval: 1 },
  draftSubtasks: ["First", "Second"],
});
const change = (await repo.changeLogCompletion(repeat.id))!;
const next = (await repo.getLogById(change.updated.nextOccurrenceId!))!;
assert.equal(next.seriesId, repeat.id);
assert.equal(next.priority, "high");
assert.equal(next.completed, false);
assert.equal(next.myDay, undefined);
assert.equal(
  next.subtasks.every((s) => !s.completed),
  true,
);
assert.notEqual(next.subtasks[0].id, repeat.subtasks[0].id);
assert.ok(
  Date.parse(next.deadline!) > Date.now(),
  "skip missed occurrences without creating a backlog",
);
assert.equal(
  (await repo.getCompletedLogs()).some((l) => l.id === repeat.id),
  true,
);
await repo.undoCompletion(change.previous, change.updated.updatedAt);
assert.equal(
  await repo.getLogById(next.id),
  null,
  "undo removes an untouched generated occurrence",
);
assert.equal((await repo.getLogById(repeat.id))?.completed, false);
const second = (await repo.changeLogCompletion(repeat.id))!;
const secondId = second.updated.nextOccurrenceId!;
await repo.updateLog({
  id: secondId,
  title: "Someone edited the next occurrence",
});
await assert.rejects(
  () => repo.undoCompletion(second.previous, second.updated.updatedAt),
  /next occurrence has changed/,
);
await repo.toggleLogCompletion(repeat.id);
await repo.toggleLogCompletion(repeat.id);
assert.equal(
  (await repo.getLogs()).filter((l) => l.seriesId === repeat.id).length,
  1,
  "re-completion does not duplicate an existing series child",
);

await repo.deleteLog(secondId);
assert.equal(await repo.getLogById(secondId), null);
assert.equal(
  repo.getSnapshot().trash!.some((item) => item.log.id === secondId),
  true,
);
await repo.deleteProject(project.id);
await repo.restoreLog(secondId);
assert.equal((await repo.getLogById(secondId))?.projectId, null);
await repo.deleteLog(secondId);
const exported = await repo.exportData();
const validation = validateBackup(createBackup(exported));
assert.equal(validation.valid, true);
if (validation.valid) {
  assert.equal(validation.data.trash![0].log.subtasks.length, 2);
  assert.equal(
    validation.data.logs.find((l) => l.id === repeat.id)?.recurrence?.frequency,
    "monthly",
  );
}
const expired = structuredClone(exported);
expired.trash![0].deletedAt = new Date(
  Date.now() - 31 * 86400000,
).toISOString();
await repo.importData(expired);
await assert.rejects(() => repo.restoreLog(secondId), /no longer available/);
for (const recurrence of [
  { frequency: "daily", interval: 0 },
  { frequency: "monthly", interval: 1.5 },
  { frequency: "weekly", interval: 366 },
]) {
  const backup = createBackup(exported);
  Object.assign(backup.data.logs[0], {
    recurrence,
    deadline: new Date().toISOString(),
  });
  assert.equal(validateBackup(backup).valid, false);
}
await assert.rejects(
  () =>
    repo.createLog({
      title: "No date",
      recurrence: { frequency: "daily", interval: 1 },
    }),
  /deadline/,
);

const originalTZ = process.env.TZ;
for (const timezone of ["Asia/Dhaka", "America/New_York"]) {
  process.env.TZ = timezone;
  const jan = new Date(2026, 0, 31, 9, 30);
  const feb = new Date(
    nextRecurringDeadline(
      jan.toISOString(),
      { frequency: "monthly", interval: 1, anchorDay: 31 },
      jan,
    ),
  );
  assert.equal(feb.getDate(), 28);
  assert.equal(feb.getHours(), 9);
  const mar = new Date(
    nextRecurringDeadline(
      feb.toISOString(),
      { frequency: "monthly", interval: 1, anchorDay: 31 },
      feb,
    ),
  );
  assert.equal(mar.getDate(), 31);
  assert.equal(mar.getHours(), 9);
  const beforeDST = new Date(2026, 2, 7, 9, 30);
  const afterDST = new Date(
    nextRecurringDeadline(
      beforeDST.toISOString(),
      { frequency: "daily", interval: 1 },
      beforeDST,
    ),
  );
  assert.equal(afterDST.getDate(), 8);
  assert.equal(afterDST.getHours(), 9);
  const custom = new Date(
    nextRecurringDeadline(
      beforeDST.toISOString(),
      { frequency: "weekly", interval: 2 },
      beforeDST,
    ),
  );
  assert.equal(custom.getDate(), 21);
}
if (originalTZ === undefined) delete process.env.TZ;
else process.env.TZ = originalTZ;
const demo = new LocalStorageRepository("isolated-demo", createDemoData());
await demo.createLog({ title: "Only in the demo" });
assert.equal(
  (await repo.getLogs()).some((l) => l.title === "Only in the demo"),
  false,
);
console.log(
  "✓ Planning: legacy migration, My Day limits, monthly clamping, DST, repeats, guarded undo, soft deletion, expiry, backups and demo isolation",
);
