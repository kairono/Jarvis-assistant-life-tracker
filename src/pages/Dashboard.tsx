import { JarvisCore } from '../components/JarvisCore';
import { SpendingPie } from '../components/charts/SpendingPie';
import { IncomeExpenseLine } from '../components/charts/IncomeExpenseLine';
import { Badge, EmptyState, Panel, ProgressBar, SectionHeader, StatCard } from '../components/ui';
import { Icon } from '../components/Icon';
import { useCollection } from '../hooks/useStore';
import { incomeExpenseByMonth, spendingByCategory } from '../lib/analytics';
import { isThisMonth, money, relativeDay, shortDate } from '../lib/format';
import type { ViewId } from '../nav';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 5) return 'Burning the midnight oil';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

export function Dashboard({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  const txns = useCollection('transactions');
  const goals = useCollection('goals');
  const tasks = useCollection('tasks');
  const workouts = useCollection('workouts');
  const events = useCollection('calendarEvents');

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

  const upcomingEvents = events
    .filter((e) => new Date(e.end).getTime() >= Date.now())
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 4);
  const recent = [...txns].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Panel corners className="flex flex-col items-center gap-6 overflow-hidden p-6 sm:flex-row">
        <JarvisCore size={132} className="shrink-0" />
        <div className="flex-1 text-center sm:text-left">
          <div className="label-tech">Systems online · {new Date().toLocaleDateString(undefined, { weekday: 'long' })}</div>
          <h2 className="mt-1 text-2xl text-text">
            {greeting()}. Here is your day.
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted">
            {dueToday > 0
              ? `You have ${dueToday} task${dueToday > 1 ? 's' : ''} due today`
              : 'Nothing due today'}
            {upcomingEvents[0] ? ` · next up: ${upcomingEvents[0].title} (${relativeDay(upcomingEvents[0].start)})` : ''}
            {net < 0 ? ` · spending is ahead of income this month` : ` · net positive this month`}.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <Badge tone="accent">{activeGoals.length} active goals</Badge>
            <Badge tone="success">{workoutsThisWeek} workouts this week</Badge>
            <Badge tone={openTasks.length ? 'warn' : 'muted'}>{openTasks.length} open tasks</Badge>
          </div>
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
            action={
              <button className="text-xs text-accent hover:underline" onClick={() => onNavigate('tasks')}>
                Tasks
              </button>
            }
          />
          <div className="space-y-2">
            {upcomingEvents.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-panel/40 px-3 py-2">
                <Icon name="calendar" size={16} className="text-accent" />
                <span className="flex-1 text-sm text-text">{e.title}</span>
                <span className="text-xs text-muted">{relativeDay(e.start)}</span>
              </div>
            ))}
            {openTasks.slice(0, 3).map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-panel/40 px-3 py-2">
                <Icon name="check" size={16} className="text-muted" />
                <span className="flex-1 text-sm text-text">{t.title}</span>
                {t.dueDate && <span className="text-xs text-muted">{relativeDay(t.dueDate)}</span>}
              </div>
            ))}
            {upcomingEvents.length === 0 && openTasks.length === 0 && (
              <EmptyState icon="calendar" text="Nothing scheduled" />
            )}
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
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${t.type === 'income' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
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
