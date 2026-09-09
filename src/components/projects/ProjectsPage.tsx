import React, { useState } from 'react';
import { GripVertical, MoreVertical, ChevronUp, ChevronDown, Pencil, Trash2, FolderOpen } from 'lucide-react';
import type { Project } from '../../types';
import { useStorage } from '../../hooks/useStorage';
import { ProjectFormSheet } from './ProjectFormSheet';
import { DeleteProjectDialog } from './DeleteProjectDialog';
import './ProjectsPage.css';

interface ProjectsPageProps {
  onNavigateToProject: (projectId: string) => void;
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({ onNavigateToProject }) => {
  const {
    projects,
    activeLogs,
    createProject,
    updateProject,
    deleteProject,
    moveProject,
    reorderProjects,
  } = useStorage();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);
  const isDraggingRef = React.useRef(false);

  const sortedProjects = [...projects].sort((a, b) => a.order - b.order);

  const getActiveLogCount = (projectId: string) => {
    return activeLogs.filter((log) => log.projectId === projectId).length;
  };

  const handleCreateOpen = () => {
    setEditingProject(null);
    setIsFormOpen(true);
  };

  const handleEditOpen = (project: Project) => {
    setEditingProject(project);
    setIsFormOpen(true);
    setOpenMenuId(null);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingProject(null);
  };

  const handleFormSubmit = async (name: string) => {
    if (editingProject) {
      await updateProject(editingProject.id, name);
    } else {
      await createProject(name);
    }
    handleFormClose();
  };

  const handleDeleteOpen = (project: Project) => {
    setDeletingProject(project);
    setOpenMenuId(null);
  };

  const handleDeleteConfirm = async () => {
    if (deletingProject) {
      await deleteProject(deletingProject.id);
    }
    setDeletingProject(null);
  };

  const handleMoveUp = async (id: string) => {
    await moveProject(id, 'up');
    setOpenMenuId(null);
  };

  const handleMoveDown = async (id: string) => {
    await moveProject(id, 'down');
    setOpenMenuId(null);
  };

