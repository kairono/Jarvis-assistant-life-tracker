import { useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { AssistantPanel } from '../assistant/AssistantPanel';
import { Icon } from '../Icon';
import { VIEW_TITLES, type ViewId } from '../../nav';

export function AppShell({
  current,
  onNavigate,
  children,
}: {
  current: ViewId;
  onNavigate: (id: ViewId) => void;
  children: ReactNode;
}) {
  const [assistantOpen, setAssistantOpen] = useState(false);
  const meta = VIEW_TITLES[current];
  const now = new Date();

  return (
    <div className="relative flex h-screen overflow-hidden">
      {/* Ambient HUD backdrop */}
      <div className="pointer-events-none fixed inset-0 -z-10 hud-grid" />
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            'radial-gradient(120% 80% at 80% -10%, rgb(var(--c-accent) / 0.14), transparent 60%),' +
            'radial-gradient(90% 70% at -10% 110%, rgb(var(--c-accent2) / 0.10), transparent 55%)',
        }}
      />

      <Sidebar current={current} onNavigate={onNavigate} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-border/60 bg-surface/30 px-6 py-4 backdrop-blur-sm">
          <div>
            <h1 className="text-xl text-text">{meta.title}</h1>
            <p className="text-sm text-muted">{meta.subtitle}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <div className="font-mono text-sm text-text">
                {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="label-tech">
                {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
            </div>
            <button
              onClick={() => setAssistantOpen(true)}
              className="btn-primary"
            >
              <Icon name="cpu" size={16} />
              Ask Jarvis
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-6xl animate-fade-in">{children}</div>
        </main>
      </div>

      {/* Click-away backdrop for the assistant */}
      {assistantOpen && (
        <div className="fixed inset-0 z-30 bg-black/40" onClick={() => setAssistantOpen(false)} />
      )}
      <AssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </div>
  );
}
