import type { Log } from '../types';

export function validateRoadmap(logs: Log[]): string | undefined {
  const tasks = new Map(logs.map(log => [log.id, log]));
  const dependents = new Map<string, string[]>();
  const remaining = new Map<string, number>();

  for (const task of logs) {
    const prerequisites = task.dependsOn ?? [];
    if (task.milestone && (!task.projectId || !task.deadline))
      return 'A milestone needs a project and a deadline.';
    if (new Set(prerequisites).size !== prerequisites.length)
      return 'A prerequisite can be selected only once.';
    for (const id of prerequisites) {
      if (id === task.id || !task.projectId || tasks.get(id)?.projectId !== task.projectId)
        return 'Choose other tasks from the same project as prerequisites.';
      const next = dependents.get(id) ?? [];
      next.push(task.id);
      dependents.set(id, next);
    }
    remaining.set(task.id, prerequisites.length);
  }

  const ready = logs.filter(task => !remaining.get(task.id)).map(task => task.id);
  for (let index = 0; index < ready.length; index++) {
    for (const id of dependents.get(ready[index]) ?? []) {
      const count = remaining.get(id)! - 1;
      remaining.set(id, count);
      if (count === 0) ready.push(id);
    }
  }
  return ready.length === logs.length ? undefined : 'These prerequisites would create a circular dependency.';
}

export function buildRoadmap(logs: Log[], now: number) {
  const tasks = new Map(logs.map(log => [log.id, log]));
  const deadline = (task: Log) => task.deadline ? Date.parse(task.deadline) : Infinity;
  return [...logs]
    .sort((a, b) => deadline(a) - deadline(b) || a.title.localeCompare(b.title))
    .map(task => {
      const prerequisites = (task.dependsOn ?? []).flatMap(id => tasks.get(id) ?? []);
      const unfinished = prerequisites.filter(log => !log.completed);
      const seen = new Set<string>();
      const queue = [...unfinished];
      const taskDeadline = deadline(task);
      let lateDependency = false;
      while (queue.length) {
        const dependency = queue.pop()!;
        if (seen.has(dependency.id)) continue;
        seen.add(dependency.id);
        if (dependency.deadline && deadline(dependency) > taskDeadline) lateDependency = true;
        for (const id of dependency.dependsOn ?? []) {
          const next = tasks.get(id);
          if (next && !next.completed) queue.push(next);
        }
      }

      const overdue = taskDeadline <= now;
      return {
        task, prerequisites,
        blocked: !task.completed && unfinished.length > 0,
        atRisk: !task.completed && (overdue || lateDependency),
        reason: overdue ? 'Deadline passed' : 'A prerequisite is due later',
      };
    });
}
