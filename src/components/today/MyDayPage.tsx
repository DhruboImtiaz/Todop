import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  CircleCheck,
  FolderOpen,
  Plus,
  Search,
  Sparkles,
  Sunrise,
  Target,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { Log } from "../../types";
import { useStorage } from "../../hooks/useStorage";
import { getLocalDateKey } from "../../utils/calendar";
import { sortByPriority, recurrenceLabel } from "../../utils/planning";
import { runUiAction } from "../../utils/asyncAction";
import { navigate } from "../../utils/navigation";
import { LogCard } from "../logs/LogCard";

export function MyDayPage({
  timestamp,
  onEdit,
  onCreate,
}: {
  timestamp: number;
  onEdit: (log: Log) => void;
  onCreate: () => void;
}) {
  const {
    activeLogs,
    completedLogs,
    projects,
    planMyDay,
    toggleLogCompletion,
    deleteLog,
  } = useStorage();
  const [query, setQuery] = useState("");
  const today = getLocalDateKey(new Date(timestamp));
  const chosen = sortByPriority(
    [...activeLogs, ...completedLogs].filter((log) => log.myDay === today),
  );
  const activeChosen = chosen.filter((log) => !log.completed);
  const done = chosen.filter((log) => log.completed).length;
  const candidates = sortByPriority(
    activeLogs.filter(
      (log) =>
        log.myDay !== today &&
        `${log.title} ${log.description ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ),
  );
  const dueToday = activeLogs.filter(
    (log) => log.deadline && getLocalDateKey(log.deadline) === today,
  ).length;
  const percent = chosen.length ? Math.round((done / chosen.length) * 100) : 0;
  return (
    <section className="my-day-page">
      <div className="day-heading">
        <div>
          <p className="workspace-eyebrow">
            <Sunrise size={15} />
            {new Date(timestamp).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1>
            Make room for <em>today.</em>
          </h1>
          <p>
            A little intention. A few small steps. A day that feels like yours.
          </p>
        </div>
        <button className="workspace-primary" onClick={onCreate}>
          <Plus size={17} />
          New task
        </button>
      </div>
      <div className="planner-stats">
        <div>
          <span className="stat-icon purple">
            <Target size={19} />
          </span>
          <span>
            <small>In your focus</small>
            <strong>
              {activeChosen.length}
              <em> / 3 tasks</em>
            </strong>
          </span>
        </div>
        <div>
          <span className="stat-icon green">
            <CircleCheck size={19} />
          </span>
          <span>
            <small>Small wins today</small>
            <strong>
              {done}
              <em> completed</em>
            </strong>
          </span>
        </div>
        <div>
          <span className="stat-icon sand">
            <Sunrise size={19} />
          </span>
          <span>
            <small>Due today</small>
            <strong>
              {dueToday}
              <em> on your calendar</em>
            </strong>
          </span>
        </div>
      </div>
      <div className="day-grid">
        <section
          className="workspace-panel focus-panel"
          aria-labelledby="focus-heading"
        >
          <div className="panel-heading">
            <div>
              <p className="workspace-eyebrow">ONE THING AT A TIME</p>
              <h2 id="focus-heading">Your focus</h2>
            </div>
            <span className="panel-count">{activeChosen.length} of 3</span>
          </div>
          <p className="panel-description">
            Choose what matters today. Deadlines can have their own plan.
          </p>
          <div className="focus-list">
            {chosen.length === 0 ? (
              <div className="focus-empty">
                <span>
                  <Sparkles size={29} />
                </span>
                <h3>A little space to begin.</h3>
                <p>
                  Pick up to three tasks from your list.
                  <br />
                  You don’t need to do everything today.
                </p>
                <button onClick={onCreate}>
                  <Plus size={15} />
                  Start with a new task
                </button>
              </div>
            ) : (
              chosen.map((log) => (
                <div className="focus-task" key={log.id}>
                  <LogCard
                    log={log}
                    currentTimestamp={timestamp}
                    onComplete={async (id) => {
                      await toggleLogCompletion(id);
                    }}
                    onEdit={onEdit}
                    onDelete={async (id) => {
                      await deleteLog(id);
                    }}
                  />
                </div>
              ))
            )}
          </div>
          <div className="day-progress">
            <div
              className="day-progress-ring"
              style={{ "--progress": `${percent}%` } as CSSProperties}
            >
              <span>{percent}%</span>
            </div>
            <div>
              <strong>
                {done > 0
                  ? "Look at you, making progress."
                  : "Small steps count."}
              </strong>
              <p>
                {done > 0
                  ? `${done} ${done === 1 ? "thing" : "things"} off your mind today.`
                  : "Make a little room for a good day."}
              </p>
            </div>
            <span className="day-progress-spark" aria-hidden="true">
              ✳
            </span>
          </div>
        </section>
        <aside
          className="workspace-panel choose-panel"
          aria-labelledby="choose-heading"
        >
          <div className="panel-heading">
            <div>
              <p className="workspace-eyebrow">A PLACE TO START</p>
              <h2 id="choose-heading">Choose your three</h2>
            </div>
            <span className="panel-count">{candidates.length}</span>
          </div>
          <label className="candidate-search">
            <Search size={15} />
            <input
              aria-label="Find a task for My Day"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find something to focus on…"
            />
          </label>
          <div className="candidate-list">
            {candidates.slice(0, 8).map((log) => (
              <div className="candidate-row" key={log.id}>
                <div>
                  <strong>{log.title}</strong>
                  <small>
                    <span
                      className={`priority-dot ${log.priority ?? "normal"}`}
                    />
                    {projects.find((p) => p.id === log.projectId)?.name ??
                      "Personal"}
                    {log.recurrence
                      ? ` · ${recurrenceLabel(log.recurrence)}`
                      : ""}
                  </small>
                </div>
                <button
                  aria-label={`Add ${log.title} to My Day`}
                  disabled={activeChosen.length >= 3}
                  onClick={() => runUiAction(() => planMyDay(log.id, today))}
                >
                  <Plus size={16} />
                </button>
              </div>
            ))}
            {!candidates.length && (
              <p className="candidate-empty">
                {query
                  ? "No matching tasks. Try another word."
                  : "A clear list. Add a task when you’re ready."}
              </p>
            )}
          </div>
          <button
            className="panel-footer-link"
            onClick={() => navigate("/app")}
          >
            See all your tasks <ArrowUpRight size={16} />
          </button>
        </aside>
      </div>
      <div className="day-bottom">
        <div className="day-tip">
          <span>
            <Check size={19} />
          </span>
          <div>
            <strong>A plan is a direction, not a demand.</strong>
            <p>
              Finished early? Add another task. Plans changed? Make a little
              room.
            </p>
          </div>
        </div>
        <button onClick={() => navigate("/projects")}>
          <FolderOpen size={17} />
          Your projects
          <ArrowUpRight size={15} />
        </button>
      </div>
    </section>
  );
}
