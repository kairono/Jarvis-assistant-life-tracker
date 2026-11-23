import { db } from './db';
import { capability } from './claude/runtime';
import { IS_ARTIFACT } from './runtime';
import { activityEmoji } from './activityLog';
import type { ActivitySession } from '../types';

// ------------------------------------------------------------------ //
//  Google Calendar sync — through the viewer's claude.ai "Google      //
//  Calendar" connector (the `mcp` capability). No OAuth code here:    //
//  claude.ai holds the Google sign-in.                                //
//                                                                     //
//  Tool shapes were read from the live connector (create_event /     //
//  list_events). Times go in as local wall-clock "YYYY-MM-DDTHH:mm:ss"//
//  plus an IANA timeZone; the result carries the event `id`.          //
// ------------------------------------------------------------------ //

export const GCAL_SERVER = 'Google Calendar';
export const GCAL_TOOLS = ['create_event', 'list_events'];

export interface CalendarEventDraft {
  summary: string;
  start: string; // ISO
  end: string; // ISO
  timeZone: string;
  colorId?: string;
  description?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** ISO instant → local wall-clock time without offset, as the connector wants. */
function localStamp(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

/** Connector results may arrive as an object or as JSON text. */
function asObject(res: unknown): Record<string, unknown> | undefined {
  let v: unknown = (res as { payload?: unknown } | null)?.payload ?? res;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return undefined;
    }
  }
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : undefined;
}

// Google Calendar event colorIds (1 Lavender … 11 Tomato), roughly matching
// the user's own calendar: meals and toilet orange, dog walks red. (The user
// wanted Cocoa for toilet, but the API only accepts colorIds 1–11.)
const COLORS: Array<[RegExp, string]> = [
  [/relapse/i, '8'], // Graphite
  [/toilet|wc|bathroom/i, '6'],
  [/shower|bath/i, '7'],
  [/breakfast|lunch|dinner|meal/i, '6'],
  [/dog|walk/i, '4'],
  [/sle(e|p)|nap/i, '8'],
  [/wake|woke/i, '5'],
];

export function toCalendarEvent(s: ActivitySession): CalendarEventDraft {
  const end = new Date(new Date(s.start).getTime() + s.durationMin * 60_000).toISOString();
  const emoji = activityEmoji(s.activity);
  return {
    summary: `${s.activity}${emoji ? ` ${emoji}` : ''}`,
    start: s.start,
    end,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    colorId: COLORS.find(([r]) => r.test(s.activity))?.[1],
    description: `${s.durationMin} min · logged by Jarvis`,
  };
}

export const calendarSyncAvailable = () => IS_ARTIFACT;

type Mcp = NonNullable<Awaited<ReturnType<typeof capability<'mcp'>>>>;

/** An existing event for the same activity starting within 10 min, if any. */
async function findExisting(mcp: Mcp, s: ActivitySession): Promise<string | undefined> {
  const t = new Date(s.start).getTime();
  const res = await mcp.callTool(GCAL_SERVER, 'list_events', {
    startTime: localStamp(new Date(t - 30 * 60_000).toISOString()),
    endTime: localStamp(new Date(t + 30 * 60_000).toISOString()),
    fullText: s.activity,
    pageSize: 20,
  });
  const events = (asObject(res)?.events as Array<{ id?: string; start?: { dateTime?: string } }>) ?? [];
  return events.find((e) => {
    const st = e.start?.dateTime ? new Date(e.start.dateTime).getTime() : NaN;
    return Math.abs(st - t) <= 10 * 60_000;
  })?.id;
}

/**
 * Push sessions without a gcalEventId to Google Calendar. A matching event
 * that already exists (e.g. one added by hand) is linked instead of duplicated.
 */
