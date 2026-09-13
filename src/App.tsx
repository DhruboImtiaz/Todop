import React, { useState, useEffect } from 'react';
import { StorageProvider } from './context/StorageProvider';
import { AuthProvider, useAuth } from './context/AuthProvider';
import { useStorage } from './hooks/useStorage';
import type { NavigationTab, Log, Project } from './types';
import { useRealtimeTicker } from './hooks/useRealtimeTicker';
import { useIsDesktop } from './hooks/useIsDesktop';
import { TopBar } from './components/layout/TopBar';
import { BottomNav } from './components/layout/BottomNav';
import { Sidebar } from './components/layout/Sidebar';
import { UpcomingPage } from './components/logs/UpcomingPage';
import { LogFormSheet } from './components/logs/LogFormSheet';
import { FloatingAddButton } from './components/common/FloatingAddButton';
import { ProjectsPage } from './components/projects/ProjectsPage';
import { ProjectDetailPage } from './components/projects/ProjectDetailPage';
import { CalendarPage } from './components/calendar/CalendarPage';
import { SearchPage } from './components/search/SearchPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { LoginPage } from './components/auth/LoginPage';
import { SignUpPage } from './components/auth/SignUpPage';
import { ForgotPasswordFlow } from './components/auth/ForgotPasswordFlow';

import { getRouteFromPath, getPathFromRoute } from './utils/routing';

const ProtectedApp: React.FC = () => {
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

  const { activeLogs, projects, createLog, updateLog, toggleLogCompletion, deleteLog, addSubtask } =
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

  const handleNavigate = (tab: NavigationTab) => {
    navigateTo(tab, null);
  };

  // Keep state in sync with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const route = getInitialRoute();
      setCurrentTab(route.tab);
      setActiveProjectId(route.projectId ?? null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
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
    draftSubtasks?: string[];
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
      const created = await createLog({
        title: data.title,
        description: data.description,
        deadline: data.deadline,
        projectId: data.projectId ?? null,
      });
      if (data.draftSubtasks && data.draftSubtasks.length > 0) {
        for (const stTitle of data.draftSubtasks) {
          await addSubtask(created.id, stTitle);
        }
      }
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

  const isDesktop = useIsDesktop();

  const renderContent = () => (
    <>
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

      {currentTab === 'calendar' && (
        <CalendarPage />
      )}

      {currentTab === 'search' && (
        <SearchPage />
      )}

      {currentTab === 'settings' && (
        <SettingsPage />
      )}

      {/* Floating Add Button (only on Upcoming) */}
      {currentTab === 'upcoming' && (
        <FloatingAddButton onClick={handleOpenCreate} />
      )}

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
    </>
  );

  return (
    <div className="app-viewport-wrapper">
      {isDesktop ? (
        <div className="app-shell-desktop">
          <Sidebar currentTab={currentTab} onSelectTab={handleNavigate} />
          <main className="app-main-area" id="main-content">
            <div className="app-content">
              {renderContent()}
            </div>
          </main>
        </div>
      ) : (
        <div className="app-container">
          <TopBar
            currentTab={currentTab}
            onNavigate={handleNavigate}
          />
          <main className="app-content" id="main-content">
            {renderContent()}
          </main>
          <BottomNav
            currentTab={currentTab}
            onSelectTab={handleNavigate}
          />
        </div>
      )}
    </div>
  );
};

const AuthRouter: React.FC = () => {
  const { session, loading, isRecovery } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'signup' | 'forgot_password'>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.replace(/\/+$/, '').toLowerCase();
      if (path === '/signup') return 'signup';
    }
    return 'login';
  });

  if (loading) {
    return (
      <div className="auth-loading-splash">
        <div className="auth-loading-spinner" />
        <h2>Loading TODOP...</h2>
      </div>
    );
  }

  const isRecovering = isRecovery || authView === 'forgot_password';

  if (isRecovering) {
    return <ForgotPasswordFlow onReturnToLogin={() => setAuthView('login')} />;
  }

  if (!session) {
    if (authView === 'signup') {
      return <SignUpPage onNavigateToLogin={() => setAuthView('login')} />;
    } else {
      return (
        <LoginPage 
          onNavigateToSignUp={() => setAuthView('signup')} 
          onNavigateToForgotPassword={() => setAuthView('forgot_password')}
        />
      );
    }
  }

  // If authenticated user is on /login or /signup, normalize URL to /
  if (typeof window !== 'undefined') {
    const path = window.location.pathname.replace(/\/+$/, '').toLowerCase();
    if (path === '/login' || path === '/signup') {
      window.history.replaceState(null, '', '/');
    }
  }

  return (
    <StorageProvider>
      <ProtectedApp />
    </StorageProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AuthRouter />
    </AuthProvider>
  );
}