  const handleMenuToggle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setOpenMenuId((prev) => (prev === id ? null : id));
  };

  const handleRowClick = (projectId: string) => {
    if (isDraggingRef.current) return;
    setOpenMenuId(null);
    onNavigateToProject(projectId);
  };

  // Close any open menu when clicking elsewhere
  React.useEffect(() => {
    if (!openMenuId) return;
    const closeMenu = () => setOpenMenuId(null);
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, [openMenuId]);

  return (
    <div className="projects-page">
      <div className="projects-page-header">
        <h1 className="projects-page-heading">Projects</h1>
        <button
          type="button"
          id="new-project-btn-top"
          className="projects-add-btn"
          onClick={handleCreateOpen}
          aria-label="Create new project"
        >
          + NEW PROJECT
        </button>
      </div>

      {sortedProjects.length === 0 ? (
        <div className="projects-empty-state">
          <div className="projects-empty-icon">
            <FolderOpen size={36} strokeWidth={1.2} />
          </div>
          <p className="projects-empty-heading">NO PROJECTS YET</p>
          <p className="projects-empty-sub">
            Create a project to organize your logs.
          </p>
          <button
            type="button"
            id="new-project-btn-empty"
            className="projects-add-btn"
            onClick={handleCreateOpen}
          >
            + New Project
          </button>
        </div>
      ) : (
        <ul className="projects-list" role="list">
          {sortedProjects.map((project, index) => {
            const activeCount = getActiveLogCount(project.id);
            const isFirst = index === 0;
            const isLast = index === sortedProjects.length - 1;
            const menuIsOpen = openMenuId === project.id;
            const isBeingDragged = draggedProjectId === project.id;
            const isDropTarget = dragOverProjectId === project.id;

            return (
              <li
                key={project.id}
                className={`project-row ${isBeingDragged ? 'is-dragging' : ''} ${isDropTarget ? 'drag-over' : ''}`}
                role="listitem"
                draggable={!openMenuId}
                onDragStart={(e) => {
                  isDraggingRef.current = true;
                  setDraggedProjectId(project.id);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', project.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (draggedProjectId && draggedProjectId !== project.id && dragOverProjectId !== project.id) {
                    setDragOverProjectId(project.id);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverProjectId === project.id) {
                    setDragOverProjectId(null);
                  }
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  const sourceId = draggedProjectId || e.dataTransfer.getData('text/plain');
                  const targetId = project.id;
                  setDraggedProjectId(null);
                  setDragOverProjectId(null);
                  setTimeout(() => {
                    isDraggingRef.current = false;
                  }, 60);

                  if (!sourceId || sourceId === targetId) return;

                  const currentIds = sortedProjects.map((p) => p.id);
                  const sourceIdx = currentIds.indexOf(sourceId);
                  const targetIdx = currentIds.indexOf(targetId);
                  if (sourceIdx === -1 || targetIdx === -1) return;

                  const nextIds = [...currentIds];
                  const [moved] = nextIds.splice(sourceIdx, 1);
                  nextIds.splice(targetIdx, 0, moved);

                  await reorderProjects(nextIds);
                }}
                onDragEnd={() => {
                  setDraggedProjectId(null);
                  setDragOverProjectId(null);
                  setTimeout(() => {
                    isDraggingRef.current = false;
                  }, 60);
                }}
              >
                <div
                  className="project-row-inner"
                  onClick={() => handleRowClick(project.id)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open project: ${project.name}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleRowClick(project.id);
                    }
                  }}
                >
                  <span className="project-row-grip" aria-hidden="true">
                    <GripVertical size={16} strokeWidth={1.5} />
                  </span>

                  <div className="project-row-info">
                    <span className="project-row-name">{project.name}</span>
                    <span className="project-row-count">
                      {activeCount === 0
                        ? 'No active logs'
                        : `${activeCount} active log${activeCount !== 1 ? 's' : ''}`}
                    </span>
                  </div>

                  <div
                    className="project-row-menu-wrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="project-row-overflow-btn"
                      onClick={(e) => handleMenuToggle(e, project.id)}
                      aria-label={`Options for ${project.name}`}
                      aria-expanded={menuIsOpen}
                      aria-haspopup="true"
                    >
                      <MoreVertical size={16} strokeWidth={1.8} />
                    </button>

                    {menuIsOpen && (
                      <div
                        className="project-overflow-dropdown"
                        role="menu"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="project-overflow-item"
                          role="menuitem"
                          onClick={() => handleMoveUp(project.id)}
                          disabled={isFirst}
                          aria-disabled={isFirst}
                        >
                          <ChevronUp size={14} strokeWidth={2} />
                          <span>Move Up</span>
                        </button>
                        <button
                          type="button"
                          className="project-overflow-item"
                          role="menuitem"
                          onClick={() => handleMoveDown(project.id)}
                          disabled={isLast}
                          aria-disabled={isLast}
                        >
                          <ChevronDown size={14} strokeWidth={2} />
                          <span>Move Down</span>
                        </button>
                        <div className="project-overflow-divider" />
                        <button
                          type="button"
                          className="project-overflow-item"
                          role="menuitem"
                          onClick={() => handleEditOpen(project)}
                        >
                          <Pencil size={14} strokeWidth={1.8} />
                          <span>Rename</span>
                        </button>
                        <button
                          type="button"
                          className="project-overflow-item project-overflow-delete"
                          role="menuitem"
                          onClick={() => handleDeleteOpen(project)}
                        >
                          <Trash2 size={14} strokeWidth={1.8} />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ProjectFormSheet
        key={editingProject ? `edit-${editingProject.id}` : 'create'}
        isOpen={isFormOpen}
        editingProject={editingProject}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
      />

      <DeleteProjectDialog
        project={deletingProject}
        affectedLogCount={
          deletingProject
            ? activeLogs.filter((l) => l.projectId === deletingProject.id).length
            : 0
        }
        onCancel={() => setDeletingProject(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};
