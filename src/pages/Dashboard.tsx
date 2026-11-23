import { useEffect, useState } from 'react';
import { AppIcon } from '../components/AppIcon';
import { JarvisCore } from '../components/JarvisCore';
import { SpendingPie } from '../components/charts/SpendingPie';
import { IncomeExpenseLine } from '../components/charts/IncomeExpenseLine';
import { Badge, EmptyState, Panel, ProgressBar, SectionHeader, StatCard } from '../components/ui';
import { Icon } from '../components/Icon';
import { useCollection } from '../hooks/useStore';
import { incomeExpenseByMonth, spendingByCategory } from '../lib/analytics';
import { isThisMonth, money, relativeDay, shortDate } from '../lib/format';
import { NAV, type ViewId } from '../nav';
import { listCalendarEvents, type GcalEvent } from '../lib/gcal';
import { IS_ARTIFACT } from '../lib/runtime';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 5) return 'Burning the midnight oil';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

// Cached across visits to Home so switching tabs doesn't re-query Google.
let eventsCache: { at: number; events: GcalEvent[] } | null = null;
const CACHE_MS = 5 * 60_000;

/** Next few Google Calendar events (artifact only; empty elsewhere). */
function useUpcomingEvents() {
  const fresh = eventsCache && Date.now() - eventsCache.at < CACHE_MS ? eventsCache.events : null;
  const [events, setEvents] = useState<GcalEvent[]>(fresh ?? eventsCache?.events ?? []);
  const [note, setNote] = useState<string | null>(IS_ARTIFACT ? null : 'Google Calendar shows up in the claude.ai artifact');
  useEffect(() => {
    if (!IS_ARTIFACT || fresh) return;
    let alive = true;
    // Let the page paint first; the connector call can take a moment.
    const t = setTimeout(() => {
      listCalendarEvents(new Date(), new Date(Date.now() + 3 * 86_400_000))
        .then((es) => {
          const upcoming = es.filter((e) => new Date(e.end).getTime() >= Date.now()).slice(0, 4);
          eventsCache = { at: Date.now(), events: upcoming };
          if (alive) setEvents(upcoming);
        })
        .catch((e) => alive && setNote(e instanceof Error ? e.message : 'Google Calendar unavailable'));
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [fresh]);
  return { events, note };
}

const eventWhen = (e: GcalEvent) =>
  e.allDay
    ? relativeDay(e.start)
    : `${relativeDay(e.start)} ${new Date(e.start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;

export function Dashboard({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  const txns = useCollection('transactions');
  const goals = useCollection('goals');
  const tasks = useCollection('tasks');
  const workouts = useCollection('workouts');
  const { events: upcomingEvents, note: calendarNote } = useUpcomingEvents();

  const month = txns.filter((t) => isThisMonth(t.date));
  const spent = month.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const earned = month.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const net = earned - spent;

  const activeGoals = goals.filter((g) => g.status === 'active');
  const openTasks = tasks
    .filter((t) => !t.done)
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  const dueToday = openTasks.filter((t) => t.dueDate && relativeDay(t.dueDate) === 'Today').length;
  const weekStart = Date.now() - 7 * 86_400_000;
  const workoutsThisWeek = workouts.filter((w) => new Date(`${w.date}T00:00:00`).getTime() >= weekStart).length;

  const recent = [...txns].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Hero: the Jarvis core + today's briefing, then the app grid */}
      <Panel corners className="overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <JarvisCore size={132} className="shrink-0" />
          <div className="flex-1 text-center sm:text-left">
            <div className="label-tech">Systems online · {new Date().toLocaleDateString(undefined, { weekday: 'long' })}</div>
            <h2 className="mt-1 text-2xl text-text">{greeting()}. Here is your day.</h2>
            <p className="mt-2 max-w-xl text-sm text-muted">
              {dueToday > 0
                ? `You have ${dueToday} task${dueToday > 1 ? 's' : ''} due today`
                : 'Nothing due today'}
              {upcomingEvents[0] ? ` · next up: ${upcomingEvents[0].title} (${eventWhen(upcomingEvents[0])})` : ''}
              {net < 0 ? ` · spending is ahead of income this month` : ` · net positive this month`}.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Badge tone="accent">{activeGoals.length} active goals</Badge>
              <Badge tone="success">{workoutsThisWeek} workouts this week</Badge>
              <Badge tone={openTasks.length ? 'warn' : 'muted'}>{openTasks.length} open tasks</Badge>
            </div>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-4 gap-x-2 gap-y-5 border-t border-white/10 pt-6 sm:grid-cols-7">
          {NAV.filter((n) => n.id !== 'dashboard').map((n) => (
            <button
              key={n.id}
              onClick={() => onNavigate(n.id)}
              className="group flex flex-col items-center gap-2 rounded-2xl p-1 transition"
            >
              <span className="transition duration-200 group-hover:scale-110 group-active:scale-95">
                <AppIcon icon={n.icon} colors={n.colors} size={64} />
              </span>
              <span className="text-xs text-text/90">{n.label}</span>
            </button>
          ))}
        </div>
      </Panel>

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Spent · this month" value={money(spent)} icon="wallet" tone="danger" />
        <StatCard label="Earned · this month" value={money(earned)} icon="wallet" tone="success" />
        <StatCard label="Net · this month" value={money(net)} icon="activity" tone={net >= 0 ? 'success' : 'danger'} />
        <StatCard label="Workouts · 7 days" value={workoutsThisWeek} icon="flame" tone="accent" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel className="p-5">
          <SectionHeader title="Spending by category" subtitle="This month" />
          <SpendingPie data={spendingByCategory(month)} />
        </Panel>
        <Panel className="p-5">
          <SectionHeader title="Income vs expense" subtitle="Last 6 months" />
          <IncomeExpenseLine data={incomeExpenseByMonth(txns, 6)} />
        </Panel>
      </div>

      {/* Goals + upcoming */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel className="p-5">
          <SectionHeader
            title="Goals"
            action={
              <button className="text-xs text-accent hover:underline" onClick={() => onNavigate('goals')}>
                View all
              </button>
            }
          />
          {activeGoals.length === 0 ? (
            <EmptyState icon="target" text="No active goals" />
          ) : (
            <ul className="space-y-3">
              {activeGoals.slice(0, 4).map((g) => (
                <li key={g.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-text">{g.title}</span>
                    <span className="text-muted">{g.progress}%</span>
                  </div>
                  <ProgressBar value={g.progress} tone={g.progress >= 70 ? 'success' : 'accent'} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="p-5">
          <SectionHeader
            title="Up next"
            subtitle="Google Calendar · next 3 days"
            action={
              <button className="text-xs text-accent hover:underline" onClick={() => onNavigate('tasks')}>
                Tasks
              </button>
            }
          />
          <div className="space-y-2">
            {upcomingEvents.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-2xl bg-white/5 px-3.5 py-2.5">
                <Icon name="calendar" size={16} className="text-accent" />
                <span className="flex-1 text-sm text-text">{e.title}</span>
                <span className="text-xs text-muted">{eventWhen(e)}</span>
              </div>
            ))}
            {openTasks.slice(0, 3).map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-2xl bg-white/5 px-3.5 py-2.5">
                <Icon name="check" size={16} className="text-muted" />
                <span className="flex-1 text-sm text-text">{t.title}</span>
                {t.dueDate && <span className="text-xs text-muted">{relativeDay(t.dueDate)}</span>}
              </div>
            ))}
            {upcomingEvents.length === 0 && openTasks.length === 0 && (
              <EmptyState icon="calendar" text="Nothing scheduled" />
            )}
            {calendarNote && <p className="pt-1 text-xs text-muted">{calendarNote}</p>}
          </div>
        </Panel>
      </div>

      {/* Recent transactions */}
      <Panel className="p-5">
        <SectionHeader
          title="Recent transactions"
          action={
            <button className="text-xs text-accent hover:underline" onClick={() => onNavigate('finances')}>
              View all
            </button>
          }
        />
        <ul className="divide-y divide-border/50">
          {recent.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2.5">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full ${t.type === 'income' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
                <Icon name="wallet" size={15} />
              </span>
              <div className="flex-1">
                <div className="text-sm text-text">{t.category}</div>
                <div className="text-xs text-muted">{t.note ?? '—'} · {shortDate(t.date)}</div>
              </div>
              <span className={`font-mono text-sm ${t.type === 'income' ? 'text-success' : 'text-text'}`}>
                {t.type === 'income' ? '+' : '−'}{money(t.amount)}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
