import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowUpRight, CalendarDays, Check, ChevronRight, Flag, FolderOpen, UsersRound } from 'lucide-react';
import type { Log, Project } from '../../types';
import { groupLogsByLocalDate, todayLocalKey } from '../../utils/calendar';
import { createDemoData } from '../../utils/demo';
import { buildRoadmap } from '../../utils/roadmap';
import { teamSignInPath } from '../../utils/teamRoutes';
import './PlannerPreview.css';

const tabs = ['Upcoming', 'Projects', 'Calendar', 'Roadmap', 'Workspaces'] as const;
type Tab = typeof tabs[number];

const workspaceMembers = [
  { name: 'Alex', role: 'Owner', initial: 'A' },
  { name: 'Jamie Chen', role: 'Collaborator', initial: 'J' },
];
const weekday = new Intl.DateTimeFormat('en', { weekday: 'short' });
const shortDate = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });
const time = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' });

function PreviewLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="lp-preview-link" href={href}>
      {children}<ArrowUpRight size={16} aria-hidden="true" />
    </a>
  );
}

function StateLabel({ active, on, off }: { active: boolean; on: string; off: string }) {
  return (
    <span className="lp-preview-stack lp-preview-state">
      <span aria-hidden={!active}>{on}</span>
      <span aria-hidden={active}>{off}</span>
    </span>
  );
}

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  return (
    <span className="lp-preview-progress" aria-hidden="true">
      <span style={{ width: `${total ? completed / total * 100 : 0}%` }} />
    </span>
  );
}

