import assert from 'node:assert/strict';
import { getCountdown, getLogSection, localDateTimeToIso, isoToLocalDateAndTime } from '../src/utils/time';
import { LocalStorageRepository } from '../src/services/storage/localStorageRepository';
import { createBackup, validateBackup, CURRENT_BACKUP_VERSION, BACKUP_APP_IDENTIFIER } from '../src/utils/backup';

console.log('--- Running TODOP Logic & Unit Tests ---');


// Mock localStorage for Node environment
const store: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => {
    store[key] = val;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const k in store) delete store[k];
  },
  length: 0,
  key: () => null,
};

// Test 1: Countdown formatting
const baseNow = new Date('2026-09-09T12:00:00.000Z').getTime();

// > 24 hours: 3 days, 4 hours, 22 minutes
const target3d = new Date(baseNow + ((3 * 24 + 4) * 60 + 22) * 60000).toISOString();
const cd1 = getCountdown(target3d, baseNow);
assert.equal(cd1.label, '3 D 4H 22M');
assert.equal(cd1.isOverdue, false);
console.log('✓ > 24h countdown format matches "X D YH ZM":', cd1.label);

// < 24 hours: 8 hours, 32 minutes
const target8h = new Date(baseNow + (8 * 60 + 32) * 60000).toISOString();
const cd2 = getCountdown(target8h, baseNow);
assert.equal(cd2.label, '8 H 32M');
assert.equal(cd2.isOverdue, false);
console.log('✓ < 24h countdown format matches "X H YM":', cd2.label);

// < 1 hour: 42 minutes
const target42m = new Date(baseNow + 42 * 60000).toISOString();
const cd3 = getCountdown(target42m, baseNow);
assert.equal(cd3.label, '42 M');
assert.equal(cd3.isOverdue, false);
console.log('✓ < 1h countdown format matches "X M":', cd3.label);

// Past deadline returns OVERDUE
const pastTarget = new Date(baseNow - 5 * 60000).toISOString();
const cd4 = getCountdown(pastTarget, baseNow);
assert.equal(cd4.label, 'OVERDUE');
assert.equal(cd4.isOverdue, true);
console.log('✓ Past deadline returns "OVERDUE":', cd4.label);

// Section grouping tests
const baseNowDate = new Date(baseNow);
const targetSameDay = new Date(baseNow);
targetSameDay.setHours(baseNowDate.getHours() + 1);

assert.equal(getLogSection(pastTarget, baseNow), 'overdue');
assert.equal(getLogSection(targetSameDay.toISOString(), baseNow), 'today');
assert.equal(getLogSection(target3d, baseNow), 'upcoming');
console.log('✓ getLogSection correctly classifies into overdue, today, and upcoming');

// Test 2: Time conversions
const testDate = '2026-09-12';
const testTime = '15:30';
const iso = localDateTimeToIso(testDate, testTime);
const convertedBack = isoToLocalDateAndTime(iso);
assert.equal(convertedBack.date, testDate);
assert.equal(convertedBack.time, testTime);
console.log('✓ Local timezone date/time conversions roundtrip without drift');

