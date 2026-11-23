import type { Transaction, Workout } from '../types';
import { exerciseKey, sessionSets, sessionVolume } from './gymParse';

// Pure aggregation helpers shared by the dashboard and domain pages.

export interface NameValue {
  name: string;
  value: number;
}

/** Expense totals grouped by category, largest first. */
export function spendingByCategory(txns: Transaction[]): NameValue[] {
  const map = new Map<string, number>();
  for (const t of txns) {
    if (t.type !== 'expense') continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' });
};

/** Income vs expense per month for the last `months` months (oldest first). */
export function incomeExpenseByMonth(
  txns: Transaction[],
  months = 6,
): { month: string; income: number; expense: number; net: number }[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const rows = keys.map((k) => ({ key: k, month: monthLabel(k), income: 0, expense: 0, net: 0 }));
  const byKey = new Map(rows.map((r) => [r.key, r]));
  for (const t of txns) {
    const k = t.date.slice(0, 7);
    const row = byKey.get(k);
    if (!row) continue;
    if (t.type === 'income') row.income += t.amount;
    else row.expense += t.amount;
  }
  rows.forEach((r) => (r.net = r.income - r.expense));
  return rows.map(({ month, income, expense, net }) => ({ month, income, expense, net }));
}

/** Sessions, sets, volume and minutes per week for the last `weeks` weeks (oldest first). */
export function workoutsByWeek(
  workouts: Workout[],
  weeks = 8,
): { week: string; count: number; minutes: number; sets: number; volume: number }[] {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - (weeks - 1) * 7);
  start.setHours(0, 0, 0, 0);

  const buckets = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 7);
    return { week: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), count: 0, minutes: 0, sets: 0, volume: 0 };
  });

  for (const w of workouts) {
    const t = new Date(`${w.date}T00:00:00`).getTime();
    const idx = Math.floor((t - start.getTime()) / (7 * 86_400_000));
    if (idx >= 0 && idx < weeks) {
      buckets[idx].count += 1;
      buckets[idx].minutes += w.duration ?? 0;
      buckets[idx].sets += sessionSets(w.exercises ?? []);
      buckets[idx].volume += sessionVolume(w.exercises ?? []);
    }
  }
  return buckets;
}

export interface ExerciseHistory {
  key: string;
  name: string; // latest spelling
  group?: string;
  sessions: { date: string; topKg: number; topReps: number; volume: number }[]; // oldest first
  best: { kg: number; reps: number; date: string };
}

/** Per-exercise history across gym sessions: the top set of each session. */
export function exerciseHistory(workouts: Workout[]): ExerciseHistory[] {
  const map = new Map<string, ExerciseHistory>();
  const ordered = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
  for (const w of ordered) {
    for (const e of w.exercises ?? []) {
      const main = e.sets.filter((s) => !s.drop);
      if (!main.length) continue;
      const top = main.reduce((b, s) => (s.kg > b.kg || (s.kg === b.kg && s.reps > b.reps) ? s : b));
      const key = exerciseKey(e.name);
      const h = map.get(key) ?? { key, name: e.name, group: e.group, sessions: [], best: { kg: -1, reps: 0, date: w.date } };
      h.name = e.name;
      h.group = e.group ?? h.group;
      h.sessions.push({ date: w.date, topKg: top.kg, topReps: top.reps, volume: e.sets.reduce((v, s) => v + s.kg * s.reps, 0) });
      if (top.kg > h.best.kg || (top.kg === h.best.kg && top.reps > h.best.reps)) h.best = { kg: top.kg, reps: top.reps, date: w.date };
      map.set(key, h);
    }
  }
  return [...map.values()].sort((a, b) => b.sessions.length - a.sessions.length);
}
