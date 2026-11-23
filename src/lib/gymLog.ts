import { db } from './db';
import { parseGymLog, sessionSets, type GymSession } from './gymParse';
import type { Workout } from '../types';

// Save parsed gym sessions as workouts. One workout per date (id `gym-YYYY-MM-DD`),
// so pasting the same day again replaces it instead of duplicating it.

export const gymWorkout = (s: GymSession): Workout => ({
  id: `gym-${s.date}`,
  date: s.date,
  type: s.groups.length ? s.groups.join(' + ') : 'Gym',
  exercises: s.exercises,
  ...(s.notes.length ? { notes: s.notes.join(' · ') } : {}),
});

export async function saveGymLog(text: string): Promise<{ saved: number; replaced: number; summary: string }> {
  const sessions = parseGymLog(text);
  if (!sessions.length) {
    return { saved: 0, replaced: 0, summary: 'Failed: no dated sessions found (start each day with a line like "November 20 Fri").' };
  }
  const existing = new Set((await db.workouts.all()).map((w) => w.id));
  let replaced = 0;
  for (const s of sessions) {
    const w = gymWorkout(s);
    if (existing.has(w.id)) replaced++;
    await db.workouts.put(w);
  }
  const sets = sessions.reduce((n, s) => n + sessionSets(s.exercises), 0);
  return {
    saved: sessions.length,
    replaced,
    summary: `Logged ${sessions.length} gym session${sessions.length === 1 ? '' : 's'} (${sets} sets)${replaced ? `, ${replaced} replaced an existing day` : ''}.`,
  };
}
