import { useMemo, useState, type FormEvent } from 'react';
import { Flag, Link2 } from 'lucide-react';
import type { Log } from '../../types';
import { useStorage } from '../../hooks/useStorage';
import { buildRoadmap } from '../../utils/roadmap';
import './ProjectRoadmap.css';

function RoadmapEditor({ task, tasks, onClose }: { task: Log; tasks: Log[]; onClose: () => void }) {
  const { repository } = useStorage();
  const [original] = useState(() => ({ milestone: !!task.milestone, dependsOn: task.dependsOn ?? [] }));
  const [milestone, setMilestone] = useState(original.milestone);
  const [prerequisites, setPrerequisites] = useState(original.dependsOn);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await repository.updateRoadmapTask(task.id, { milestone, dependsOn: prerequisites }, original);
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save the roadmap.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="roadmap-editor" onSubmit={submit} aria-label={`Roadmap settings for ${task.title}`}>
      <label className="roadmap-field">
        <input type="checkbox" checked={milestone} disabled={saving || !task.deadline}
          onChange={event => setMilestone(event.target.checked)} />
        Mark as milestone
      </label>
      {!task.deadline && <p>Add a deadline to make this task a milestone.</p>}
      <fieldset disabled={saving}>
        <legend>Prerequisites</legend>
        {tasks.length === 0 && <p>Add another task to link a prerequisite.</p>}
        {tasks.map(candidate => (
          <label className="roadmap-field" key={candidate.id}>
            <input type="checkbox" checked={prerequisites.includes(candidate.id)}
              onChange={event => {
                const checked = event.currentTarget.checked;
                setPrerequisites(previous => checked ? [...previous, candidate.id] : previous.filter(id => id !== candidate.id));
              }} />
            {candidate.title}
          </label>
        ))}
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <div className="roadmap-actions">
        <button className="workspace-primary" disabled={saving}>Save roadmap</button>
        <button type="button" className="workspace-secondary" disabled={saving} onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

export function ProjectRoadmap({ tasks, now, onEdit }: { tasks: Log[]; now: number; onEdit: (task: Log) => void }) {
  const entries = useMemo(() => buildRoadmap(tasks, now), [tasks, now]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const milestones = entries.filter(({ task }) => task.milestone);
  if (!entries.length) return <p className="roadmap-empty">Add tasks to start building this roadmap.</p>;

  return (
    <section className="project-roadmap" aria-label="Project roadmap">
      <dl className="roadmap-summary">
        <div><dt>Milestones reached</dt><dd>{milestones.filter(({ task }) => task.completed).length}/{milestones.length}</dd></div>
        <div><dt>Blocked tasks</dt><dd>{entries.filter(entry => entry.blocked).length}</dd></div>
        <div><dt>At risk</dt><dd>{entries.filter(entry => entry.atRisk).length}</dd></div>
      </dl>
      <ol className="roadmap-timeline">
        {entries.map(({ task, prerequisites, blocked, atRisk, reason }) => (
          <li className="roadmap-item" key={task.id}>
            <div className="roadmap-task">
              <div className="roadmap-task-info">
                {task.deadline ? <time dateTime={task.deadline}>{new Date(task.deadline).toLocaleDateString(undefined,
                  { month: 'short', day: 'numeric', year: 'numeric' })}</time> : <span>Unscheduled</span>}
                <button type="button" className="roadmap-task-title" onClick={() => onEdit(task)}>{task.title}</button>
                <div className="roadmap-labels">
                  {task.milestone && <span><Flag size={14} aria-hidden="true" /> Milestone</span>}
                  {task.completed && <span>Completed</span>}
                  {blocked && <span>Blocked</span>}
                  {atRisk && <span className="roadmap-risk">At risk · {reason}</span>}
                </div>
                {prerequisites.length > 0 && <p>Depends on {prerequisites.map(log => log.title).join(', ')}</p>}
              </div>
              <button type="button" className="workspace-secondary" aria-label={`Edit roadmap for ${task.title}`}
                aria-expanded={editingId === task.id} onClick={() => setEditingId(editingId === task.id ? null : task.id)}>
                <Link2 size={16} aria-hidden="true" /> <span>Roadmap settings</span>
              </button>
            </div>
            {editingId === task.id && <RoadmapEditor task={task} tasks={tasks.filter(candidate => candidate.id !== task.id)}
              onClose={() => setEditingId(null)} />}
          </li>
        ))}
      </ol>
    </section>
  );
}
