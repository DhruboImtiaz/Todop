import { useMemo } from "react";
import { Plus } from "lucide-react";
import type { Log } from "../../types";
import { getLogSection } from "../../utils/time";
import { LogCard } from "./LogCard";
import { EmptyState } from "./EmptyState";
import "./UpcomingPage.css";
interface UpcomingPageProps {
  logs: Log[];
  currentTimestamp: number;
  onCompleteLog: (id: string) => void;
  onEditLog: (log: Log) => void;
  onDeleteLog: (id: string) => void;
  onOpenCreateSheet: () => void;
}
export function UpcomingPage({
  logs,
  currentTimestamp,
  onCompleteLog,
  onEditLog,
  onDeleteLog,
  onOpenCreateSheet,
}: UpcomingPageProps) {
  const sections = useMemo(() => {
    const groups = {
      overdue: [] as Log[],
      today: [] as Log[],
      upcoming: [] as Log[],
      anytime: [] as Log[],
    };
    [...logs]
      .sort(
        (a, b) =>
          (a.deadline ? Date.parse(a.deadline) : Infinity) -
          (b.deadline ? Date.parse(b.deadline) : Infinity),
      )
      .forEach((log) =>
        groups[
          log.deadline
            ? getLogSection(log.deadline, currentTimestamp)
            : "anytime"
        ].push(log),
      );
    return [
      {
        key: "overdue",
        title: "Overdue",
        label: "Overdue tasks",
        logs: groups.overdue,
      },
      {
        key: "today",
        title: "Today",
        label: "Tasks due today",
        logs: groups.today,
      },
      {
        key: "upcoming",
        title: "Upcoming",
        label: "Upcoming future tasks",
        logs: groups.upcoming,
      },
      {
        key: "anytime",
        title: "Anytime",
        label: "Tasks without a deadline",
        logs: groups.anytime,
      },
    ];
  }, [logs, currentTimestamp]);
  return (
    <section className="upcoming-page" aria-labelledby="upcoming-page-heading">
      <div className="page-header">
        <div className="page-header-main">
          <h1 id="upcoming-page-heading" className="page-title">
            Upcoming
          </h1>
          <p className="page-subtitle">
            Your tasks, with a little perspective.
          </p>
        </div>
        <button className="workspace-secondary" onClick={onOpenCreateSheet}>
          <Plus size={16} />
          New task
        </button>
      </div>
      {logs.length === 0 ? (
        <EmptyState onCreateLog={onOpenCreateSheet} />
      ) : (
        <div className="upcoming-sections">
          {sections
            .filter((section) => section.logs.length)
            .map((section) => (
              <div
                className={`log-section ${section.key === "overdue" ? "overdue-section" : ""}`}
                aria-label={section.label}
                key={section.key}
              >
                <div className="log-section-header">
                  <span className="log-section-title">{section.title}</span>
                  <span className="log-section-count">
                    {section.logs.length}
                  </span>
                </div>
                <div className="log-section-cards">
                  {section.logs.map((log) => (
                    <LogCard
                      key={log.id}
                      log={log}
                      currentTimestamp={currentTimestamp}
                      onComplete={onCompleteLog}
                      onEdit={onEditLog}
                      onDelete={onDeleteLog}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
