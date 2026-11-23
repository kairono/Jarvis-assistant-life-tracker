import { db } from '../db';
import { listCalendarEvents } from '../gcal';
import { isThisMonth, money, relativeDay, shortDate } from '../format';
import { getEffectiveProfile, profileSummary } from '../profile';
import type { Transaction } from '../../types';

// ------------------------------------------------------------------ //
//  Context selector.                                                  //
//                                                                     //
//  Be mindful of context size: rather than dumping the whole DB into  //
//  every call, we always include a compact summary and then expand    //
//  ONLY the domains relevant to the question (keyword-matched).       //
// ------------------------------------------------------------------ //

type Domain = 'finance' | 'training' | 'goals' | 'tasks' | 'calendar' | 'activities';

const KEYWORDS: Record<Domain, RegExp> = {
  finance: /\b(spend|spent|spending|money|budget|cost|income|expense|save|saving|afford|cash|paid|pay|salary|rent|bill)\b/i,
  training: /\b(workout|train|training|run|running|gym|exercise|fitness|lift|cardio|yoga|cycle|cycling)\b/i,
  goals: /\b(goal|goals|target|progress|milestone|on track|achieve|aim)\b/i,
  tasks: /\b(task|tasks|todo|to-do|due|deadline|priority|chore|errand)\b/i,
  calendar: /\b(calendar|event|events|schedule|meeting|appointment|today|tomorrow|week|agenda)\b/i,
  activities: /\b(toilet|shower|bath|breakfast|lunch|dinner|meal|dog|sleep|slept|nap|activit(y|ies)|tracker|time spent|how long|minutes?)\b/i,
};

const sumExpenses = (txns: Transaction[]) =>
  txns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
const sumIncome = (txns: Transaction[]) =>
  txns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);

