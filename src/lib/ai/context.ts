import { db } from '../db';
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

type Domain = 'finance' | 'training' | 'goals' | 'tasks' | 'calendar';

const KEYWORDS: Record<Domain, RegExp> = {
  finance: /\b(spend|spent|spending|money|budget|cost|income|expense|save|saving|afford|cash|paid|pay|salary|rent|bill)\b/i,
  training: /\b(workout|train|training|run|running|gym|exercise|fitness|lift|cardio|yoga|cycle|cycling)\b/i,
  goals: /\b(goal|goals|target|progress|milestone|on track|achieve|aim)\b/i,
  tasks: /\b(task|tasks|todo|to-do|due|deadline|priority|chore|errand)\b/i,
  calendar: /\b(calendar|event|events|schedule|meeting|appointment|today|tomorrow|week|agenda)\b/i,
};

const sumExpenses = (txns: Transaction[]) =>
  txns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
const sumIncome = (txns: Transaction[]) =>
  txns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);

async function financeSection(): Promise<string> {
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

async function trainingSection(): Promise<string> {
  const ws = (await db.workouts.all()).sort((a, b) => b.date.localeCompare(a.date));
  const last30 = ws.filter((w) => Date.now() - new Date(w.date).getTime() < 30 * 86_400_000);
  const lines = ws
    .slice(0, 6)
    .map((w) => `${shortDate(w.date)} ${w.type} ${w.duration}min intensity ${w.intensity}/5`)
    .join('\n');
  return ['TRAINING', `${last30.length} workouts in the last 30 days.`, lines || '(none)'].join('\n');
}

async function goalsSection(): Promise<string> {
  const gs = await db.goals.all();
  const lines = gs
    .map((g) => `${g.title} — ${g.status}, ${g.progress}%${g.targetDate ? `, due ${shortDate(g.targetDate)}` : ''}`)
    .join('\n');
  return ['GOALS', lines || '(none)'].join('\n');
}

async function tasksSection(): Promise<string> {
  const ks = (await db.tasks.all()).filter((t) => !t.done);
  const lines = ks
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
    .slice(0, 10)
    .map((t) => `[${t.priority}] ${t.title}${t.dueDate ? ` (${relativeDay(t.dueDate)})` : ''}`)
    .join('\n');
  return ['OPEN TASKS', lines || '(none)'].join('\n');
}

async function calendarSection(): Promise<string> {
  const es = (await db.calendarEvents.all())
    .filter((e) => new Date(e.end).getTime() >= Date.now())
    .sort((a, b) => a.start.localeCompare(b.start));
  const lines = es
    .slice(0, 8)
    .map((e) => `${relativeDay(e.start)} ${e.title}`)
    .join('\n');
  return ['UPCOMING EVENTS', lines || '(none)'].join('\n');
}

const BUILDERS: Record<Domain, () => Promise<string>> = {
  finance: financeSection,
  training: trainingSection,
  goals: goalsSection,
  tasks: tasksSection,
  calendar: calendarSection,
};

/** Always-present one-line overview so the model has baseline grounding. */
async function summary(): Promise<string> {
  const [txns, ws, gs, ks, es] = await Promise.all([
    db.transactions.all(),
    db.workouts.count(),
    db.goals.all(),
    db.tasks.all(),
    db.calendarEvents.count(),
  ]);
  const month = txns.filter((t) => isThisMonth(t.date));
  const activeGoals = gs.filter((g) => g.status === 'active').length;
  const openTasks = ks.filter((t) => !t.done).length;
  return [
    'SNAPSHOT OVERVIEW',
    `Today is ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`,
    `This month: spent ${money(sumExpenses(month))}, earned ${money(sumIncome(month))}.`,
    `${activeGoals} active goals, ${openTasks} open tasks, ${ws} workouts logged, ${es} calendar events.`,
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
