import { Icon } from '../Icon';
import { JarvisCore } from '../JarvisCore';
import { NAV, type ViewId } from '../../nav';

export function Sidebar({
  current,
  onNavigate,
}: {
  current: ViewId;
  onNavigate: (id: ViewId) => void;
}) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border/60 bg-surface/40 backdrop-blur-sm">
      {/* Brand / core */}
      <div className="flex flex-col items-center gap-2 px-4 py-6">
        <JarvisCore size={84} />
        <div className="text-center">
          <div className="font-display text-xl tracking-[0.3em] text-text text-glow">JARVIS</div>
          <div className="label-tech mt-0.5">Life OS · online</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const active = item.id === current;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                active
                  ? 'border border-accent/40 bg-accent/10 text-accent shadow-glow-sm'
                  : 'border border-transparent text-muted hover:bg-panel/60 hover:text-text'
              }`}
            >
              <Icon name={item.icon} size={18} />
              <span className="font-medium">{item.label}</span>
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border/60 px-4 py-3 text-[10px] text-muted">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          All systems nominal
        </div>
      </div>
    </aside>
  );
}
