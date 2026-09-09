import React, { useState } from 'react';
import { StorageProvider } from './context/StorageProvider';
import { useStorage } from './hooks/useStorage';
import type { NavigationTab, Log, Project } from './types';
import { useRealtimeTicker } from './hooks/useRealtimeTicker';
import { TopBar } from './components/layout/TopBar';
import { BottomNav } from './components/layout/BottomNav';
import { UpcomingPage } from './components/logs/UpcomingPage';
import { LogFormSheet } from './components/logs/LogFormSheet';
import { FloatingAddButton } from './components/common/FloatingAddButton';
import { ProjectsPage } from './components/projects/ProjectsPage';
import { ProjectDetailPage } from './components/projects/ProjectDetailPage';
import { SearchPage } from './components/search/SearchPage';
import { SettingsPage } from './components/settings/SettingsPage';

import { getRouteFromPath, getPathFromRoute } from './utils/routing';

const TodopMain: React.FC = () => {
  const getInitialRoute = () => {
    if (typeof window !== 'undefined') {
      return getRouteFromPath(window.location.pathname);
    }
    return { tab: 'upcoming' as NavigationTab };
  };

  const [currentTab, setCurrentTab] = useState<NavigationTab>(() => getInitialRoute().tab);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    () => getInitialRoute().projectId ?? null
  );

  const { activeLogs, projects, createLog, updateLog, toggleLogCompletion, deleteLog } =
    useStorage();

  // Resolve active project object from context (always fresh)
  const activeProject: Project | null =
    activeProjectId ? (projects.find((p) => p.id === activeProjectId) ?? null) : null;

  const navigateTo = (tab: NavigationTab, projectId: string | null = null) => {
    setCurrentTab(tab);
    setActiveProjectId(projectId);
    const path = getPathFromRoute({ tab, projectId });
    if (typeof window !== 'undefined' && window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  };

  const handleNavigate = (tab: NavigationTab) => navigateTo(tab, null);

  React.useEffect(() => {
    const onPopState = () => {
      const route = getRouteFromPath(window.location.pathname);
      setCurrentTab(route.tab);
      setActiveProjectId(route.projectId ?? null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<Log | null>(null);

  const currentTimestamp = useRealtimeTicker(5000);

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

  // Determine whether to show project detail or project list
  const showProjectDetail = currentTab === 'projects' && activeProject !== null;
  const showProjectList = currentTab === 'projects' && activeProject === null;

  return (
    <div className="app-viewport-wrapper">
      <div className="app-container">
        {/* Fixed Header */}
        <TopBar
          currentTab={currentTab}
          onNavigate={handleNavigate}
        />

        {/* Main Content Area */}
        <main className="app-content" id="main-content">
          {currentTab === 'upcoming' && (
            <UpcomingPage
              logs={activeLogs}
              currentTimestamp={currentTimestamp}
              onCompleteLog={handleComplete}
              onEditLog={handleOpenEdit}
              onDeleteLog={handleDelete}
              onOpenCreateSheet={handleOpenCreate}
            />
          )}

          {showProjectList && (
            <ProjectsPage
              onNavigateToProject={(projectId) => navigateTo('projects', projectId)}
            />
          )}

          {showProjectDetail && activeProject && (
            <ProjectDetailPage
              project={activeProject}
              onBack={() => navigateTo('projects', null)}
            />
          )}

          {currentTab === 'search' && (
            <SearchPage />
          )}

          {currentTab === 'settings' && (
            <SettingsPage />
          )}
        </main>

        {/* Floating Add Button (only on Upcoming) */}
        {currentTab === 'upcoming' && (
          <FloatingAddButton onClick={handleOpenCreate} />
        )}

        {/* Fixed Bottom Navigation */}
        <BottomNav
          currentTab={currentTab}
          onSelectTab={handleNavigate}
        />

        {/* Add/Edit Log Bottom Sheet (Upcoming context only) */}
        {currentTab === 'upcoming' && (
          <LogFormSheet
            isOpen={isSheetOpen}
            initialLog={editingLog}
            onClose={handleCloseSheet}
            onSubmit={handleFormSubmit}
            onComplete={async (id: string) => {
              await handleComplete(id);
              handleCloseSheet();
            }}
            onDelete={async (id: string) => {
              await handleDelete(id);
              handleCloseSheet();
            }}
          />
        )}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <StorageProvider>
      <TodopMain />
    </StorageProvider>
  );
}
