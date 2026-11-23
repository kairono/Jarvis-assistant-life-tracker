import { AppIcon } from '../AppIcon';
import { JarvisCore } from '../JarvisCore';
import { NAV, type ViewId } from '../../nav';

// ------------------------------------------------------------------ //
//  Navigation: the Jarvis sidebar (core, brand, labelled sections) as  //
//  a floating glass panel with visionOS-style round app icons. On      //
//  phones it becomes a bottom capsule of icons.                        //
// ------------------------------------------------------------------ //

export function Sidebar({
  current,
  onNavigate,
}: {
  current: ViewId;
  onNavigate: (id: ViewId) => void;
}) {
  return (
    <>
      {/* Desktop: floating glass sidebar with the Jarvis core */}
      <aside
        aria-label="Sections"
        className="glass hud-corners fixed bottom-4 left-4 top-4 z-20 hidden w-56 flex-col rounded-[28px] md:flex"
      >
        <div className="flex flex-col items-center gap-2 px-4 pb-4 pt-6">
          <JarvisCore size={84} />
          <div className="text-center">
            <div className="font-display text-xl tracking-[0.3em] text-text text-glow">JARVIS</div>
            <div className="label-tech mt-0.5">Life OS · online</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {NAV.map((item) => {
            const active = item.id === current;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-full p-1 pr-3 text-sm font-medium transition ${
                  active
                    ? 'bg-accent/15 text-text shadow-glow-sm ring-1 ring-accent/40'
                    : 'text-muted hover:bg-white/10 hover:text-text'
                }`}
              >
                <AppIcon icon={item.icon} colors={item.colors} size={34} active={active} />
                <span>{item.label}</span>
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 border-t border-white/10 px-5 py-3 text-[10px] text-muted">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          All systems nominal
        </div>
      </aside>

      {/* Phone: bottom ornament */}
      <nav
        aria-label="Sections"
        className="glass fixed inset-x-2 bottom-2 z-20 flex justify-between overflow-x-auto rounded-[28px] px-1.5 py-2 md:hidden"
      >
        {NAV.map((item) => {
          const active = item.id === current;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
              className="flex min-w-0 flex-1 flex-col items-center gap-0.5"
            >
              <AppIcon icon={item.icon} colors={item.colors} size={32} active={active} />
              <span className={`max-w-full truncate text-[9px] ${active ? 'text-text' : 'text-muted'}`}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
