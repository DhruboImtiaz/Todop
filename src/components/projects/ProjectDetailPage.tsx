import React, { useState } from 'react';
import { ArrowLeft, FolderOpen } from 'lucide-react';
import type { Log, Project } from '../../types';
import { useStorage } from '../../hooks/useStorage';
import { LogCard } from '../logs/LogCard';
import { LogFormSheet } from '../logs/LogFormSheet';
import { useRealtimeTicker } from '../../hooks/useRealtimeTicker';
import './ProjectDetailPage.css';

interface ProjectDetailPageProps {
  project: Project;
  onBack: () => void;
}

export const ProjectDetailPage: React.FC<ProjectDetailPageProps> = ({
  project,
  onBack,
}) => {
  const { activeLogs, completedLogs, createLog, updateLog, toggleLogCompletion, deleteLog } =
    useStorage();

  const currentTimestamp = useRealtimeTicker(5000);

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<Log | null>(null);

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
    } else {
      await createLog({
        title: data.title,
        description: data.description,
        deadline: data.deadline,
        projectId: project.id, // default to this project
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

  const isEmpty = projectActiveLogs.length === 0 && projectCompletedLogs.length === 0;

  return (
    <div className="project-detail-page">
      {/* Sub-header */}
      <div className="project-detail-header">
        <button
          type="button"
          className="project-detail-back-btn"
          onClick={onBack}
          aria-label="Back to Projects"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          <span>PROJECTS</span>
        </button>

        <button
          type="button"
          id="project-detail-new-log-btn"
          className="project-detail-add-btn"
          onClick={handleOpenCreate}
          aria-label={`Add log to ${project.name}`}
        >
          + NEW LOG
        </button>
      </div>

      <h1 className="project-detail-name">{project.name}</h1>

      {isEmpty ? (
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
            className="project-detail-add-btn-empty"
            onClick={handleOpenCreate}
          >
            + New Log
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
                    onComplete={handleComplete}
                    onEdit={handleOpenEdit}
                    onDelete={handleDelete}
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
