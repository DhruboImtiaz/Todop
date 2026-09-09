import React, { useState, useRef } from 'react';
import { Search, X } from 'lucide-react';
import type { Log } from '../../types';
import { useStorage } from '../../hooks/useStorage';
import { useRealtimeTicker } from '../../hooks/useRealtimeTicker';
import { searchLogs } from '../../utils/search';
import { LogCard } from '../logs/LogCard';
import { LogFormSheet } from '../logs/LogFormSheet';
import './SearchPage.css';

export const SearchPage: React.FC = () => {
  const { activeLogs, completedLogs, updateLog, toggleLogCompletion, deleteLog } =
    useStorage();
  const currentTimestamp = useRealtimeTicker(5000);

  const [query, setQuery] = useState('');
  const [editingLog, setEditingLog] = useState<Log | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Combine all stored logs for single-record search across active and completed archives
  const allLogs = [...activeLogs, ...completedLogs];
  const searchResults = searchLogs(allLogs, query);

  const isQueryEmpty = query.trim().length === 0;
  const hasNoMatches = !isQueryEmpty && searchResults.totalMatches === 0;

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  const handleOpenEdit = (log: Log) => {
    setEditingLog(log);
    setIsSheetOpen(true);
  };

  const handleCloseSheet = () => {
    setIsSheetOpen(false);
    setEditingLog(null);
  };

  const handleFormSubmit = async (data: {
    title: string;
    description?: string;
    deadline: string;
    projectId?: string;
  }) => {
    if (editingLog) {
      await updateLog({
        id: editingLog.id,
        title: data.title,
        description: data.description,
        deadline: data.deadline,
        projectId: data.projectId ?? null,
      });
    }
    handleCloseSheet();
  };

  const handleComplete = async (id: string) => {
    await toggleLogCompletion(id);
  };

  const handleDelete = async (id: string) => {
    await deleteLog(id);
  };

  return (
    <div className="search-page">
      {/* Header */}
      <div className="search-page-header">
        <h1 className="search-page-heading">SEARCH</h1>
        <p className="search-page-subtitle">Find a log by name.</p>
      </div>

      {/* Prominent Search Input */}
      <div className="search-input-container">
        <span className="search-input-icon" aria-hidden="true">
          <Search size={18} strokeWidth={2} />
        </span>
        <input
          ref={inputRef}
          id="search-logs-input"
          type="text"
          className="search-input-field"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search logs..."
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Search logs by name"
        />
        {query.length > 0 && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={handleClear}
            aria-label="Clear search"
          >
            <X size={16} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Initial Empty-Query State */}
      {isQueryEmpty && (
        <div className="search-empty-state">
          <div className="search-empty-icon" aria-hidden="true">
            <Search size={36} strokeWidth={1.2} />
          </div>
          <p className="search-empty-heading">SEARCH LOGS</p>
          <p className="search-empty-sub">Find a log by name.</p>
        </div>
      )}

      {/* No Matches State */}
      {hasNoMatches && (
        <div className="search-empty-state">
          <div className="search-empty-icon" aria-hidden="true">
            <Search size={36} strokeWidth={1.2} />
          </div>
          <p className="search-empty-heading">NO MATCHES</p>
          <p className="search-empty-sub">Try another search.</p>
        </div>
      )}

      {/* Results State */}
      {!isQueryEmpty && searchResults.totalMatches > 0 && (
        <div className="search-results-content">
          {/* Active Results Section */}
          {searchResults.active.length > 0 && (
            <section className="search-results-section" aria-labelledby="active-results-heading">
              <h2 id="active-results-heading" className="search-section-heading">
                ACTIVE
              </h2>
              <div className="search-log-list">
                {searchResults.active.map((log) => (
                  <LogCard
                    key={log.id}
                    log={log}
                    currentTimestamp={currentTimestamp}
                    onComplete={handleComplete}
                    onEdit={handleOpenEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Completed Results Section */}
          {searchResults.completed.length > 0 && (
            <section className="search-results-section" aria-labelledby="completed-results-heading">
              <h2 id="completed-results-heading" className="search-section-heading">
                COMPLETED
              </h2>
              <div className="search-log-list">
                {searchResults.completed.map((log) => (
                  <LogCard
                    key={log.id}
                    log={log}
                    currentTimestamp={currentTimestamp}
                    onComplete={handleComplete}
                    onEdit={handleOpenEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Reused LogFormSheet for viewing and editing log */}
      <LogFormSheet
        isOpen={isSheetOpen}
        initialLog={editingLog}
        onClose={handleCloseSheet}
        onSubmit={handleFormSubmit}
        onComplete={async (id) => {
          await handleComplete(id);
          handleCloseSheet();
        }}
        onDelete={async (id) => {
          await handleDelete(id);
          handleCloseSheet();
        }}
      />
    </div>
  );
};