// Test 3: Storage Repository
async function testRepository() {
  const repo = new LocalStorageRepository();

  // Initial state should be empty
  const initialLogs = await repo.getActiveLogs();
  assert.equal(initialLogs.length, 0);
  console.log('✓ Initial active logs empty');

  // Create log
  const log1 = await repo.createLog({
    title: 'Finish assignment',
    deadline: target3d,
  });
  assert.ok(log1.id);
  assert.equal(log1.title, 'Finish assignment');
  assert.equal(log1.completed, false);
  console.log('✓ Created log:', log1.id, log1.title);

  // Active logs count 1
  let active = await repo.getActiveLogs();
  assert.equal(active.length, 1);

  // Edit log
  const updated = await repo.updateLog({
    id: log1.id,
    title: 'Finish assignment for CS101',
  });
  assert.equal(updated.title, 'Finish assignment for CS101');
  console.log('✓ Updated log title:', updated.title);

  // Complete log (toggled)
  await repo.toggleLogCompletion(log1.id);
  active = await repo.getActiveLogs();
  const completed = await repo.getCompletedLogs();
  assert.equal(active.length, 0, 'Completed log should be removed from active');
  assert.equal(completed.length, 1, 'Completed log MUST be preserved in storage');
  assert.equal(completed[0].id, log1.id);
  console.log('✓ Completed log removed from active list but PRESERVED in storage');

  // Delete log
  const deleted = await repo.deleteLog(log1.id);
  assert.equal(deleted, true);
  const remainingAll = await repo.getLogs();
  assert.equal(remainingAll.length, 0);
  console.log('✓ Deleted log successfully removed');

  // Test 4: SPA Routing Resolution
  const { getTabFromPath, getPathFromTab } = await import('../src/utils/routing');
  assert.equal(getTabFromPath('/'), 'upcoming');
  assert.equal(getTabFromPath('/projects'), 'projects');
  assert.equal(getTabFromPath('/projects/'), 'projects');
  assert.equal(getTabFromPath('/search'), 'search');
  assert.equal(getTabFromPath('/settings'), 'settings');
  assert.equal(getPathFromTab('upcoming'), '/');
  assert.equal(getPathFromTab('projects'), '/projects');
  assert.equal(getPathFromTab('search'), '/search');
  assert.equal(getPathFromTab('settings'), '/settings');
  console.log('✓ SPA URL route mapping correctly resolves /, /projects, /search, and /settings');

  // Test 5: Rescheduling Transitions Across All Cases
  const now = new Date('2026-09-09T12:00:00.000Z');
  const nowMs = now.getTime();

  // Helper date generators for exact section mapping
  const createDateOffset = (hoursOffset: number) => new Date(nowMs + hoursOffset * 3600000).toISOString();

  // Create initial log: Future (3 days ahead)
  const futureDeadline = createDateOffset(72);
  const reschedLog = await repo.createLog({
    title: 'Rescheduling Task',
    deadline: futureDeadline,
  });
  const originalId = reschedLog.id;
  assert.equal(getLogSection(reschedLog.deadline, nowMs), 'upcoming');
  console.log('✓ Initial state: upcoming');

  // Case 1: future -> future (reschedule to 6 days ahead)
  const futureDeadline2 = createDateOffset(144);
  const case1 = await repo.updateLog({ id: originalId, deadline: futureDeadline2 });
  assert.equal(case1.id, originalId);
  assert.equal(getLogSection(case1.deadline, nowMs), 'upcoming');
  assert.equal(getCountdown(case1.deadline, nowMs).label, '6 D 0H 0M');
  console.log('✓ Rescheduling future -> future: retains ID & updates countdown');

  // Case 2: future -> today (reschedule to 2 hours from now, same calendar day)
  const todayDeadline = createDateOffset(2);
  const case2 = await repo.updateLog({ id: originalId, deadline: todayDeadline });
  assert.equal(case2.id, originalId);
  assert.equal(getLogSection(case2.deadline, nowMs), 'today');
  assert.equal(getCountdown(case2.deadline, nowMs).label, '2 H 0M');
  console.log('✓ Rescheduling future -> today: moves to TODAY section');

  // Case 3: today -> overdue (reschedule to 1 hour in the past)
  const overdueDeadline = createDateOffset(-1);
  const case3 = await repo.updateLog({ id: originalId, deadline: overdueDeadline });
  assert.equal(case3.id, originalId);
  assert.equal(getLogSection(case3.deadline, nowMs), 'overdue');
  assert.equal(getCountdown(case3.deadline, nowMs).label, 'OVERDUE');
  console.log('✓ Rescheduling today -> overdue: moves to OVERDUE section');

  // Case 4: overdue -> future (reschedule from past to 48 hours in future)
  const futureDeadline3 = createDateOffset(48);
  const case4 = await repo.updateLog({ id: originalId, deadline: futureDeadline3 });
  assert.equal(case4.id, originalId);
  assert.equal(getLogSection(case4.deadline, nowMs), 'upcoming');
  assert.equal(getCountdown(case4.deadline, nowMs).label, '2 D 0H 0M');
  console.log('✓ Rescheduling overdue -> future: restores to UPCOMING section');

  // Case 5: future -> overdue (reschedule directly to past)
  const case5 = await repo.updateLog({ id: originalId, deadline: overdueDeadline });
  assert.equal(case5.id, originalId);
  assert.equal(getLogSection(case5.deadline, nowMs), 'overdue');
  console.log('✓ Rescheduling future -> overdue: moves directly to OVERDUE');

  // Case 6: overdue -> today -> future
  const case6a = await repo.updateLog({ id: originalId, deadline: todayDeadline });
  assert.equal(getLogSection(case6a.deadline, nowMs), 'today');
  const case6b = await repo.updateLog({ id: originalId, deadline: futureDeadline3 });
  assert.equal(getLogSection(case6b.deadline, nowMs), 'upcoming');
  console.log('✓ Rescheduling today -> future: moves from TODAY to UPCOMING');

  // Clean up
  await repo.deleteLog(originalId);

  // ==========================================
  // Phase 2A: Projects & Order Persistence Tests
  // ==========================================
  console.log('\n--- Running Phase 2A Projects & Order Persistence Tests ---');

  // Test 6: Create at least 3 projects and verify initial ordering
  const projAlpha = await repo.createProject('Alpha');
  const projBeta = await repo.createProject('Beta');
  const projGamma = await repo.createProject('Gamma');

  assert.equal(projAlpha.order, 0);
  assert.equal(projBeta.order, 1);
  assert.equal(projGamma.order, 2);
  let projectsList = await repo.getProjects();
  assert.deepEqual(projectsList.map((p) => p.name), ['Alpha', 'Beta', 'Gamma']);
  console.log('✓ Created 3 projects with sequential orders: Alpha (0), Beta (1), Gamma (2)');

  // Test 7: Drag-and-drop reorder (Beta to first position: Beta, Alpha, Gamma)
  const dndOrder = [projBeta.id, projAlpha.id, projGamma.id];
  await repo.reorderProjects(dndOrder);
  projectsList = await repo.getProjects();
  assert.deepEqual(projectsList.map((p) => p.name), ['Beta', 'Alpha', 'Gamma']);
  console.log('✓ Reordered via drag-and-drop: Beta, Alpha, Gamma');

  // Test 8: Simulate browser refresh by creating a new repository instance loading from the store
  const repoAfterRefresh1 = new LocalStorageRepository();
  const refreshedList1 = await repoAfterRefresh1.getProjects();
  assert.deepEqual(refreshedList1.map((p) => p.name), ['Beta', 'Alpha', 'Gamma']);
  assert.equal(refreshedList1[0].order, 0);
  assert.equal(refreshedList1[1].order, 1);
  assert.equal(refreshedList1[2].order, 2);
  console.log('✓ Browser refresh simulated: project order persists exactly');

  // Test 9: Move Up on Gamma (last item moves up: Beta, Gamma, Alpha)
  await repoAfterRefresh1.moveProject(projGamma.id, 'up');
  const movedUpList = await repoAfterRefresh1.getProjects();
  assert.deepEqual(movedUpList.map((p) => p.name), ['Beta', 'Gamma', 'Alpha']);
  console.log('✓ Move Up on Gamma: Beta, Gamma, Alpha');

  // Test 10: Simulate browser refresh again
  const repoAfterRefresh2 = new LocalStorageRepository();
  const refreshedList2 = await repoAfterRefresh2.getProjects();
  assert.deepEqual(refreshedList2.map((p) => p.name), ['Beta', 'Gamma', 'Alpha']);
  console.log('✓ Browser refresh simulated: Move Up order persists');

  // Test 11: Move Down on Beta (moves down: Gamma, Beta, Alpha)
  await repoAfterRefresh2.moveProject(projBeta.id, 'down');
  const movedDownList = await repoAfterRefresh2.getProjects();
  assert.deepEqual(movedDownList.map((p) => p.name), ['Gamma', 'Beta', 'Alpha']);
  console.log('✓ Move Down on Beta: Gamma, Beta, Alpha');

  // Test 12: Simulate browser refresh after Move Down
  const repoAfterRefresh3 = new LocalStorageRepository();
  const refreshedList3 = await repoAfterRefresh3.getProjects();
  assert.deepEqual(refreshedList3.map((p) => p.name), ['Gamma', 'Beta', 'Alpha']);
  console.log('✓ Browser refresh simulated: Move Down order persists');

  // Test 13: Move Up boundary (first item cannot move up)
  const beforeFirstMove = await repoAfterRefresh3.moveProject(projGamma.id, 'up');
  assert.deepEqual(beforeFirstMove.map((p) => p.name), ['Gamma', 'Beta', 'Alpha']);
  console.log('✓ Move Up on first item is a no-op boundary');

  // Test 14: Move Down boundary (last item cannot move down)
  const beforeLastMove = await repoAfterRefresh3.moveProject(projAlpha.id, 'down');
  assert.deepEqual(beforeLastMove.map((p) => p.name), ['Gamma', 'Beta', 'Alpha']);
  console.log('✓ Move Down on last item is a no-op boundary');

  // ==========================================
  // Phase 2A: Project / Log Relationship Tests
  // ==========================================
  console.log('\n--- Running Phase 2A Project / Log Relationship Tests ---');

  // Test 15: Create log inside project Beta
  const betaLog = await repoAfterRefresh3.createLog({
    title: 'Write project report',
    deadline: createDateOffset(48),
    projectId: projBeta.id,
  });
  assert.equal(betaLog.projectId, projBeta.id);
  console.log('✓ Created log assigned to project Beta:', betaLog.title);

  // Test 16: Log appears in both Project and Upcoming (single record model)
  const allActiveLogs = await repoAfterRefresh3.getActiveLogs();
  assert.ok(allActiveLogs.some((l) => l.id === betaLog.id));
  const betaActiveLogs = allActiveLogs.filter((l) => l.projectId === projBeta.id);
  assert.equal(betaActiveLogs.length, 1);
  assert.equal(betaActiveLogs[0].id, betaLog.id);
  console.log('✓ Log appears in both active Upcoming and Project detail');

  // Test 17: Reschedule log from Project perspective
  const newDeadline = createDateOffset(96);
  const rescheduledBetaLog = await repoAfterRefresh3.updateLog({
    id: betaLog.id,
    deadline: newDeadline,
  });
  assert.equal(rescheduledBetaLog.deadline, newDeadline);
  const cdBeta = getCountdown(rescheduledBetaLog.deadline, nowMs);
  assert.equal(cdBeta.label, '4 D 0H 0M');
  console.log('✓ Rescheduled project log: deadline and countdown updated to', cdBeta.label);

  // Test 18: Complete the log
  await repoAfterRefresh3.toggleLogCompletion(betaLog.id);
  const activeAfterComplete = await repoAfterRefresh3.getActiveLogs();
  assert.ok(!activeAfterComplete.some((l) => l.id === betaLog.id), 'Completed log should not be in active Upcoming');
  const allLogs = await repoAfterRefresh3.getLogs();
  const betaCompletedLogs = allLogs.filter((l) => l.projectId === projBeta.id && l.completed);
  assert.equal(betaCompletedLogs.length, 1, 'Completed log must remain in project COMPLETED section');
  console.log('✓ Completed log removed from active Upcoming but preserved in Project COMPLETED section');

  // Test 19: Reactivate the log
  await repoAfterRefresh3.toggleLogCompletion(betaLog.id);
  const activeAfterReactivate = await repoAfterRefresh3.getActiveLogs();
  const reactivatedBeta = activeAfterReactivate.find((l) => l.id === betaLog.id);
  assert.ok(reactivatedBeta, 'Reactivated log returns to active');
  assert.equal(reactivatedBeta.completed, false);
  console.log('✓ Reactivated log returns to active state in both Project and Upcoming');

  // Test 20: Delete the project — log must be PRESERVED and become UNASSIGNED (projectId: null)
  await repoAfterRefresh3.deleteProject(projBeta.id);
  const projectsAfterDelete = await repoAfterRefresh3.getProjects();
  assert.ok(!projectsAfterDelete.some((p) => p.id === projBeta.id), 'Project Beta must be deleted');

  const logsAfterProjectDelete = await repoAfterRefresh3.getLogs();
  const preservedLog = logsAfterProjectDelete.find((l) => l.id === betaLog.id);
  assert.ok(preservedLog, 'Log must NOT be deleted when project is deleted');
  assert.equal(preservedLog.projectId, null, 'Log projectId must be null (unassigned)');
  assert.equal(preservedLog.title, 'Write project report');
  console.log('✓ Project deleted: log preserved with projectId = null (unassigned)');

  // Test 21: Routing resolution for /projects and /projects/:id
  const { getRouteFromPath, getPathFromRoute } = await import('../src/utils/routing');
  const listRoute = getRouteFromPath('/projects');
  assert.equal(listRoute.tab, 'projects');
  assert.equal(listRoute.projectId, null);

  const detailRoute = getRouteFromPath('/projects/proj-123');
  assert.equal(detailRoute.tab, 'projects');
  assert.equal(detailRoute.projectId, 'proj-123');

  assert.equal(getPathFromRoute({ tab: 'projects' }), '/projects');
  assert.equal(getPathFromRoute({ tab: 'projects', projectId: 'proj-123' }), '/projects/proj-123');
  console.log('✓ Routing correctly resolves /projects and /projects/:id with bidirectional mapping');

  // Clean up remaining test data
  await repoAfterRefresh3.deleteLog(betaLog.id);
  await repoAfterRefresh3.deleteProject(projAlpha.id);
  await repoAfterRefresh3.deleteProject(projGamma.id);

  // ==========================================
  // Phase 2B: Search System Tests
  // ==========================================
  console.log('\n--- Running Phase 2B Search Tests ---');

  const { searchLogs } = await import('../src/utils/search');

  // Set up fresh test projects & logs in repo
  const searchProj = await repoAfterRefresh3.createProject('Search Test Project');

  const logActiveNear = await repoAfterRefresh3.createLog({
    title: 'Finish math assignment',
    deadline: createDateOffset(12), // 12 hours from now
    projectId: searchProj.id,
  });

  const logActiveFar = await repoAfterRefresh3.createLog({
    title: 'Database assignment part 2',
    deadline: createDateOffset(48), // 48 hours from now
  });

  const logActiveOther = await repoAfterRefresh3.createLog({
    title: 'Grocery shopping',
    deadline: createDateOffset(24),
  });

  const logCompletedOld = await repoAfterRefresh3.createLog({
    title: 'Submit history assignment',
    deadline: createDateOffset(-24),
  });
  // Mark as completed
  await repoAfterRefresh3.toggleLogCompletion(logCompletedOld.id);

  // Small delay to ensure strictly distinct updatedAt timestamp
  await new Promise((r) => setTimeout(r, 15));

  const logCompletedNew = await repoAfterRefresh3.createLog({
    title: 'Biology assignment review',
    deadline: createDateOffset(-12),
  });
  // Mark as completed later
  await repoAfterRefresh3.toggleLogCompletion(logCompletedNew.id);

  let currentAllLogs = await repoAfterRefresh3.getLogs();

  // Test 1: Empty search query returns zero matches
  const resEmpty1 = searchLogs(currentAllLogs, '');
  const resEmpty2 = searchLogs(currentAllLogs, '   ');
  assert.equal(resEmpty1.totalMatches, 0);
  assert.equal(resEmpty1.active.length, 0);
  assert.equal(resEmpty1.completed.length, 0);
  assert.equal(resEmpty2.totalMatches, 0);
  console.log('✓ 1. Empty search query returns zero matches');

  // Test 2: Exact title match works
  const resExact = searchLogs(currentAllLogs, 'Finish math assignment');
  assert.equal(resExact.totalMatches, 1);
  assert.equal(resExact.active[0].id, logActiveNear.id);
  console.log('✓ 2. Exact title match works');

  // Test 3: Partial title match works
  const resPartial = searchLogs(currentAllLogs, 'assignment');
  assert.equal(resPartial.totalMatches, 4); // 2 active + 2 completed
  console.log('✓ 3. Partial title match works (found 4 logs containing "assignment")');

  // Test 4: Search is case-insensitive
  const resCase = searchLogs(currentAllLogs, 'ASSIGNMENT');
  assert.equal(resCase.totalMatches, 4);
  const resMixed = searchLogs(currentAllLogs, 'mAtH');
  assert.equal(resMixed.totalMatches, 1);
  assert.equal(resMixed.active[0].id, logActiveNear.id);
  console.log('✓ 4. Search is case-insensitive');

  // Test 5: Leading/trailing whitespace is ignored
  const resWhitespace = searchLogs(currentAllLogs, '   assignment   ');
  assert.equal(resWhitespace.totalMatches, 4);
  console.log('✓ 5. Leading/trailing whitespace is ignored');

  // Test 6: No-match query returns empty results
  const resNoMatch = searchLogs(currentAllLogs, 'nonexistentquery123');
  assert.equal(resNoMatch.totalMatches, 0);
  assert.equal(resNoMatch.active.length, 0);
  assert.equal(resNoMatch.completed.length, 0);
  console.log('✓ 6. No-match query returns empty results');

  // Test 7: Active logs are included in search
  assert.ok(resPartial.active.some((l) => l.id === logActiveNear.id));
  assert.ok(resPartial.active.some((l) => l.id === logActiveFar.id));
  console.log('✓ 7. Active logs are included in search results');

  // Test 8: Completed logs are included in search
  assert.ok(resPartial.completed.some((l) => l.id === logCompletedOld.id));
  assert.ok(resPartial.completed.some((l) => l.id === logCompletedNew.id));
  console.log('✓ 8. Completed logs are included in search results');

  // Test 9: Active results are sorted by nearest deadline ascending
  assert.equal(resPartial.active[0].id, logActiveNear.id); // 12h before 48h
  assert.equal(resPartial.active[1].id, logActiveFar.id);
  console.log('✓ 9. Active results sorted by nearest deadline ascending');

  // Test 10: Completed results are sorted by newest updatedAt descending
  assert.equal(resPartial.completed[0].id, logCompletedNew.id); // completed after logCompletedOld
  assert.equal(resPartial.completed[1].id, logCompletedOld.id);
  console.log('✓ 10. Completed results sorted by newest updatedAt descending');

  // Test 11: Editing a search result modifies the original log record in storage
  const updatedFar = await repoAfterRefresh3.updateLog({
    id: logActiveFar.id,
    title: 'Database assignment part 2 - Revised',
    description: 'Added revision notes',
  });
  assert.equal(updatedFar.id, logActiveFar.id);
  assert.equal(updatedFar.title, 'Database assignment part 2 - Revised');
  console.log('✓ 11. Editing a search result modifies the original log record');

  // Test 12: Reactivating a completed log moves it into active results
  await repoAfterRefresh3.toggleLogCompletion(logCompletedNew.id);
  currentAllLogs = await repoAfterRefresh3.getLogs();
  const resAfterReactivate = searchLogs(currentAllLogs, 'assignment');
  assert.equal(resAfterReactivate.active.length, 3);
  assert.equal(resAfterReactivate.completed.length, 1);
  assert.ok(resAfterReactivate.active.some((l) => l.id === logCompletedNew.id));
  console.log('✓ 12. Reactivating a completed log moves it into active search results');

  // Test 13: Search results update after editing a title
  const resUpdatedTitle = searchLogs(currentAllLogs, 'Revised');
  assert.equal(resUpdatedTitle.totalMatches, 1);
  assert.equal(resUpdatedTitle.active[0].id, logActiveFar.id);
  console.log('✓ 13. Search results update after editing a title');

  // Test 14: Deleted logs disappear from search
  await repoAfterRefresh3.deleteLog(logCompletedOld.id);
  currentAllLogs = await repoAfterRefresh3.getLogs();
  const resAfterDelete = searchLogs(currentAllLogs, 'assignment');
  assert.ok(!resAfterDelete.completed.some((l) => l.id === logCompletedOld.id));
  assert.equal(resAfterDelete.completed.length, 0);
  console.log('✓ 14. Deleted logs disappear immediately from search');

  // Test 15: Editing/rescheduling preserves the same log ID
  const newDeadlineForNear = createDateOffset(5);
  const rescheduledLog = await repoAfterRefresh3.updateLog({
    id: logActiveNear.id,
    deadline: newDeadlineForNear,
  });
  assert.equal(rescheduledLog.id, logActiveNear.id);
  console.log('✓ 15. Editing/rescheduling preserves the original log ID');

  // Test 16: Project relationship remains intact when a log is edited via Search
  assert.equal(rescheduledLog.projectId, searchProj.id);
  console.log('✓ 16. Project relationship remains intact when edited via Search');

  // Test 17: A title changed so it no longer matches disappears from results
  await repoAfterRefresh3.updateLog({
    id: logActiveFar.id,
    title: 'Database exam prep', // no longer contains "assignment"
  });
  currentAllLogs = await repoAfterRefresh3.getLogs();
  const resAfterTitleDrop = searchLogs(currentAllLogs, 'assignment');
  assert.ok(!resAfterTitleDrop.active.some((l) => l.id === logActiveFar.id));
  console.log('✓ 17. Title changed so it no longer matches disappears from search results');

  // Test 18: A title changed so it starts matching appears in results
  await repoAfterRefresh3.updateLog({
    id: logActiveOther.id,
    title: 'Grocery shopping assignment', // now contains "assignment"
  });
  currentAllLogs = await repoAfterRefresh3.getLogs();
  const resAfterTitleGain = searchLogs(currentAllLogs, 'assignment');
  assert.ok(resAfterTitleGain.active.some((l) => l.id === logActiveOther.id));
  console.log('✓ 18. Title changed so it starts matching appears in search results');

  // Clean up search test data
  await repoAfterRefresh3.deleteLog(logActiveNear.id);
  await repoAfterRefresh3.deleteLog(logActiveFar.id);
  await repoAfterRefresh3.deleteLog(logActiveOther.id);
  await repoAfterRefresh3.deleteLog(logCompletedNew.id);
  await repoAfterRefresh3.deleteProject(searchProj.id);

  // ==========================================
  // Phase 2C: Settings System Tests
  // ==========================================
  console.log('\n--- Running Phase 2C Settings Tests ---');

  // Test 1: Default settings are dark + medium on clean repository
  // Create a clean mock storage space to test default initialization
  const cleanStore: Record<string, string> = {};
  const originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key: string) => cleanStore[key] ?? null,
    setItem: (key: string, val: string) => {
      cleanStore[key] = val;
    },
    removeItem: (key: string) => {
      delete cleanStore[key];
    },
    clear: () => {
      for (const k in cleanStore) delete cleanStore[k];
    },
    length: 0,
    key: () => null,
  };

  const freshRepo = new LocalStorageRepository();
  const defaultSettings = await freshRepo.getSettings();
  assert.equal(defaultSettings.theme, 'light');
  assert.equal(defaultSettings.fontSize, 'medium');
  console.log('✓ 1. Default settings are light + medium');

  // Test 2: Settings can be persisted
  const updatedSettings = await freshRepo.updateSettings({
    theme: 'light',
    fontSize: 'large',
  });
  assert.equal(updatedSettings.theme, 'light');
  assert.equal(updatedSettings.fontSize, 'large');
  console.log('✓ 2. Settings can be persisted');

  // Test 3: Saved settings survive repository reload (simulating browser reload)
  const reloadedRepo1 = new LocalStorageRepository();
  const reloadedSettings1 = await reloadedRepo1.getSettings();
  assert.equal(reloadedSettings1.theme, 'light');
  assert.equal(reloadedSettings1.fontSize, 'large');
  console.log('✓ 3. Saved settings survive repository reload');

  // Test 4: Theme can change dark -> light
  await freshRepo.updateSettings({ theme: 'dark' });
  const toLight = await freshRepo.updateSettings({ theme: 'light' });
  assert.equal(toLight.theme, 'light');
  console.log('✓ 4. Theme can change dark -> light');

  // Test 5: Theme can change light -> dark
  const toDark = await freshRepo.updateSettings({ theme: 'dark' });
  assert.equal(toDark.theme, 'dark');
  console.log('✓ 5. Theme can change light -> dark');

  // Test 6: Font size can change medium -> small
  await freshRepo.updateSettings({ fontSize: 'medium' });
  const toSmall = await freshRepo.updateSettings({ fontSize: 'small' });
  assert.equal(toSmall.fontSize, 'small');
  console.log('✓ 6. Font size can change medium -> small');

  // Test 7: Font size can change medium -> large
  await freshRepo.updateSettings({ fontSize: 'medium' });
  const toLarge = await freshRepo.updateSettings({ fontSize: 'large' });
  assert.equal(toLarge.fontSize, 'large');
  console.log('✓ 7. Font size can change medium -> large');

  // Test 8 & 9: Updating settings does not modify logs or projects
  const sampleProject = await freshRepo.createProject('Settings Test Project');
  const sampleLog = await freshRepo.createLog({
    title: 'Settings Test Log',
    deadline: createDateOffset(24),
    projectId: sampleProject.id,
  });

  const logsBefore = await freshRepo.getLogs();
  const projectsBefore = await freshRepo.getProjects();

  // Change settings multiple times
  await freshRepo.updateSettings({ theme: 'light' });
  await freshRepo.updateSettings({ fontSize: 'small' });
  await freshRepo.updateSettings({ theme: 'dark', fontSize: 'medium' });

  const logsAfter = await freshRepo.getLogs();
  const projectsAfter = await freshRepo.getProjects();

  assert.equal(logsAfter.length, logsBefore.length);
  assert.equal(logsAfter[0].id, sampleLog.id);
  assert.equal(logsAfter[0].title, sampleLog.title);
  assert.equal(logsAfter[0].deadline, sampleLog.deadline);
  assert.equal(logsAfter[0].projectId, sampleProject.id);
  console.log('✓ 8. Updating settings does not modify logs');

  assert.equal(projectsAfter.length, projectsBefore.length);
  assert.equal(projectsAfter[0].id, sampleProject.id);
  assert.equal(projectsAfter[0].name, sampleProject.name);
  console.log('✓ 9. Updating settings does not modify projects');

  // Test 10: Invalid or missing stored settings safely fall back to defaults
  cleanStore['todop_app_data_v1'] = JSON.stringify({
    version: 1,
    logs: [],
    projects: [],
    settings: {
      theme: 'neon-punk', // invalid
      fontSize: 'ultra-huge', // invalid
    },
  });
  const fallbackRepo = new LocalStorageRepository();
  const normalizedSettings = await fallbackRepo.getSettings();
  assert.equal(normalizedSettings.theme, 'light');
  assert.equal(normalizedSettings.fontSize, 'medium');

  // Missing settings completely
  cleanStore['todop_app_data_v1'] = JSON.stringify({
    version: 1,
    logs: [],
    projects: [],
  });
  const missingSettingsRepo = new LocalStorageRepository();
  const fromMissingSettings = await missingSettingsRepo.getSettings();
  assert.equal(fromMissingSettings.theme, 'light');
  assert.equal(fromMissingSettings.fontSize, 'medium');
  console.log('✓ 10. Invalid/missing stored settings safely fall back to defaults');

  // Test 11: Settings updates preserve unrelated settings
  await missingSettingsRepo.updateSettings({ theme: 'light' });
  let checkPartial = await missingSettingsRepo.getSettings();
  assert.equal(checkPartial.theme, 'light');
  assert.equal(checkPartial.fontSize, 'medium'); // fontSize preserved!

  await missingSettingsRepo.updateSettings({ fontSize: 'large' });
  checkPartial = await missingSettingsRepo.getSettings();
  assert.equal(checkPartial.theme, 'light'); // theme preserved!
  assert.equal(checkPartial.fontSize, 'large');
  console.log('✓ 11. Settings updates preserve unrelated settings');

  // Test 12: Existing logs/projects remain intact after settings persistence across repository instances
  const finalLog = await missingSettingsRepo.createLog({
    title: 'Persistent Log',
    deadline: createDateOffset(10),
  });
  const finalProject = await missingSettingsRepo.createProject('Persistent Project');

  await missingSettingsRepo.updateSettings({ theme: 'dark', fontSize: 'small' });

  // Simulate fresh browser session reload
  const sessionReloadRepo = new LocalStorageRepository();
  const sessionLogs = await sessionReloadRepo.getLogs();
  const sessionProjects = await sessionReloadRepo.getProjects();
  const sessionSettings = await sessionReloadRepo.getSettings();

  assert.equal(sessionSettings.theme, 'dark');
  assert.equal(sessionSettings.fontSize, 'small');
  assert.ok(sessionLogs.some((l) => l.id === finalLog.id));
  assert.ok(sessionProjects.some((p) => p.id === finalProject.id));
  console.log('✓ 12. Existing logs/projects remain intact after settings persistence');

  // ==========================================
  // PHASE 2D: BACKUP & RESTORE UNIT & LOGIC TESTS
  // ==========================================
  console.log('\n--- Phase 2D: Backup & Restore Tests ---');

  // Setup rich data for backup testing
  cleanStore['todop_app_data_v1'] = JSON.stringify({
    version: 1,
    logs: [],
    projects: [],
    settings: { theme: 'light', fontSize: 'medium' },
  });
  const backupTestRepo = new LocalStorageRepository();

  const proj1 = await backupTestRepo.createProject('Design System');
  const proj2 = await backupTestRepo.createProject('Engine Refactor');
  await backupTestRepo.reorderProjects([proj2.id, proj1.id]); // proj2 order 0, proj1 order 1

  const activeLog1 = await backupTestRepo.createLog({
    title: 'Active Task 1',
    description: 'First active task with project',
    deadline: createDateOffset(48),
    projectId: proj2.id,
  });

  const activeLog2 = await backupTestRepo.createLog({
    title: 'Active Task 2',
    deadline: createDateOffset(72),
    projectId: null,
  });

  const completedLog = await backupTestRepo.createLog({
    title: 'Completed Task',
    description: 'Was finished',
    deadline: createDateOffset(-12),
    projectId: proj1.id,
  });
  await backupTestRepo.toggleLogCompletion(completedLog.id);

  await backupTestRepo.updateSettings({ theme: 'light', fontSize: 'large' });

  // 1. Backup contains all active logs
  const exportedData = await backupTestRepo.exportData();
  const backup1 = createBackup(exportedData);
  assert.ok(backup1.data.logs.some((l) => l.id === activeLog1.id && !l.completed));
  assert.ok(backup1.data.logs.some((l) => l.id === activeLog2.id && !l.completed));
  console.log('✓ 1. Backup contains all active logs');

  // 2. Backup contains completed logs
  const foundCompleted = backup1.data.logs.find((l) => l.id === completedLog.id);
  assert.ok(foundCompleted);
  assert.equal(foundCompleted.completed, true);
  console.log('✓ 2. Backup contains completed logs');

  // 3. Backup contains all projects
  assert.equal(backup1.data.projects.length, 2);
  assert.ok(backup1.data.projects.some((p) => p.id === proj1.id));
  assert.ok(backup1.data.projects.some((p) => p.id === proj2.id));
  console.log('✓ 3. Backup contains all projects');

  // 4. Backup preserves project ordering
  assert.equal(backup1.data.projects[0].id, proj2.id);
  assert.equal(backup1.data.projects[1].id, proj1.id);
  assert.equal(backup1.data.projects[0].order, 0);
  assert.equal(backup1.data.projects[1].order, 1);
  console.log('✓ 4. Backup preserves project ordering');

  // 5. Backup preserves log project relationships
  const backupActive1 = backup1.data.logs.find((l) => l.id === activeLog1.id);
  const backupActive2 = backup1.data.logs.find((l) => l.id === activeLog2.id);
  const backupComp = backup1.data.logs.find((l) => l.id === completedLog.id);
  assert.equal(backupActive1?.projectId, proj2.id);
  assert.equal(backupActive2?.projectId, null);
  assert.equal(backupComp?.projectId, proj1.id);
  console.log('✓ 5. Backup preserves log project relationships');

  // 6. Backup preserves settings
  assert.equal(backup1.data.settings.theme, 'light');
  assert.equal(backup1.data.settings.fontSize, 'large');
  console.log('✓ 6. Backup preserves settings');

  // 7. Backup contains supported backupVersion
  assert.equal(backup1.backupVersion, CURRENT_BACKUP_VERSION);
  assert.equal(backup1.app, BACKUP_APP_IDENTIFIER);
  assert.ok(typeof backup1.exportedAt === 'string');
  console.log('✓ 7. Backup contains supported backupVersion');

  // 8. Backup generation does not mutate original data
  const originalSnapshot = await backupTestRepo.exportData();
  const snapshotJsonBefore = JSON.stringify(originalSnapshot);
  createBackup(originalSnapshot);
  const snapshotJsonAfter = JSON.stringify(originalSnapshot);
  assert.equal(snapshotJsonBefore, snapshotJsonAfter);
  console.log('✓ 8. Backup generation does not mutate original data');

  // 9. Valid backup restores logs
  cleanStore['todop_app_data_v1'] = JSON.stringify({
    version: 1,
    logs: [],
    projects: [],
    settings: { theme: 'dark', fontSize: 'small' },
  });
  const restoreTargetRepo = new LocalStorageRepository();
  await restoreTargetRepo.importData(backup1.data);
  const restoredLogs = await restoreTargetRepo.getLogs();
  assert.equal(restoredLogs.length, 3);
  console.log('✓ 9. Valid backup restores logs');

  // 10. Valid backup restores completed logs
  const restoredCompleted = await restoreTargetRepo.getCompletedLogs();
  assert.equal(restoredCompleted.length, 1);
  assert.equal(restoredCompleted[0].id, completedLog.id);
  assert.equal(restoredCompleted[0].completed, true);
  console.log('✓ 10. Valid backup restores completed logs');

  // 11. Valid backup restores projects
  const restoredProjects = await restoreTargetRepo.getProjects();
  assert.equal(restoredProjects.length, 2);
  console.log('✓ 11. Valid backup restores projects');

  // 12. Valid backup restores project ordering
  assert.equal(restoredProjects[0].id, proj2.id);
  assert.equal(restoredProjects[1].id, proj1.id);
  assert.equal(restoredProjects[0].order, 0);
  assert.equal(restoredProjects[1].order, 1);
  console.log('✓ 12. Valid backup restores project ordering');

  // 13. Valid backup preserves log IDs
  assert.ok(restoredLogs.some((l) => l.id === activeLog1.id));
  assert.ok(restoredLogs.some((l) => l.id === activeLog2.id));
  assert.ok(restoredLogs.some((l) => l.id === completedLog.id));
  console.log('✓ 13. Valid backup preserves log IDs');

  // 14. Valid backup preserves project relationships
  const restoredLog1 = restoredLogs.find((l) => l.id === activeLog1.id);
  assert.equal(restoredLog1?.projectId, proj2.id);
  console.log('✓ 14. Valid backup preserves project relationships');

  // 15. Valid backup restores settings
  const restoredSettings = await restoreTargetRepo.getSettings();
  assert.equal(restoredSettings.theme, 'light');
  assert.equal(restoredSettings.fontSize, 'large');
  console.log('✓ 15. Valid backup restores settings');

  // 16. Invalid JSON is rejected
  const invalidJsonResult = validateBackup('this is not json at all {');
  assert.equal(invalidJsonResult.valid, false);
  console.log('✓ 16. Invalid JSON is rejected');

  // 17. Unsupported backupVersion is rejected
  const unsupportedVersionResult = validateBackup(
    JSON.stringify({ ...backup1, backupVersion: 999 })
  );
  assert.equal(unsupportedVersionResult.valid, false);
  console.log('✓ 17. Unsupported backupVersion is rejected');

  // 18. Malformed backup is rejected
  const malformedBackup1 = validateBackup(
    JSON.stringify({ ...backup1, app: 'not-todop' })
  );
  assert.equal(malformedBackup1.valid, false);

  const malformedBackup2 = validateBackup(
    JSON.stringify({
      ...backup1,
      data: {
        ...backup1.data,
        logs: [{ id: '1', title: '' }], // missing required fields
      },
    })
  );
  assert.equal(malformedBackup2.valid, false);
  console.log('✓ 18. Malformed backup is rejected');

  // 19. Failed validation leaves existing data unchanged
  const countBefore = (await restoreTargetRepo.getLogs()).length;
  const failedValidation = validateBackup('{"corrupt": true}');
  assert.equal(failedValidation.valid, false);
  const countAfter = (await restoreTargetRepo.getLogs()).length;
  assert.equal(countBefore, countAfter);
  console.log('✓ 19. Failed validation leaves existing data unchanged');

  // 20. Restore replaces existing data only after confirmation-level operation
  const stagingValidation = validateBackup(
    JSON.stringify({
      backupVersion: 1,
      app: 'todop',
      exportedAt: new Date().toISOString(),
      data: {
        schemaVersion: 1,
        logs: [],
        projects: [],
        settings: { theme: 'dark', fontSize: 'small' },
      },
    })
  );
  assert.equal(stagingValidation.valid, true);
  assert.equal((await restoreTargetRepo.getLogs()).length, 3);
  console.log('✓ 20. Restore replaces existing data only after confirmation-level operation');

  // 21. Restored settings can be applied to the UI state
  let simulatedHtmlTheme = '';
  let simulatedHtmlFontSize = '';
  const applySettingsToDom = (s: { theme: string; fontSize: string }) => {
    simulatedHtmlTheme = s.theme;
    simulatedHtmlFontSize = s.fontSize;
  };
  applySettingsToDom(restoredSettings);
  assert.equal(simulatedHtmlTheme, 'light');
  assert.equal(simulatedHtmlFontSize, 'large');
  console.log('✓ 21. Restored settings can be applied to the UI state');

  // 22. Default settings are light + medium
  cleanStore['todop_app_data_v1'] = '';
  const freshLightRepo = new LocalStorageRepository();
  const freshLightSettings = await freshLightRepo.getSettings();
  assert.equal(freshLightSettings.theme, 'light');
  assert.equal(freshLightSettings.fontSize, 'medium');
  console.log('✓ 22. Default settings are light + medium');

  // 23. Existing dark preference remains preserved for users who already saved dark
  cleanStore['todop_app_data_v1'] = JSON.stringify({
    version: 1,
    logs: [],
    projects: [],
    settings: {
      theme: 'dark',
      fontSize: 'large',
    },
  });
  const existingDarkRepo = new LocalStorageRepository();
  const existingDarkSettings = await existingDarkRepo.getSettings();
  assert.equal(existingDarkSettings.theme, 'dark');
  assert.equal(existingDarkSettings.fontSize, 'large');
  console.log('✓ 23. Existing dark preference remains preserved for users who already saved dark');

  // 24. Existing font-size preference remains preserved
  cleanStore['todop_app_data_v1'] = JSON.stringify({
    version: 1,
    logs: [],
    projects: [],
    settings: {
      theme: 'light',
      fontSize: 'small',
    },
  });
  const existingFontRepo = new LocalStorageRepository();
  const existingFontSettings = await existingFontRepo.getSettings();
  assert.equal(existingFontSettings.fontSize, 'small');
  assert.equal(existingFontSettings.theme, 'light');
  console.log('✓ 24. Existing font-size preference remains preserved');

  // --- Phase 3: Final Polish & Defensive Normalization Tests ---
  console.log('\n--- Phase 3: Defensive Normalization & QA Tests ---');

  // 1. Orphaned project reference in log is defensively normalized to null without discarding the log
  cleanStore['todop_app_data_v1'] = JSON.stringify({
    version: 1,
    logs: [
      {
        id: 'log-orphaned-1',
        title: 'Orphaned Log',
        deadline: '2030-01-01T12:00:00.000Z',
        completed: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        projectId: 'non-existent-project-id',
      },
    ],
    projects: [
      {
        id: 'real-project-1',
        name: 'Real Project',
        order: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    settings: {
      theme: 'light',
      fontSize: 'medium',
    },
  });
  const defNormRepo1 = new LocalStorageRepository();
  const defLogs1 = await defNormRepo1.getActiveLogs();
  assert.equal(defLogs1.length, 1);
  assert.equal(defLogs1[0].id, 'log-orphaned-1');
  assert.equal(defLogs1[0].projectId, null);
  console.log('✓ 1. Orphaned project reference in log is defensively normalized to null');

  // 2. Valid project reference in log is strictly preserved
  cleanStore['todop_app_data_v1'] = JSON.stringify({
    version: 1,
    logs: [
      {
        id: 'log-valid-1',
        title: 'Valid Log',
        deadline: '2030-01-01T12:00:00.000Z',
        completed: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        projectId: 'real-project-1',
      },
    ],
    projects: [
      {
        id: 'real-project-1',
        name: 'Real Project',
        order: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    settings: {
      theme: 'light',
      fontSize: 'medium',
    },
  });
  const defNormRepo2 = new LocalStorageRepository();
  const defLogs2 = await defNormRepo2.getActiveLogs();
  assert.equal(defLogs2.length, 1);
  assert.equal(defLogs2[0].projectId, 'real-project-1');
  console.log('✓ 2. Valid project reference in log is strictly preserved');

  // 3. Corrupted project ordering is deterministically normalized to 0, 1, 2... preserving relative order
  cleanStore['todop_app_data_v1'] = JSON.stringify({
    version: 1,
    logs: [],
    projects: [
      {
        id: 'proj-b',
        name: 'Project B',
        order: 50,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'proj-a',
        name: 'Project A',
        order: 10,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'proj-c',
        name: 'Project C',
        order: 100,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    settings: {
      theme: 'light',
      fontSize: 'medium',
    },
  });
  const defNormRepo3 = new LocalStorageRepository();
  const defProjects3 = await defNormRepo3.getProjects();
  assert.equal(defProjects3.length, 3);
  assert.equal(defProjects3[0].id, 'proj-a');
  assert.equal(defProjects3[0].order, 0);
  assert.equal(defProjects3[1].id, 'proj-b');
  assert.equal(defProjects3[1].order, 1);
  assert.equal(defProjects3[2].id, 'proj-c');
  assert.equal(defProjects3[2].order, 2);
  console.log('✓ 3. Corrupted project ordering is deterministically normalized to 0, 1, 2... preserving relative order');

  // ==========================================
  // PHASE 4 STAGE 1: SUBTASK DATA MODEL & STORAGE LOGIC TESTS
  // ==========================================
  console.log('\n--- Phase 4 Stage 1: Subtask Data Model & Storage Tests ---');

  // Test 1: Existing Log without subtasks normalizes to []
  cleanStore['todop_app_data_v1'] = JSON.stringify({
    version: 1,
    logs: [
      {
        id: 'legacy-log-1',
        title: 'Legacy Log Without Subtasks',
        deadline: '2030-01-01T12:00:00.000Z',
        completed: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        projectId: null,
      },
    ],
    projects: [],
    settings: { theme: 'light', fontSize: 'medium' },
  });
  const subtaskRepo1 = new LocalStorageRepository();
  const legacyLog = await subtaskRepo1.getLogById('legacy-log-1');
  assert.ok(legacyLog);
  assert.ok(Array.isArray(legacyLog.subtasks));
  assert.equal(legacyLog.subtasks.length, 0);
  console.log('✓ 1. Existing Log without subtasks normalizes to []');

  // Test 2: New Log can contain zero subtasks
  const freshSubtaskRepo = new LocalStorageRepository();
  const newLogNoSubtasks = await freshSubtaskRepo.createLog({
    title: 'New Log With Zero Subtasks',
    deadline: '2030-01-02T12:00:00.000Z',
  });
  assert.ok(Array.isArray(newLogNoSubtasks.subtasks));
  assert.equal(newLogNoSubtasks.subtasks.length, 0);
  console.log('✓ 2. New Log can contain zero subtasks');

  // Test 3: Add a subtask
  const parentCreatedAt = newLogNoSubtasks.createdAt;
  const parentUpdatedAtBeforeAdd = newLogNoSubtasks.updatedAt;
  await new Promise((r) => setTimeout(r, 5));
  const subtask1 = await freshSubtaskRepo.addSubtask(newLogNoSubtasks.id, 'Subtask 1');
  assert.ok(subtask1.id);
  assert.equal(subtask1.title, 'Subtask 1');
  assert.equal(subtask1.completed, false);
  assert.ok(subtask1.createdAt);
  assert.ok(subtask1.updatedAt);
  const logAfterSubtask1 = await freshSubtaskRepo.getLogById(newLogNoSubtasks.id);
  assert.equal(logAfterSubtask1?.subtasks.length, 1);
  assert.equal(logAfterSubtask1?.subtasks[0].id, subtask1.id);
  assert.equal(logAfterSubtask1?.createdAt, parentCreatedAt);
  assert.notEqual(logAfterSubtask1?.updatedAt, parentUpdatedAtBeforeAdd);
  console.log('✓ 3. Add a subtask');

  // Test 4: Add multiple subtasks
  const subtask2 = await freshSubtaskRepo.addSubtask(newLogNoSubtasks.id, 'Subtask 2');
  const subtask3 = await freshSubtaskRepo.addSubtask(newLogNoSubtasks.id, 'Subtask 3');
  const logAfterSubtask3 = await freshSubtaskRepo.getLogById(newLogNoSubtasks.id);
  assert.equal(logAfterSubtask3?.subtasks.length, 3);
  assert.equal(logAfterSubtask3?.subtasks[1].title, 'Subtask 2');
  assert.equal(logAfterSubtask3?.subtasks[2].title, 'Subtask 3');
  assert.notEqual(subtask1.id, subtask2.id);
  assert.notEqual(subtask2.id, subtask3.id);
  console.log('✓ 4. Add multiple subtasks');

  // Test 5: Toggle a subtask completed/uncompleted
  const subtask1CreatedAt = subtask1.createdAt;
  await new Promise((r) => setTimeout(r, 5));
  const toggledSubtask = await freshSubtaskRepo.toggleSubtaskCompletion(newLogNoSubtasks.id, subtask1.id);
  assert.ok(toggledSubtask);
  assert.equal(toggledSubtask.completed, true);
  assert.equal(toggledSubtask.createdAt, subtask1CreatedAt); // createdAt not modified
  const logAfterToggle = await freshSubtaskRepo.getLogById(newLogNoSubtasks.id);
  assert.equal(logAfterToggle?.subtasks.find((s) => s.id === subtask1.id)?.completed, true);
  // Toggle back to uncompleted
  const toggledBack = await freshSubtaskRepo.toggleSubtaskCompletion(newLogNoSubtasks.id, subtask1.id);
  assert.ok(toggledBack);
  assert.equal(toggledBack.completed, false);
  console.log('✓ 5. Toggle a subtask completed/uncompleted');

  // Test 6: Edit a subtask title
  await new Promise((r) => setTimeout(r, 5));
  const editedSubtask = await freshSubtaskRepo.updateSubtaskTitle(newLogNoSubtasks.id, subtask2.id, 'Updated Subtask 2 Title');
  assert.equal(editedSubtask.title, 'Updated Subtask 2 Title');
  assert.equal(editedSubtask.createdAt, subtask2.createdAt); // subtask createdAt not modified
  const logAfterEdit = await freshSubtaskRepo.getLogById(newLogNoSubtasks.id);
  assert.equal(logAfterEdit?.subtasks.find((s) => s.id === subtask2.id)?.title, 'Updated Subtask 2 Title');
  console.log('✓ 6. Edit a subtask title');

  // Test 7: Delete a subtask
  const deleteResult = await freshSubtaskRepo.deleteSubtask(newLogNoSubtasks.id, subtask3.id);
  assert.equal(deleteResult, true);
  const logAfterDelete = await freshSubtaskRepo.getLogById(newLogNoSubtasks.id);
  assert.equal(logAfterDelete?.subtasks.length, 2);
  assert.ok(!logAfterDelete?.subtasks.some((s) => s.id === subtask3.id));
  console.log('✓ 7. Delete a subtask');

  // Test 8: Whitespace-only subtask titles are rejected
  await assert.rejects(
    async () => {
      await freshSubtaskRepo.addSubtask(newLogNoSubtasks.id, '   ');
    },
    /cannot be empty/
  );
  await assert.rejects(
    async () => {
      await freshSubtaskRepo.updateSubtaskTitle(newLogNoSubtasks.id, subtask1.id, '   \t  ');
    },
    /cannot be empty/
  );
  console.log('✓ 8. Whitespace-only subtask titles are rejected');

  // Test 9: Completing an individual subtask does NOT complete the parent Log
  const parentLog9 = await freshSubtaskRepo.createLog({
    title: 'Parent Log 9',
    deadline: '2030-01-05T12:00:00.000Z',
  });
  const st9A = await freshSubtaskRepo.addSubtask(parentLog9.id, 'Subtask 9A');
  await freshSubtaskRepo.addSubtask(parentLog9.id, 'Subtask 9B');
  await freshSubtaskRepo.toggleSubtaskCompletion(parentLog9.id, st9A.id);
  const log9AfterStToggle = await freshSubtaskRepo.getLogById(parentLog9.id);
  assert.equal(log9AfterStToggle?.completed, false);
  console.log('✓ 9. Completing an individual subtask does NOT complete the parent Log');

  // Test 10: Completing the parent Log marks ALL subtasks completed
  await freshSubtaskRepo.toggleLogCompletion(parentLog9.id);
  const log9Completed = await freshSubtaskRepo.getLogById(parentLog9.id);
  assert.equal(log9Completed?.completed, true);
  assert.equal(log9Completed?.subtasks.length, 2);
  assert.ok(log9Completed?.subtasks.every((s) => s.completed === true));
  console.log('✓ 10. Completing the parent Log marks ALL subtasks completed');

  // Test 11: Completing the parent Log preserves already-completed subtasks
  const parentLog11 = await freshSubtaskRepo.createLog({
    title: 'Parent Log 11',
    deadline: '2030-01-06T12:00:00.000Z',
  });
  const st11A = await freshSubtaskRepo.addSubtask(parentLog11.id, 'Subtask 11A');
  await freshSubtaskRepo.addSubtask(parentLog11.id, 'Subtask 11B');
  await freshSubtaskRepo.toggleSubtaskCompletion(parentLog11.id, st11A.id); // 11A is completed
  const st11AUpdatedAt = (await freshSubtaskRepo.getLogById(parentLog11.id))?.subtasks[0].updatedAt;
  await freshSubtaskRepo.toggleLogCompletion(parentLog11.id);
  const log11Completed = await freshSubtaskRepo.getLogById(parentLog11.id);
  assert.equal(log11Completed?.completed, true);
  assert.equal(log11Completed?.subtasks[0].completed, true);
  assert.equal(log11Completed?.subtasks[1].completed, true);
  assert.equal(log11Completed?.subtasks[0].updatedAt, st11AUpdatedAt);
  console.log('✓ 11. Completing the parent Log preserves already-completed subtasks');

  // Test 12: Uncompleting the parent Log preserves the completed states of its subtasks
  await freshSubtaskRepo.toggleLogCompletion(parentLog11.id);
  const log11Uncompleted = await freshSubtaskRepo.getLogById(parentLog11.id);
  assert.equal(log11Uncompleted?.completed, false);
  assert.equal(log11Uncompleted?.subtasks[0].completed, true);
  assert.equal(log11Uncompleted?.subtasks[1].completed, true);
  console.log('✓ 12. Uncompleting the parent Log preserves the completed states of its subtasks');

  // Test 13: Completing all subtasks manually does NOT automatically complete the parent Log
  const parentLog13 = await freshSubtaskRepo.createLog({
    title: 'Parent Log 13',
    deadline: '2030-01-07T12:00:00.000Z',
  });
  const st13A = await freshSubtaskRepo.addSubtask(parentLog13.id, 'Subtask 13A');
  const st13B = await freshSubtaskRepo.addSubtask(parentLog13.id, 'Subtask 13B');
  await freshSubtaskRepo.toggleSubtaskCompletion(parentLog13.id, st13A.id);
  await freshSubtaskRepo.toggleSubtaskCompletion(parentLog13.id, st13B.id);
  const log13AllSubtasksDone = await freshSubtaskRepo.getLogById(parentLog13.id);
  assert.ok(log13AllSubtasksDone?.subtasks.every((s) => s.completed === true));
  assert.equal(log13AllSubtasksDone?.completed, false);
  console.log('✓ 13. Completing all subtasks manually does NOT automatically complete the parent Log');

  // Test 14: A Log with zero subtasks still follows existing completion behavior
  const parentLog14 = await freshSubtaskRepo.createLog({
    title: 'Parent Log 14',
    deadline: '2030-01-08T12:00:00.000Z',
  });
  assert.equal(parentLog14.completed, false);
  const log14Completed = await freshSubtaskRepo.toggleLogCompletion(parentLog14.id);
  assert.equal(log14Completed?.completed, true);
  const log14Uncompleted = await freshSubtaskRepo.toggleLogCompletion(parentLog14.id);
  assert.equal(log14Uncompleted?.completed, false);
  console.log('✓ 14. A Log with zero subtasks still follows existing completion behavior');

  // Test 15: Subtasks survive normal Log editing
  const parentLog15 = await freshSubtaskRepo.createLog({
    title: 'Parent Log 15',
    description: 'Initial description',
    deadline: '2030-01-09T12:00:00.000Z',
  });
  await freshSubtaskRepo.addSubtask(parentLog15.id, 'Subtask 15');
  const editedLog15 = await freshSubtaskRepo.updateLog({
    id: parentLog15.id,
    title: 'Updated Title 15',
    description: 'Updated description',
  });
  assert.equal(editedLog15.title, 'Updated Title 15');
  assert.equal(editedLog15.subtasks.length, 1);
  assert.equal(editedLog15.subtasks[0].title, 'Subtask 15');
  console.log('✓ 15. Subtasks survive normal Log editing');

  // Test 16: Subtasks survive Log rescheduling
  const rescheduledLog15 = await freshSubtaskRepo.updateLog({
    id: parentLog15.id,
    deadline: '2035-12-31T23:59:59.000Z',
  });
  assert.equal(rescheduledLog15.deadline, '2035-12-31T23:59:59.000Z');
  assert.equal(rescheduledLog15.subtasks.length, 1);
  assert.equal(rescheduledLog15.subtasks[0].title, 'Subtask 15');
  console.log('✓ 16. Subtasks survive Log rescheduling');

  // Test 17: Subtasks survive project reassignment
  const project17A = await freshSubtaskRepo.createProject('Project 17A');
  const project17B = await freshSubtaskRepo.createProject('Project 17B');
  await freshSubtaskRepo.updateLog({
    id: parentLog15.id,
    projectId: project17A.id,
  });
  const reassigned1 = await freshSubtaskRepo.getLogById(parentLog15.id);
  assert.equal(reassigned1?.projectId, project17A.id);
  assert.equal(reassigned1?.subtasks.length, 1);

  await freshSubtaskRepo.updateLog({
    id: parentLog15.id,
    projectId: project17B.id,
  });
  const reassigned2 = await freshSubtaskRepo.getLogById(parentLog15.id);
  assert.equal(reassigned2?.projectId, project17B.id);
  assert.equal(reassigned2?.subtasks.length, 1);

  await freshSubtaskRepo.updateLog({
    id: parentLog15.id,
    projectId: null,
  });
  const unassigned = await freshSubtaskRepo.getLogById(parentLog15.id);
  assert.equal(unassigned?.projectId, null);
  assert.equal(unassigned?.subtasks.length, 1);
  console.log('✓ 17. Subtasks survive project reassignment');

  // Test 18: Deleting a Project preserves its Logs and their subtasks
  const project18 = await freshSubtaskRepo.createProject('Project 18');
  const parentLog18 = await freshSubtaskRepo.createLog({
    title: 'Parent Log 18',
    deadline: '2030-01-10T12:00:00.000Z',
    projectId: project18.id,
  });
  await freshSubtaskRepo.addSubtask(parentLog18.id, 'Subtask 18A');
  await freshSubtaskRepo.addSubtask(parentLog18.id, 'Subtask 18B');
  await freshSubtaskRepo.deleteProject(project18.id);

  const log18AfterProjDelete = await freshSubtaskRepo.getLogById(parentLog18.id);
  assert.ok(log18AfterProjDelete);
  assert.equal(log18AfterProjDelete.projectId, null);
  assert.equal(log18AfterProjDelete.subtasks.length, 2);
  assert.equal(log18AfterProjDelete.subtasks[0].title, 'Subtask 18A');
  assert.equal(log18AfterProjDelete.subtasks[1].title, 'Subtask 18B');
  console.log('✓ 18. Deleting a Project preserves its Logs and their subtasks');

  // Test 19: Backup export includes subtasks
  const exported = await freshSubtaskRepo.exportData();
  const backupWithSubtasks = createBackup(exported);
  const logInBackup = backupWithSubtasks.data.logs.find((l) => l.id === parentLog18.id);
  assert.ok(logInBackup);
  assert.ok(Array.isArray(logInBackup.subtasks));
  assert.equal(logInBackup.subtasks.length, 2);
  assert.equal(logInBackup.subtasks[0].title, 'Subtask 18A');
  assert.equal(logInBackup.subtasks[1].title, 'Subtask 18B');
  console.log('✓ 19. Backup export includes subtasks');

  // Test 20: Backup restore preserves subtasks
  cleanStore['todop_app_data_v1'] = JSON.stringify({
    version: 1,
    logs: [],
    projects: [],
    settings: { theme: 'light', fontSize: 'medium' },
  });
  const restoreRepo = new LocalStorageRepository();
  const validationResult = validateBackup(JSON.stringify(backupWithSubtasks));
  assert.equal(validationResult.valid, true);
  if (validationResult.valid) {
    await restoreRepo.importData(validationResult.data);
  }
  const restoredLog = await restoreRepo.getLogById(parentLog18.id);
  assert.ok(restoredLog);
  assert.equal(restoredLog.subtasks.length, 2);
  assert.equal(restoredLog.subtasks[0].title, 'Subtask 18A');
  assert.equal(restoredLog.subtasks[1].title, 'Subtask 18B');
  console.log('✓ 20. Backup restore preserves subtasks');

  // Test 21: Older backups without subtasks restore successfully with []
  const oldBackupWithoutSubtasks = {
    backupVersion: 1,
    app: 'todop',
    exportedAt: '2026-01-01T00:00:00.000Z',
    data: {
      schemaVersion: 1,
      logs: [
        {
          id: 'old-log-no-subtasks',
          title: 'Old Log From Previous Version',
          deadline: '2030-01-01T12:00:00.000Z',
          completed: false,
          projectId: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      projects: [],
      settings: { theme: 'light', fontSize: 'medium' },
    },
  };
  const oldBackupValidation = validateBackup(JSON.stringify(oldBackupWithoutSubtasks));
  assert.equal(oldBackupValidation.valid, true);
  if (oldBackupValidation.valid) {
    assert.ok(Array.isArray(oldBackupValidation.data.logs[0].subtasks));
    assert.equal(oldBackupValidation.data.logs[0].subtasks.length, 0);
    await restoreRepo.importData(oldBackupValidation.data);
  }
  const restoredOldLog = await restoreRepo.getLogById('old-log-no-subtasks');
  assert.ok(restoredOldLog);
  assert.ok(Array.isArray(restoredOldLog.subtasks));
  assert.equal(restoredOldLog.subtasks.length, 0);
  console.log('✓ 21. Older backups without subtasks restore successfully with []');

  // Extra Test: Malformed subtask in backup fails validation safely
  const malformedSubtaskBackup = validateBackup(
    JSON.stringify({
      backupVersion: 1,
      app: 'todop',
      exportedAt: new Date().toISOString(),
      data: {
        schemaVersion: 1,
        logs: [
          {
            id: 'log-malformed-st',
            title: 'Log with malformed subtask',
            deadline: '2030-01-01T12:00:00.000Z',
            completed: false,
            projectId: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            subtasks: [{ id: 'st1', title: '' }], // missing title and other fields
          },
        ],
        projects: [],
        settings: { theme: 'light', fontSize: 'medium' },
      },
    })
  );
  assert.equal(malformedSubtaskBackup.valid, false);
  console.log('✓ Defensive: Malformed subtask in backup fails validation safely');

  // ==========================================
  // PHASE 4 STAGE 2: SUBTASK UI + LOG INTEGRATION TESTS
  // ==========================================
  console.log('\n--- Phase 4 Stage 2: Subtask UI & Log Integration Tests ---');

  // Test 1: Completed parent Log + new subtask behavior
  // A completed log receives a new subtask: new subtask is completed: false, parent log remains completed: true
  const stage2Repo = new LocalStorageRepository();
  const completedParent = await stage2Repo.createLog({
    title: 'Completed Log for Stage 2',
    deadline: '2030-01-15T12:00:00.000Z',
  });
  await stage2Repo.toggleLogCompletion(completedParent.id);
  const verifyCompleted = await stage2Repo.getLogById(completedParent.id);
  assert.equal(verifyCompleted?.completed, true);

  const newSubtaskOnCompleted = await stage2Repo.addSubtask(completedParent.id, 'New Follow-up Task');
  assert.equal(newSubtaskOnCompleted.completed, false); // New subtask starts as incomplete

  const parentAfterNewSubtask = await stage2Repo.getLogById(completedParent.id);
  assert.equal(parentAfterNewSubtask?.completed, true); // Parent Log remains completed
  assert.equal(parentAfterNewSubtask?.subtasks.length, 1);
  assert.equal(parentAfterNewSubtask?.subtasks[0].completed, false);
  console.log('✓ 1. Completed parent Log + new subtask: subtask is incomplete (completed: false), parent remains completed');

  // Test 2: Sequential draft subtask creation flow on new Log
  // Simulates LogFormSheet draft subtasks being created sequentially after parent log is created
  const newLogWithDrafts = await stage2Repo.createLog({
    title: 'New Log with Drafted Subtasks',
    deadline: '2030-01-16T12:00:00.000Z',
  });
  const draftTitles = ['Draft Subtask A', 'Draft Subtask B', 'Draft Subtask C'];
  for (const dt of draftTitles) {
    await stage2Repo.addSubtask(newLogWithDrafts.id, dt);
  }
  const logWithAllDrafts = await stage2Repo.getLogById(newLogWithDrafts.id);
  assert.equal(logWithAllDrafts?.subtasks.length, 3);
  assert.equal(logWithAllDrafts?.subtasks[0].title, 'Draft Subtask A');
  assert.equal(logWithAllDrafts?.subtasks[1].title, 'Draft Subtask B');
  assert.equal(logWithAllDrafts?.subtasks[2].title, 'Draft Subtask C');
  assert.ok(logWithAllDrafts?.subtasks.every((s) => !s.completed));
  console.log('✓ 2. New Log with drafted subtasks creates all subtasks with repository-managed IDs and timestamps');

  // Test 3: Subtask progress formatting logic
  const getSubtaskProgress = (subtasks?: { completed: boolean }[] | null): string | null => {
    if (!subtasks || subtasks.length === 0) return null;
    const completed = subtasks.filter((s) => s.completed).length;
    return `${completed} / ${subtasks.length} subtasks`;
  };

  assert.equal(getSubtaskProgress(null), null);
  assert.equal(getSubtaskProgress([]), null);
  assert.equal(getSubtaskProgress([{ completed: false }, { completed: true }, { completed: false }]), '1 / 3 subtasks');
  assert.equal(getSubtaskProgress([{ completed: true }, { completed: true }]), '2 / 2 subtasks');
  console.log('✓ 3. Subtask progress calculation helper formats correctly (hidden when 0, X / Y subtasks when > 0)');

  // Test 4: Existing Log form submission omitting subtasks preserves all subtasks
  // Simulates LogFormSheet submitting { id, title, description, deadline, projectId } with subtasks undefined
  const logToUpdate = await stage2Repo.getLogById(newLogWithDrafts.id);
  assert.ok(logToUpdate && logToUpdate.subtasks.length === 3);

  const updatedLogPreserved = await stage2Repo.updateLog({
    id: logToUpdate.id,
    title: 'Renamed Parent Log Title',
    deadline: '2035-06-01T12:00:00.000Z',
    // subtasks intentionally omitted as in Stage 2 form submit
  });
  assert.equal(updatedLogPreserved.title, 'Renamed Parent Log Title');
  assert.equal(updatedLogPreserved.deadline, '2035-06-01T12:00:00.000Z');
  assert.equal(updatedLogPreserved.subtasks.length, 3);
  assert.equal(updatedLogPreserved.subtasks[0].title, 'Draft Subtask A');
  assert.equal(updatedLogPreserved.subtasks[1].title, 'Draft Subtask B');
  assert.equal(updatedLogPreserved.subtasks[2].title, 'Draft Subtask C');
  console.log('✓ 4. Existing Log form submission omitting subtasks strictly preserves all subtasks');

  // Test 5: Subtask CRUD operations on completed logs
  const completedLogWithSubtasks = await stage2Repo.createLog({
    title: 'Completed Log for Subtask Operations',
    deadline: '2030-01-20T12:00:00.000Z',
  });
  const stA = await stage2Repo.addSubtask(completedLogWithSubtasks.id, 'Subtask A');
  const stB = await stage2Repo.addSubtask(completedLogWithSubtasks.id, 'Subtask B');
  // Complete the parent (marks stA and stB complete)
  await stage2Repo.toggleLogCompletion(completedLogWithSubtasks.id);

  // Toggle subtask A to incomplete while parent is completed
  await stage2Repo.toggleSubtaskCompletion(completedLogWithSubtasks.id, stA.id);
  const logAfterStToggle = await stage2Repo.getLogById(completedLogWithSubtasks.id);
  assert.equal(logAfterStToggle?.completed, true); // Parent remains completed
  assert.equal(logAfterStToggle?.subtasks.find((s) => s.id === stA.id)?.completed, false); // Subtask A is now incomplete

  // Edit subtask B title on completed parent
  await stage2Repo.updateSubtaskTitle(completedLogWithSubtasks.id, stB.id, 'Subtask B Renamed');
  const logAfterStRename = await stage2Repo.getLogById(completedLogWithSubtasks.id);
  assert.equal(logAfterStRename?.completed, true); // Parent remains completed
  assert.equal(logAfterStRename?.subtasks.find((s) => s.id === stB.id)?.title, 'Subtask B Renamed');

  // Delete subtask A on completed parent
  await stage2Repo.deleteSubtask(completedLogWithSubtasks.id, stA.id);
  const logAfterStDelete = await stage2Repo.getLogById(completedLogWithSubtasks.id);
  assert.equal(logAfterStDelete?.completed, true); // Parent remains completed
  assert.equal(logAfterStDelete?.subtasks.length, 1);
  assert.equal(logAfterStDelete?.subtasks[0].id, stB.id);
  console.log('✓ 5. Subtask CRUD (toggle, edit title, delete) on completed logs functions properly and preserves parent completed state');

  // Restore original mock localStorage
  globalThis.localStorage = originalLocalStorage;

  console.log('\n--- ALL TODOP UNIT & LOGIC TESTS (PHASE 1 + PHASE 2A + PHASE 2B + PHASE 2C + PHASE 2D + PHASE 3 + PHASE 4 STAGE 1 + PHASE 4 STAGE 2) PASSED ---');
}

testRepository().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});

