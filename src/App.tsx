import { useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import type { ViewId } from './nav';
import { Dashboard } from './pages/Dashboard';
import { Finances } from './pages/Finances';
import { Training } from './pages/Training';
import { Goals } from './pages/Goals';
import { Tasks } from './pages/Tasks';
import { Settings } from './pages/Settings';
import { Tracker } from './pages/Tracker';
import { Memory } from './pages/Memory';

export default function App() {
  const [view, setView] = useState<ViewId>('dashboard');

  return (
    <AppShell current={view} onNavigate={setView}>
      {view === 'dashboard' && <Dashboard onNavigate={setView} />}
      {view === 'finances' && <Finances />}
      {view === 'training' && <Training />}
      {view === 'goals' && <Goals />}
      {view === 'tasks' && <Tasks />}
      {view === 'tracker' && <Tracker />}
      {view === 'memory' && <Memory />}
      {view === 'settings' && <Settings />}
    </AppShell>
  );
}