export async function financeSection(): Promise<string> {
  const txns = (await db.transactions.all()).sort((a, b) => b.date.localeCompare(a.date));
  const month = txns.filter((t) => isThisMonth(t.date));
  const byCat: Record<string, number> = {};
  month
    .filter((t) => t.type === 'expense')
    .forEach((t) => (byCat[t.category] = (byCat[t.category] ?? 0) + t.amount));
  const cats = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([c, v]) => `${c} ${money(v)}`)
    .join(', ');
  const recent = txns
    .slice(0, 8)
    .map((t) => `${shortDate(t.date)} ${t.type === 'expense' ? '-' : '+'}${money(t.amount)} ${t.category}${t.note ? ` (${t.note})` : ''}`)
    .join('\n');
  return [
    'FINANCES',
    `This month: income ${money(sumIncome(month))}, expenses ${money(sumExpenses(month))}, net ${money(sumIncome(month) - sumExpenses(month))}.`,
    cats ? `Spending by category this month: ${cats}.` : '',
    'Recent transactions:',
    recent || '(none)',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function trainingSection(): Promise<string> {
  const ws = (await db.workouts.all()).sort((a, b) => b.date.localeCompare(a.date));
  const last30 = ws.filter((w) => Date.now() - new Date(w.date).getTime() < 30 * 86_400_000);
  const lines = ws
    .slice(0, 6)
    .map((w) => `${shortDate(w.date)} ${w.type} ${w.duration}min intensity ${w.intensity}/5`)
    .join('\n');
  return ['TRAINING', `${last30.length} workouts in the last 30 days.`, lines || '(none)'].join('\n');
}

export async function goalsSection(): Promise<string> {
  const gs = await db.goals.all();
  const lines = gs
    .map((g) => `${g.title} — ${g.status}, ${g.progress}%${g.targetDate ? `, due ${shortDate(g.targetDate)}` : ''}`)
    .join('\n');
  return ['GOALS', lines || '(none)'].join('\n');
}

export async function tasksSection(): Promise<string> {
  const ks = (await db.tasks.all()).filter((t) => !t.done);
  const lines = ks
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
    .slice(0, 10)
    .map((t) => `[${t.priority}] ${t.title}${t.dueDate ? ` (${relativeDay(t.dueDate)})` : ''}`)
    .join('\n');
  return ['OPEN TASKS', lines || '(none)'].join('\n');
}

/** Upcoming week from Google Calendar (artifact); a pointer otherwise. */
export async function calendarSection(opts: { live?: boolean } = { live: true }): Promise<string> {
  if (!opts.live) return 'CALENDAR\nLives in Google Calendar (Jarvis reads and writes it).';
  try {
    const es = await listCalendarEvents();
    const lines = es
      .slice(0, 12)
      .map((e) => `${e.allDay ? `${relativeDay(e.start)} (all day)` : new Date(e.start).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })} ${e.title}`)
      .join('\n');
    return ['UPCOMING EVENTS (Google Calendar, next 7 days)', lines || '(none)'].join('\n');
  } catch {
    return 'UPCOMING EVENTS\n(Google Calendar not reachable here — use list_calendar_events if needed)';
  }
}

export async function activitiesSection(opts: { recent?: boolean } = { recent: true }): Promise<string> {
  const all = (await db.activities.all()).sort((a, b) => b.start.localeCompare(a.start));
  if (!all.length) return 'TIMED ACTIVITIES\n(none logged)';
  const weekAgo = Date.now() - 7 * 86_400_000;
  const monthAgo = Date.now() - 30 * 86_400_000;
  const byAct = new Map<string, { w: number; wn: number; m: number; mn: number; all: number; n: number }>();
  for (const a of all) {
    const t = new Date(a.start).getTime();
    const r = byAct.get(a.activity) ?? { w: 0, wn: 0, m: 0, mn: 0, all: 0, n: 0 };
    r.all += a.durationMin;
    r.n++;
    if (t >= weekAgo) { r.w += a.durationMin; r.wn++; }
    if (t >= monthAgo) { r.m += a.durationMin; r.mn++; }
    byAct.set(a.activity, r);
  }
  const totals = [...byAct.entries()]
    .map(([k, r]) => `${k}: last 7d ${r.w}min/${r.wn}x, last 30d ${r.m}min/${r.mn}x, all-time ${r.all}min/${r.n}x (avg ${Math.round(r.all / r.n)}min)`)
    .join('\n');
  const recent = all
    .slice(0, 12)
    .map((a) => `${new Date(a.start).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} ${a.activity} ${a.durationMin}min`)
    .join('\n');
  return ['TIMED ACTIVITIES', totals, ...(opts.recent ? ['Recent sessions:', recent] : [])].join('\n');
}

const BUILDERS: Record<Domain, () => Promise<string>> = {
  finance: financeSection,
  training: trainingSection,
  goals: goalsSection,
  tasks: tasksSection,
  calendar: calendarSection,
  activities: () => activitiesSection(),
};

/** Always-present one-line overview so the model has baseline grounding. */
export async function summary(): Promise<string> {
  const [txns, ws, gs, ks] = await Promise.all([
    db.transactions.all(),
    db.workouts.count(),
    db.goals.all(),
    db.tasks.all(),
  ]);
  const month = txns.filter((t) => isThisMonth(t.date));
  const activeGoals = gs.filter((g) => g.status === 'active').length;
  const openTasks = ks.filter((t) => !t.done).length;
  return [
    'SNAPSHOT OVERVIEW',
    `Today is ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`,
    `This month: spent ${money(sumExpenses(month))}, earned ${money(sumIncome(month))}.`,
    `${activeGoals} active goals, ${openTasks} open tasks, ${ws} workouts logged.`,
  ].join('\n');
}

/**
 * Build a compact context string for a question. Includes the overview plus
 * detailed sections for whichever domains the question touches; if nothing
 * matches, includes a light version of every domain.
 */
export async function buildContext(question: string): Promise<string> {
  const matched = (Object.keys(KEYWORDS) as Domain[]).filter((d) => KEYWORDS[d].test(question));
  const domains: Domain[] = matched.length > 0 ? matched : (Object.keys(KEYWORDS) as Domain[]);

  const head = await summary();
  const profile = profileSummary(await getEffectiveProfile());
  const sections = await Promise.all(domains.map((d) => BUILDERS[d]()));
  return [profile, head, ...sections].filter(Boolean).join('\n\n');
}
