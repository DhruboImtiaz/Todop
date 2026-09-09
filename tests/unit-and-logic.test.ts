import assert from 'node:assert/strict';
import { getCountdown, getLogSection, localDateTimeToIso, isoToLocalDateAndTime } from '../src/utils/time';
import { LocalStorageRepository } from '../src/services/storage/localStorageRepository';

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

  console.log('\n--- ALL TODOP UNIT & LOGIC TESTS (PHASE 1 + PHASE 2A + PHASE 2B) PASSED ---');
}

testRepository().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});