export async function syncSessionsToCalendar(
  sessions: ActivitySession[],
): Promise<{ synced: number; failed: number; summary: string }> {
  const pending = sessions.filter((s) => !s.gcalEventId);
  if (!pending.length) return { synced: 0, failed: 0, summary: 'Calendar already up to date' };
  if (!IS_ARTIFACT) return { synced: 0, failed: 0, summary: 'Calendar sync runs in the claude.ai artifact' };
  const mcp = await capability('mcp');
  if (!mcp) return { synced: 0, failed: pending.length, summary: 'Google Calendar access unavailable in this view' };

  let created = 0;
  let linked = 0;
  let failed = 0;
  let lastError = '';
  for (const s of pending) {
    try {
      let id = await findExisting(mcp, s).catch(() => undefined);
      if (id) {
        linked++;
      } else {
        const e = toCalendarEvent(s);
        const res = await mcp.callTool(GCAL_SERVER, 'create_event', {
          summary: e.summary,
          startTime: localStamp(e.start),
          endTime: localStamp(e.end),
          timeZone: e.timeZone,
          description: e.description,
          useDefaultReminders: false,
          ...(e.colorId ? { colorId: e.colorId } : {}),
        });
        id = (asObject(res)?.id as string | undefined) ?? 'synced';
        created++;
      }
      await db.activities.put({ ...s, gcalEventId: id });
    } catch (err) {
      failed++;
      lastError = (err as { message?: string })?.message ?? String(err);
    }
  }
  const parts = [
    created && `${created} added to Google Calendar`,
    linked && `${linked} already there (linked)`,
    failed && `${failed} failed${lastError ? ` — ${lastError}` : ''}`,
  ].filter(Boolean);
  return { synced: created + linked, failed, summary: parts.join(', ') || 'Nothing to sync' };
}

// ------------------------------------------------------------------ //
//  General calendar access for the Jarvis assistant and Dashboard:    //
//  read upcoming events and create new ones in Google Calendar.       //
// ------------------------------------------------------------------ //

export interface GcalEvent {
  id: string;
  title: string;
  start: string; // ISO (or YYYY-MM-DD for all-day)
  end: string;
  allDay: boolean;
}

/** Events between two instants (default: now → +7 days). Artifact only. */
export async function listCalendarEvents(
  from: Date = new Date(),
  to: Date = new Date(Date.now() + 7 * 86_400_000),
  query?: string,
): Promise<GcalEvent[]> {
  if (!IS_ARTIFACT) throw new Error('Google Calendar is available in the claude.ai artifact');
  const mcp = await capability('mcp');
  if (!mcp) throw new Error('Google Calendar access unavailable in this view');
  const res = await mcp.callTool(GCAL_SERVER, 'list_events', {
    startTime: localStamp(from.toISOString()),
    endTime: localStamp(to.toISOString()),
    orderBy: 'startTime',
    pageSize: 50,
    ...(query ? { fullText: query } : {}),
  });
  type Raw = { id?: string; summary?: string; status?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } };
  const events = (asObject(res)?.events as Raw[]) ?? [];
  return events
    .filter((e) => e.id && e.status !== 'cancelled')
    .map((e) => ({
      id: e.id!,
      title: e.summary || '(untitled)',
      start: e.start?.dateTime ?? e.start?.date ?? '',
      end: e.end?.dateTime ?? e.end?.date ?? '',
      allDay: !e.start?.dateTime,
    }));
}

/** Create one event. `start`/`end` are ISO instants or local "YYYY-MM-DDTHH:mm". */
export async function createCalendarEvent(e: {
  title: string;
  start: string;
  end?: string;
  description?: string;
}): Promise<string> {
  if (!IS_ARTIFACT) throw new Error('Google Calendar is available in the claude.ai artifact');
  const mcp = await capability('mcp');
  if (!mcp) throw new Error('Google Calendar access unavailable in this view');
  const start = new Date(e.start);
  if (Number.isNaN(start.getTime())) throw new Error(`Bad start time "${e.start}"`);
  const end = e.end ? new Date(e.end) : new Date(start.getTime() + 3_600_000);
  const colorId = COLORS.find(([r]) => r.test(e.title))?.[1];
  const res = await mcp.callTool(GCAL_SERVER, 'create_event', {
    summary: e.title,
    startTime: localStamp(start.toISOString()),
    endTime: localStamp(end.toISOString()),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ...(e.description ? { description: e.description } : {}),
    ...(colorId ? { colorId } : {}),
  });
  return (asObject(res)?.id as string | undefined) ?? 'created';
}
