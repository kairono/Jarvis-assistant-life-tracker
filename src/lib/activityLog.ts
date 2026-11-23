import { db } from './db';
import type { ActivitySession } from '../types';
import { sessionKey, type ParsedSession } from './activityParse';

export * from './activityParse';

// Saving + presentation helpers for activity sessions (parser: activityParse.ts).

/** Save parsed sessions, skipping any already stored (same activity + start minute). */
export async function saveSessions(
  sessions: Array<Pick<ParsedSession, 'activity' | 'start' | 'durationMin'>>,
): Promise<{ added: ActivitySession[]; duplicates: number }> {
  const existing = new Set((await db.activities.all()).map((a) => sessionKey(a.activity, a.start)));
  const added: ActivitySession[] = [];
  let duplicates = 0;
  for (const s of sessions) {
    const key = sessionKey(s.activity, s.start);
    if (existing.has(key)) {
      duplicates++;
      continue;
    }
    existing.add(key);
    added.push(await db.activities.add({ activity: s.activity, start: s.start, durationMin: s.durationMin }));
  }
  return { added, duplicates };
}

// --- Presentation helpers ------------------------------------------------ //

const EMOJI: Array<[RegExp, string]> = [
  [/toilet|wc|bathroom|poop/i, '🚽'],
  [/shower|bath/i, '🚿'],
  [/breakfast/i, '🍳'],
  [/lunch/i, '🥗'],
  [/dinner|supper/i, '🍽️'],
  [/dog|walk/i, '🐕'],
  [/sle(e|p)|nap/i, '😴'],
  [/wake|woke/i, '⏰'],
  [/gym|workout|train/i, '🏋️'],
  [/code|coding/i, '💻'],
];
export const activityEmoji = (a: string) => EMOJI.find(([r]) => r.test(a))?.[1] ?? '';

export const fmtMinutes = (m: number) => {
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return h ? `${h}h${r ? ` ${r}m` : ''}` : `${r}m`;
};
