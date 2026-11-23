import { useEffect, useState, type ReactNode } from 'react';
import { artifactStore } from '../../lib/db';
import type { DbStatus } from '../../lib/db/ArtifactDbStore';
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
    <div className="relative h-screen overflow-hidden">
      {/* HUD environment (grid + accent glow) behind the glass */}
      <div className="vision-backdrop pointer-events-none fixed inset-0 -z-10" />

      <Sidebar current={current} onNavigate={onNavigate} />

      <main className="h-full overflow-y-auto px-4 pb-28 pt-4 md:pb-8 md:pl-[16.5rem] md:pr-8 md:pt-4">
        <div className="mx-auto max-w-6xl">
          {/* Floating title bar */}
          <header className="glass sticky top-0 z-10 mb-6 flex items-center justify-between gap-3 rounded-[28px] px-5 py-3.5">
            <div className="min-w-0">
              <h1 className="truncate text-base text-text sm:text-xl">{meta.title}</h1>
              <p className="truncate text-sm text-muted">{meta.subtitle}</p>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <div className="hidden text-right sm:block">
                <div className="font-mono text-sm text-text">
                  {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="label-tech">
                  {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
              </div>
              <button onClick={() => setAssistantOpen(true)} className="btn-primary">
                <Icon name="cpu" size={16} />
                Ask Jarvis
              </button>
            </div>
          </header>

          <div key={current} className="animate-fade-in">
            <StorageBanner />
            {children}
          </div>
        </div>
      </main>

      {/* Click-away backdrop for the assistant */}
      {assistantOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[2px]" onClick={() => setAssistantOpen(false)} />
      )}
      <AssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </div>
  );
}

/** Artifact only: explains an empty app when the artifact database can't load. */
function StorageBanner() {
  const [status, setStatus] = useState<DbStatus | null>(artifactStore?.status ?? null);
  useEffect(() => artifactStore?.onStatus(setStatus), []);
  if (status !== 'unavailable') return null;
  return (
    <div className="mb-4 rounded-2xl border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
      Your Jarvis data couldn’t load. Open this artifact on claude.ai while signed in, then reload.
    </div>
  );
}
