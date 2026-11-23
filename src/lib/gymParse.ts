// ------------------------------------------------------------------ //
//  Gym log parser (pure — no storage imports, easy to test).          //
//                                                                     //
//  Reads the user's notes format:                                     //
//      November 20 Fri                                                //
//      Legs                          ← muscle-group heading           //
//      Leg press machine 160x15, 200x15, 240x15                       //
//      Shrugs 34x10, 34x8/28x8       ← "/" = drop set                 //
//      Pull ups 0x10, 10x5/0x5       ← 0 kg = bodyweight              //
//      Biceps (as before)            ← heading with a note            //
//  Sets are WEIGHTxREPS; "12,5x10" is 12.5 kg. A line holding only    //
//  sets continues the previous exercise.                              //
// ------------------------------------------------------------------ //

import type { Exercise, WorkoutSet } from '../types';
export type { Exercise, WorkoutSet };

export interface GymSession {
  date: string; // YYYY-MM-DD
  groups: string[];
  exercises: Exercise[];
  notes: string[];
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const GROUPS = ['chest', 'back', 'biceps', 'triceps', 'legs', 'shoulders', 'forearms', 'calves', 'neck', 'abs', 'core', 'cardio', 'glutes'];

const DATE_LINE = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:\s+[A-Za-z]{2,9})?\s*$/;
// weight x reps; a comma decimal only when it sits right before the "x" (12,5x10)
const SET = /(\d+(?:[.,]\d{1,2}(?=\s*[x×]))?)\s*[x×]\s*(\d+)/gi;
const PAREN = /\(([^)]*)\)/g;

const num = (s: string) => Number(s.replace(',', '.'));

/** Stable key so "Side biceps curls" and "Side biceps curl" group together. */
export function exerciseKey(name: string): string {
  return name
    .toLowerCase()
    .replace(PAREN, '')
    .replace(/\bno weight\b/g, '')
    .replace(/\bbicep\b/g, 'biceps')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/s$/, '');
}

function parseSets(text: string): WorkoutSet[] {
  const sets: WorkoutSet[] = [];
  let prevEnd = -1;
  for (const m of text.matchAll(SET)) {
    const between = prevEnd >= 0 ? text.slice(prevEnd, m.index) : '';
    sets.push({ kg: num(m[1]), reps: Number(m[2]), ...(between.includes('/') ? { drop: true } : {}) });
    prevEnd = m.index! + m[0].length;
  }
  return sets;
}

function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function parseGymLog(text: string, defaultYear = new Date().getFullYear()): GymSession[] {
  const sessions: GymSession[] = [];
  let year = defaultYear;
  let cur: GymSession | null = null;
  let group: string | undefined;
  let last: Exercise | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    // "🏋🏻‍♂️Gym 2026" → sets the year
    const yearOnly = /\b(20\d\d)\b/.exec(line);
    if (yearOnly && !SET.test(line)) {
      SET.lastIndex = 0;
      year = Number(yearOnly[1]);
      continue;
    }
    SET.lastIndex = 0;

    const d = DATE_LINE.exec(line);
    const mi = d ? MONTHS.indexOf(d[1].slice(0, 3).toLowerCase()) : -1;
    if (d && mi >= 0) {
      cur = { date: `${year}-${String(mi + 1).padStart(2, '0')}-${d[2].padStart(2, '0')}`, groups: [], exercises: [], notes: [] };
      sessions.push(cur);
      group = undefined;
      last = null;
      continue;
    }
    if (!cur) continue;

    SET.lastIndex = 0;
    const first = SET.exec(line);
    SET.lastIndex = 0;
    const word = line.replace(PAREN, '').trim().toLowerCase();
    const parens = [...line.matchAll(PAREN)].map((m) => m[1].trim()).filter(Boolean);

    if (!first) {
      if (GROUPS.includes(word)) {
        group = titleCase(word);
        if (!cur.groups.includes(group)) cur.groups.push(group);
        if (parens.length) cur.notes.push(`${group}: ${parens.join('; ')}`);
      } else if (parens.some((p) => /before/i.test(p))) {
        last = { group, name: line.replace(PAREN, '').trim(), sets: [], note: parens.join('; ') };
        cur.exercises.push(last);
      } else {
        cur.notes.push(line);
      }
      continue;
    }

    const before = line.slice(0, first.index).replace(PAREN, '').trim();
    const sets = parseSets(line.slice(first.index));
    if (!before && last) {
      last.sets.push(...sets); // continuation line
      continue;
    }
    let name = before.replace(/[-:]+$/, '').trim();
    // A bare group word with sets ("Calves 120x20") is both group and exercise.
    if (GROUPS.includes(name.toLowerCase())) {
      group = titleCase(name.toLowerCase());
      if (!cur.groups.includes(group)) cur.groups.push(group);
    }
    if (name.length <= 4 && group && name.toLowerCase() !== group.toLowerCase()) name = `${group} ${name}`;
    last = { group, name: titleCase(name), sets, ...(parens.length ? { note: parens.join('; ') } : {}) };
    cur.exercises.push(last);
  }
  return fillGroups(sessions);
}

// Exercises logged before any heading ("Leg press …" straight under the date)
// get their group from the same exercise elsewhere in the log, else by keyword.
const GROUP_HINTS: Array<[RegExp, string]> = [
  [/leg|adductor|abductor|squat|calf|calves|lunge/i, 'Legs'],
  [/bench|fly|pec|chest|hammer|crossover|svend|pullover|push ?up|dip/i, 'Chest'],
  [/pull ?up|row|pulldown|back pull|reverse fly|deadlift|lat/i, 'Back'],
  [/shoulder|delt|raise|shrug|upright|swing/i, 'Shoulders'],
  [/triceps|push ?down|skull/i, 'Triceps'],
  [/biceps|curl/i, 'Biceps'],
];

function fillGroups(sessions: GymSession[]): GymSession[] {
  const known = new Map<string, string>();
  for (const s of sessions) for (const e of s.exercises) if (e.group) known.set(exerciseKey(e.name), e.group);
  for (const s of sessions) {
    const found: string[] = [];
    for (const e of s.exercises) {
      if (!e.group) e.group = known.get(exerciseKey(e.name)) ?? GROUP_HINTS.find(([r]) => r.test(e.name))?.[1];
      if (e.group && !found.includes(e.group)) found.push(e.group);
    }
    // Groups in the order they were trained; a bare heading with no exercises
    // ("Forearms") or only a note ("Biceps (as before)") stays as a note.
    for (const g of s.groups) {
      if (!found.includes(g) && !s.notes.some((n) => n.startsWith(`${g}:`))) s.notes.push(`${g} (no details)`);
    }
    const noted = s.groups.filter((g) => !found.includes(g) && s.notes.some((n) => n.startsWith(`${g}:`)));
    s.groups = [...found, ...noted];
  }
  return sessions;
}

/** Total weight moved: sum of kg × reps over all sets. */
export const sessionVolume = (exs: Exercise[]) =>
  exs.reduce((v, e) => v + e.sets.reduce((s, x) => s + x.kg * x.reps, 0), 0);
export const sessionSets = (exs: Exercise[]) => exs.reduce((n, e) => n + e.sets.length, 0);
