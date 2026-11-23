import { useLogFormSubmit } from '../../hooks/useLogFormSubmit';
import React, { useState } from 'react';
import { ArrowLeft, FolderOpen, Plus } from 'lucide-react';
import type { Log, Project } from '../../types';
import { useStorage } from '../../hooks/useStorage';
import { LogCard } from '../logs/LogCard';
import { LogFormSheet } from '../logs/LogFormSheet';
import { useRealtimeTicker } from '../../hooks/useRealtimeTicker';
import { ProjectRoadmap } from './ProjectRoadmap';
import './ProjectDetailPage.css';

interface ProjectDetailPageProps {
  project: Project;
  onBack: () => void;
  shared?: boolean;
}

export const ProjectDetailPage: React.FC<ProjectDetailPageProps> = ({
  project,
  onBack,
  shared = false,
}) => {
  const { activeLogs, completedLogs, toggleLogCompletion, deleteLog } =
    useStorage();

  const currentTimestamp = useRealtimeTicker(5000);

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<Log | null>(null);
  const [showRoadmap, setShowRoadmap] = useState(false);

  // Filter logs belonging to this project
  const projectActiveLogs = activeLogs.filter((l) => l.projectId === project.id);
  const projectCompletedLogs = completedLogs.filter((l) => l.projectId === project.id);

  const handleOpenCreate = () => {
    setEditingLog(null);
    setIsSheetOpen(true);
  };

  const handleOpenEdit = (log: Log) => {
    setEditingLog(log);
    setIsSheetOpen(true);
  };

  const handleCloseSheet = () => {
    setIsSheetOpen(false);
    setEditingLog(null);
  };

  const handleFormSubmit = useLogFormSubmit(editingLog, handleCloseSheet);

  const handleComplete = async (id: string) => {
    await toggleLogCompletion(id);
  };

  const handleDelete = async (id: string) => {
    await deleteLog(id);
  };

  const isEmpty = projectActiveLogs.length === 0 && projectCompletedLogs.length === 0;

  return (
    <div className="planner-page">
      <header className="project-detail-heading">
        {!shared && (
          <button type="button" className="project-detail-back-btn" onClick={onBack} aria-label="Back to Projects">
            <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
            <span>Projects</span>
          </button>
        )}
        <div className="page-header">
          <div className="page-header-main">
            <h1 className="page-title">{project.name}</h1>
          </div>
          <button
            type="button"
            id="project-detail-new-log-btn"
            className="workspace-secondary"
            onClick={handleOpenCreate}
            aria-label={`Add log to ${project.name}`}
          >
            <Plus size={16} aria-hidden="true" /> New task
          </button>
        </div>
      </header>

      <div className="project-view-switch" role="group" aria-label="Project view">
        <button className="workspace-secondary" aria-pressed={!showRoadmap} onClick={() => setShowRoadmap(false)}>Tasks</button>
        <button className="workspace-secondary" aria-pressed={showRoadmap} onClick={() => setShowRoadmap(true)}>Roadmap</button>
      </div>

      {showRoadmap ? (
        <ProjectRoadmap tasks={[...projectActiveLogs, ...projectCompletedLogs]} now={currentTimestamp} onEdit={handleOpenEdit} />
      ) : isEmpty ? (
        <div className="project-detail-empty">
          <div className="project-detail-empty-icon">
            <FolderOpen size={32} strokeWidth={1.2} />
          </div>
          <p className="project-detail-empty-heading">NO LOGS YET</p>
          <p className="project-detail-empty-sub">
            Add a log to start tracking tasks for this project.
          </p>
          <button
            type="button"
            className="workspace-secondary"
            onClick={handleOpenCreate}
          >
            <Plus size={16} aria-hidden="true" /> New task
          </button>
        </div>
      ) : (
        <div className="project-detail-content">
          {projectActiveLogs.length > 0 && (
            <section className="project-detail-section">
              <h2 className="project-detail-section-heading">ACTIVE</h2>
              <div className="project-detail-log-list">
                {projectActiveLogs.map((log) => (
                  <LogCard
                    key={log.id}
                    log={log}
                    currentTimestamp={currentTimestamp}
                    onComplete={(id: string) => handleComplete(id)}
                    onEdit={handleOpenEdit}
                    onDelete={(id: string) => handleDelete(id)}
                  />
                ))}
              </div>
            </section>
          )}

          {projectCompletedLogs.length > 0 && (
            <section className="project-detail-section">
              <h2 className="project-detail-section-heading">COMPLETED</h2>
              <div className="project-detail-log-list">
                {projectCompletedLogs.map((log) => (
                  <LogCard
                    key={log.id}
                    log={log}
                    currentTimestamp={currentTimestamp}
                    onComplete={(id: string) => handleComplete(id)}
                    onEdit={handleOpenEdit}
                    onDelete={(id: string) => handleDelete(id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <LogFormSheet
        isOpen={isSheetOpen}
        initialLog={editingLog}
        defaultProjectId={project.id}
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
