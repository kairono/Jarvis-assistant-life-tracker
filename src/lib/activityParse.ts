// ------------------------------------------------------------------ //
//  Activity log parser (pure — no storage imports, easy to test).     //
//                                                                     //
//  Turns a pasted log like                                            //
//      Time in Toilet                                                 //
//      23.11.26 - 30min (4:25PM)                                      //
//      18.11.26 - 55min (4:50PM) and 45min (10:25PM)                  //
//      15.10.26 - 30min (12:20PM), 25min (4:40PM)                     //
//  into timed sessions. Dates are DD.MM.YY in local time; a heading   //
//  line ("Time in X", "X:", or just "X") sets the activity for the    //
//  lines below it, so one paste can hold several activities.          //
//  The year may be left off (current year). A month-name heading      //
//  ("November") is a hint, not an activity: "11.02" under it reads as //
//  Nov 2, so MM.DD logs work too.                                      //
// ------------------------------------------------------------------ //

export interface ParsedSession {
  activity: string;
  start: string; // ISO
  durationMin: number;
  key: string; // dedupe key
}
export interface ParseResult {
  sessions: ParsedSession[];
  errors: string[]; // lines we could not read
}

const DATE_LINE = /^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\s*[-–—:]?\s*(.+)$/;
const MONTHS = 'january february march april may june july august september october november december'.split(' ');
/** "November", "nov:", "Nov 2026" → 11 (1-based), else 0. */
function monthHeading(line: string): number {
  const m = /^([a-z]+)\.?(?:\s+\d{4})?\s*:?$/i.exec(line);
  if (!m || m[1].length < 3) return 0;
  const w = m[1].toLowerCase();
  return MONTHS.findIndex((name) => name.startsWith(w)) + 1;
}
// "30min (4:25PM)", "1h 5min (12:20 PM)", "45 m (10:25pm)"
const SESSION = /(?:(\d+)\s*h(?:ours?|rs?)?\s*)?(?:(\d+)\s*m(?:in(?:utes?|s)?)?)?\s*\(\s*(\d{1,2})(?:[:.](\d{2}))?\s*([ap])\.?m\.?\s*\)/i;

/** Title-case and normalise an activity name ("time in toilet" → "Toilet"). */
export function normalizeActivity(raw: string): string {
  const name = raw
    .replace(/^\s*(?:time\s+(?:in|at|for|on)\s+|time\s*[-:]\s*)/i, '')
    .replace(/[:\-–—]+\s*$/, '')
    .trim();
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
}

export const sessionKey = (activity: string, startIso: string) =>
  `${activity.trim().toLowerCase()}|${startIso.slice(0, 16)}`;

export function parseActivityLog(text: string, fallbackActivity = ''): ParseResult {
  const sessions: ParsedSession[] = [];
  const errors: string[] = [];
  let activity = normalizeActivity(fallbackActivity);
  let monthHint = 0;
  const now = new Date();

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const m = DATE_LINE.exec(line);
    if (!m) {
      const mh = monthHeading(line);
      if (mh) {
        monthHint = mh;
        continue;
      }
      // A line without a leading date is a heading naming the activity.
      if (!/\d+\s*min/i.test(line)) activity = normalizeActivity(line) || activity;
      else errors.push(line);
      continue;
    }
    if (!activity) {
      errors.push(`${line}  ← no activity heading above this line`);
      continue;
    }

    const [, a, b, yy, rest] = m;
    // DD.MM by default; MM.DD when a month heading says the first number is the month.
    let dd = a;
    let mm = b;
    if (monthHint && Number(a) === monthHint && Number(b) !== monthHint) [dd, mm] = [b, a];
    let year = yy ? (yy.length === 2 ? 2000 + Number(yy) : Number(yy)) : now.getFullYear();
    // No year given and the date would be in the future → it was last year.
    if (!yy && new Date(year, Number(mm) - 1, Number(dd)) > now) year--;
    const parts = rest.split(/\s*(?:,|;|\band\b|&|\+)\s*/i).filter(Boolean);
    let any = false;
    for (const part of parts) {
      const s = SESSION.exec(part);
      if (!s) {
        errors.push(`${line}  ← could not read "${part}"`);
        continue;
      }
      const [, h, mins, hh, mi, ap] = s;
      const durationMin = Number(h ?? 0) * 60 + Number(mins ?? 0);
      let hour = Number(hh) % 12;
      if (ap.toLowerCase() === 'p') hour += 12;
      const start = new Date(year, Number(mm) - 1, Number(dd), hour, Number(mi ?? 0));
      if (!durationMin || Number.isNaN(start.getTime())) {
        errors.push(`${line}  ← missing duration or bad date`);
        continue;
      }
      any = true;
      const iso = start.toISOString();
      sessions.push({ activity, start: iso, durationMin, key: sessionKey(activity, iso) });
    }
    if (!any && parts.length === 0) errors.push(line);
  }
  return { sessions, errors };
}
