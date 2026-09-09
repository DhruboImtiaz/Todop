import React, { useMemo } from 'react';
import type { Log } from '../../types';
import { getLogSection } from '../../utils/time';
import { LogCard } from './LogCard';
import { EmptyState } from './EmptyState';
import './UpcomingPage.css';

interface UpcomingPageProps {
  logs: Log[];
  currentTimestamp: number;
  onCompleteLog: (id: string) => void;
  onEditLog: (log: Log) => void;
  onDeleteLog: (id: string) => void;
  onOpenCreateSheet: () => void;
}

export const UpcomingPage: React.FC<UpcomingPageProps> = ({
  logs,
  currentTimestamp,
  onCompleteLog,
  onEditLog,
  onDeleteLog,
  onOpenCreateSheet,
}) => {
  // Sort logs primarily by deadline ascending (overdue first, then nearest upcoming deadlines)
  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => {
      const timeA = new Date(a.deadline).getTime();
      const timeB = new Date(b.deadline).getTime();
      return timeA - timeB;
    });
  }, [logs]);

  // Group into sections
  const { overdueLogs, todayLogs, upcomingLogs } = useMemo(() => {
    const overdue: Log[] = [];
    const today: Log[] = [];
    const upcoming: Log[] = [];

    for (const log of sortedLogs) {
      const section = getLogSection(log.deadline, currentTimestamp);
      if (section === 'overdue') {
        overdue.push(log);
      } else if (section === 'today') {
        today.push(log);
      } else {
        upcoming.push(log);
      }
    }

    return {
      overdueLogs: overdue,
      todayLogs: today,
      upcomingLogs: upcoming,
    };
  }, [sortedLogs, currentTimestamp]);

  const hasLogs = logs.length > 0;

  return (
    <section className="upcoming-page" aria-labelledby="upcoming-page-heading">
      <div className="upcoming-header">
        <h1 id="upcoming-page-heading" className="upcoming-title">
          UPCOMING
        </h1>
        <p className="upcoming-subtitle">Your tasks, at a glance</p>
      </div>

      {!hasLogs ? (
        <EmptyState onCreateLog={onOpenCreateSheet} />
      ) : (
        <div className="upcoming-sections">
          {/* Overdue Section */}
          {overdueLogs.length > 0 && (
            <div className="log-section overdue-section" aria-label="Overdue tasks">
              <div className="log-section-header">
                <span className="log-section-title">OVERDUE</span>
                <span className="log-section-count">{overdueLogs.length}</span>
              </div>
              <div className="log-section-cards">
                {overdueLogs.map((log) => (
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
          )}

          {/* Today Section */}
          {todayLogs.length > 0 && (
            <div className="log-section" aria-label="Tasks due today">
              <div className="log-section-header">
                <span className="log-section-title">TODAY</span>
                <span className="log-section-count">{todayLogs.length}</span>
              </div>
              <div className="log-section-cards">
                {todayLogs.map((log) => (
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
          )}

          {/* Upcoming Section */}
          {upcomingLogs.length > 0 && (
            <div className="log-section" aria-label="Upcoming future tasks">
              <div className="log-section-header">
                <span className="log-section-title">UPCOMING</span>
                <span className="log-section-count">{upcomingLogs.length}</span>
              </div>
              <div className="log-section-cards">
                {upcomingLogs.map((log) => (
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
          )}
        </div>
      )}
    </section>
  );
};
