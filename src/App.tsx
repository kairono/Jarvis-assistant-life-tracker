import { useEffect, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { db } from './lib/db';
import type { ViewId } from './nav';
import { Dashboard } from './pages/Dashboard';
import { Finances } from './pages/Finances';
import { Training } from './pages/Training';
import { Goals } from './pages/Goals';
import { Tasks } from './pages/Tasks';
import { VisionBoard } from './pages/VisionBoard';
import { Calendar } from './pages/Calendar';
import { Settings } from './pages/Settings';

export default function App() {
  const [view, setView] = useState<ViewId>('dashboard');

  // Seed sample data on first run so the app is never empty.
  useEffect(() => {
    db.seedIfEmpty();
  }, []);

  return (
    <AppShell current={view} onNavigate={setView}>
      {view === 'dashboard' && <Dashboard onNavigate={setView} />}
      {view === 'finances' && <Finances />}
      {view === 'training' && <Training />}
      {view === 'goals' && <Goals />}
      {view === 'tasks' && <Tasks />}
      {view === 'vision' && <VisionBoard />}
      {view === 'calendar' && <Calendar />}
      {view === 'settings' && <Settings />}
    </AppShell>
  );
}
