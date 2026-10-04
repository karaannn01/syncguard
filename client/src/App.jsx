import React, { useState, useEffect } from 'react';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import BottomNav from './components/layout/BottomNav';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import TaskDetailPage from './pages/TaskDetailPage';
import SyncCenterPage from './pages/SyncCenterPage';
import ConflictCenterPage from './pages/ConflictCenterPage';
import ActivityHistoryPage from './pages/ActivityHistoryPage';
import AdminTeamPage from './pages/AdminTeamPage';
import ProfilePage from './pages/ProfilePage';
import NewTaskModal from './components/tasks/NewTaskModal';
import ScenarioRunnerModal from './components/demo/ScenarioRunnerModal';
import syncManager from './services/syncManager';

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [selectedConflictId, setSelectedConflictId] = useState(null);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [isDemoOpen, setIsDemoOpen] = useState(false);

  // Initial pull of server tasks on boot
  useEffect(() => {
    syncManager.syncNow().catch((err) => {
      console.warn('Initial sync notice:', err.message);
    });
  }, []);

  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectTask = (taskId) => {
    setSelectedTaskId(taskId);
    setActiveTab(`task-detail`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToConflict = (conflictId) => {
    setSelectedConflictId(conflictId || null);
    setActiveTab('conflicts');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar onOpenDemoModal={() => setIsDemoOpen(true)} />

      {/* Main App Container */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Desktop Sidebar */}
        <Sidebar
          activeTab={activeTab.startsWith('task-detail') ? 'tasks' : activeTab}
          onSelectTab={handleSelectTab}
          onOpenDemo={() => setIsDemoOpen(true)}
        />

        {/* Dynamic Page Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-full overflow-hidden">
          {activeTab === 'dashboard' && (
            <DashboardPage
              onNavigate={(dest) => {
                if (dest.startsWith('task-detail-')) {
                  handleSelectTask(dest.replace('task-detail-', ''));
                } else {
                  handleSelectTab(dest);
                }
              }}
              onOpenNewTask={() => setIsNewTaskOpen(true)}
              onOpenDemo={() => setIsDemoOpen(true)}
            />
          )}

          {activeTab === 'tasks' && (
            <TasksPage
              onSelectTask={handleSelectTask}
              onOpenNewTask={() => setIsNewTaskOpen(true)}
            />
          )}

          {activeTab === 'task-detail' && (
            <TaskDetailPage
              taskId={selectedTaskId || 'tsk-7701'}
              onBack={() => handleSelectTab('tasks')}
              onNavigateToConflict={handleNavigateToConflict}
            />
          )}

          {activeTab === 'sync' && (
            <SyncCenterPage
              onNavigateToConflict={handleNavigateToConflict}
            />
          )}

          {activeTab === 'conflicts' && (
            <ConflictCenterPage
              initialConflictId={selectedConflictId}
              onResolved={() => handleSelectTab('tasks')}
            />
          )}

          {activeTab === 'activity' && (
            <ActivityHistoryPage />
          )}

          {activeTab === 'admin' && (
            <AdminTeamPage />
          )}

          {activeTab === 'profile' && (
            <ProfilePage />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation (Visible on screen < 768px) */}
      <BottomNav
        activeTab={activeTab.startsWith('task-detail') ? 'tasks' : activeTab}
        onSelectTab={handleSelectTab}
      />

      {/* Modals */}
      <NewTaskModal
        isOpen={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        onCreated={(task) => {
          handleSelectTask(task.id);
        }}
      />

      <ScenarioRunnerModal
        isOpen={isDemoOpen}
        onClose={() => setIsDemoOpen(false)}
        onNavigateToConflict={handleNavigateToConflict}
      />
    </div>
  );
}

export default App;