function UpcomingPreview({ tasks, projects, toggle }: { tasks: Log[]; projects: Project[]; toggle: (id: string) => void }) {
  const completed = tasks.filter(task => task.completed).length;
  return (
    <>
      <ul className="lp-preview-list">
        {tasks.map(task => (
          <li key={task.id}>
            <button type="button" className="lp-preview-row lp-preview-task" aria-pressed={task.completed} onClick={() => toggle(task.id)}>
              <span className="lp-preview-checkbox" aria-hidden="true">{task.completed && <Check size={13} strokeWidth={3} />}</span>
              <span className="lp-preview-detail">
                <strong>{task.title}</strong>
                <small>{projects.find(project => project.id === task.projectId)?.name}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="lp-preview-foot lp-preview-task-progress">
        <span role="status">{completed} of {tasks.length} done</span>
        <ProgressBar completed={completed} total={tasks.length} />
      </div>
    </>
  );
}

function ProjectsPreview({ projects, tasks }: { projects: Project[]; tasks: Log[] }) {
  return (
    <>
      <ul className="lp-preview-list lp-preview-projects">
        {projects.map(project => {
          const projectTasks = tasks.filter(task => task.projectId === project.id);
          const completed = projectTasks.filter(task => task.completed).length;
          return (
            <li key={project.id}>
              <a className="lp-preview-row" href={`/projects/${project.id}?demo=1`}>
                <span className="lp-preview-icon"><FolderOpen size={17} aria-hidden="true" /></span>
                <strong className="lp-preview-detail">{project.name}</strong>
                <span className="lp-preview-project-progress">
                  <small>{completed} of {projectTasks.length} done</small>
                  <ProgressBar completed={completed} total={projectTasks.length} />
                </span>
                <ChevronRight className="lp-preview-chevron" size={15} aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ul>
      <div className="lp-preview-foot"><PreviewLink href="/projects?demo=1">Open Projects</PreviewLink></div>
    </>
  );
}

function CalendarPreview({ tasks, projects, today }: { tasks: Log[]; projects: Project[]; today: string }) {
  const [selected, setSelected] = useState(today);
  const deadlines = Array.from(groupLogsByLocalDate(tasks)).sort(([first], [second]) => first.localeCompare(second));

  return (
    <>
      <div className="lp-preview-calendar">
        <div className="lp-preview-dates" role="group" aria-label="Dates with deadlines">
          {deadlines.map(([key, due]) => {
            const date = new Date(due[0].deadline!);
            return (
              <button type="button" key={key} aria-pressed={selected === key} onClick={() => setSelected(key)}>
                <small>{key === today ? 'Today' : weekday.format(date)}</small>
                <time dateTime={key}>{shortDate.format(date)}</time>
              </button>
            );
          })}
        </div>
        <div className="lp-preview-stack lp-preview-agendas" aria-live="polite">
          {deadlines.map(([key, due]) => (
            <ul key={key} className="lp-preview-agenda" aria-hidden={selected !== key}>
              {[...due].sort((first, second) => first.deadline!.localeCompare(second.deadline!)).map(task => (
                <li key={task.id}>
                  <span className="lp-preview-detail">
                    <strong>{task.title}</strong>
                    <small>{projects.find(project => project.id === task.projectId)?.name}</small>
                  </span>
                  <time dateTime={task.deadline}>
                    {task.completed ? 'Done' : time.format(Date.parse(task.deadline!))}
                  </time>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
      <div className="lp-preview-foot"><PreviewLink href="/calendar?demo=1">Open Calendar</PreviewLink></div>
    </>
  );
}

function RoadmapPreview({ tasks, project, now, toggle }: {
  tasks: Log[]; project: Project; now: number; toggle: (id: string) => void;
}) {
  const entries = buildRoadmap(tasks.filter(task => task.projectId === project.id), now);
  return (
    <>
      <ol className="lp-preview-list lp-preview-roadmap" aria-label={`${project.name} roadmap`}>
        {entries.map(({ task, blocked, prerequisites }) => (
          <li className="lp-preview-row" key={task.id}>
            <span className="lp-preview-icon">
              {task.milestone ? <Flag size={17} aria-hidden="true" /> : <CalendarDays size={17} aria-hidden="true" />}
            </span>
            <span className="lp-preview-detail">
              {task.deadline && <time dateTime={task.deadline}>{shortDate.format(Date.parse(task.deadline))}</time>}
              <strong>{task.title}</strong>
              {prerequisites.length > 0 && <small>Depends on {prerequisites.map(item => item.title).join(', ')}.</small>}
            </span>
            {task.milestone ? (
              <span className="lp-preview-status" data-blocked={blocked} role="status">
                <StateLabel active={blocked} on="Blocked" off="Ready" />
              </span>
            ) : (
              <button type="button" className="lp-preview-action" aria-pressed={task.completed} onClick={() => toggle(task.id)}>
                <StateLabel active={task.completed} on="Completed" off="Mark complete" />
              </button>
            )}
          </li>
        ))}
      </ol>
      <div className="lp-preview-foot"><PreviewLink href={`/projects/${project.id}?demo=1`}>Open the sample project</PreviewLink></div>
    </>
  );
}

function WorkspacePreview({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <div className="lp-preview-workspace">
        <div className="lp-preview-row lp-preview-workspace-title">
          <span className="lp-preview-icon"><UsersRound size={18} aria-hidden="true" /></span>
          <span className="lp-preview-detail"><strong>Studio North</strong><small>Shared workspace</small></span>
        </div>
        <ul className="lp-preview-list" aria-label="Workspace members">
          {workspaceMembers.map(({ name, role, initial }) => (
            <li className="lp-preview-row" key={name}>
              <span className="lp-preview-icon lp-preview-initial" aria-hidden="true">{initial}</span>
              <strong className="lp-preview-detail">{name}</strong><small>{role}</small>
            </li>
          ))}
        </ul>
      </div>
      <div className="lp-preview-foot">
        <PreviewLink href={signedIn ? '/workspaces' : teamSignInPath('/workspaces')}>
          <StateLabel active={signedIn} on="Open shared workspaces" off="Sign in to shared workspaces" />
        </PreviewLink>
      </div>
    </>
  );
}

export function PlannerPreview({ signedIn }: { signedIn: boolean }) {
  const [tab, setTab] = useState<Tab>('Upcoming');
  const [{ projects, logs, today, now }] = useState(() => ({ ...createDemoData(), today: todayLocalKey(), now: Date.now() }));
  const [completed, setCompleted] = useState(() => new Set(logs.filter(task => task.completed).map(task => task.id)));
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const tasks = logs.map(task => ({ ...task, completed: completed.has(task.id) }));
  const studio = projects.find(project => project.id === 'studio')!;

  function toggle(id: string) {
    setCompleted(previous => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case 'ArrowRight': next = (index + 1) % tabs.length; break;
      case 'ArrowLeft': next = (index + tabs.length - 1) % tabs.length; break;
      case 'Home': next = 0; break;
      case 'End': next = tabs.length - 1; break;
      default: return;
    }
    event.preventDefault();
    setTab(tabs[next]);
    buttons.current[next]?.focus({ preventScroll: true });
  }

  const panels: Record<Tab, ReactNode> = {
    Upcoming: <UpcomingPreview tasks={tasks.slice(0, 3)} projects={projects} toggle={toggle} />,
    Projects: <ProjectsPreview projects={projects} tasks={tasks} />,
    Calendar: <CalendarPreview tasks={tasks} projects={projects} today={today} />,
    Roadmap: <RoadmapPreview tasks={tasks} project={studio} now={now} toggle={toggle} />,
    Workspaces: <WorkspacePreview signedIn={signedIn} />,
  };

  return (
    <div className="lp-demo-scene" id="demo">
      <div className="lp-orbit lp-orbit-one" aria-hidden="true" />
      <div className="lp-orbit lp-orbit-two" aria-hidden="true" />
      <div className="lp-planner">
        <div className="lp-preview-heading">
          <Check size={18} aria-hidden="true" />
          <h2>Sample planner</h2>
        </div>
        <div className="lp-demo-tabs" role="tablist" aria-label="Explore the planner preview">
          {tabs.map((name, index) => (
            <button type="button" id={`demo-tab-${name}`} aria-controls={`demo-panel-${name}`} role="tab"
              aria-selected={tab === name} tabIndex={tab === name ? 0 : -1} key={name}
              ref={node => { buttons.current[index] = node; }} onKeyDown={event => moveTab(event, index)} onClick={() => setTab(name)}>
              {name}
            </button>
          ))}
        </div>
        <div className="lp-preview-stack lp-preview-stage">
          {tabs.map(name => (
            <div id={`demo-panel-${name}`} className="lp-preview-panel" role="tabpanel" aria-labelledby={`demo-tab-${name}`}
              aria-hidden={tab !== name} inert={tab !== name} key={name}>
              {panels[name]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
