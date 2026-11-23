import { db } from '../db';
import type { TaskPriority, TransactionType } from '../../types';
import { parseActivityLog, saveSessions } from '../activityLog';
import { createCalendarEvent, listCalendarEvents, syncSessionsToCalendar } from '../gcal';
import { appendMemoryNote } from '../memory';
import { saveGymLog } from '../gymLog';

// ------------------------------------------------------------------ //
//  Tools — the "action layer".                                        //
//                                                                     //
//  These let the assistant WRITE to the user's data (not just read).  //
//  Each tool has a provider-agnostic JSON-schema definition and a     //
//  handler that performs the DB change and returns a short summary    //
//  (shown to the user AND fed back to the model as the tool result).  //
// ------------------------------------------------------------------ //

export interface ToolProperty {
  type: 'string' | 'number' | 'integer' | 'boolean';
  description?: string;
  enum?: string[];
}
export interface ToolSchema {
  type: 'object';
  properties: Record<string, ToolProperty>;
  required?: string[];
}
export interface ToolDef {
  name: string;
  description: string;
  parameters: ToolSchema;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const s = (v: unknown): string => String(v ?? '').trim();
const n = (v: unknown): number => Number(v);

export const TOOLS: ToolDef[] = [
  {
    name: 'add_transaction',
    description: 'Record a financial transaction (income or expense) for the user.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['income', 'expense'], description: 'Whether money came in or went out.' },
        amount: { type: 'number', description: 'Positive amount.' },
        category: { type: 'string', description: 'e.g. Food, Rent, Salary, Transport.' },
        note: { type: 'string', description: 'Optional short note.' },
        date: { type: 'string', description: 'ISO date YYYY-MM-DD. Defaults to today if omitted.' },
      },
      required: ['type', 'amount', 'category'],
    },
  },
  {
    name: 'add_task',
    description: 'Add a to-do task for the user.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        dueDate: { type: 'string', description: 'ISO date YYYY-MM-DD, optional.' },
        project: { type: 'string', description: 'Optional grouping, e.g. Health, Finance.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'complete_task',
    description: 'Mark an existing task as done, matched by (part of) its title.',
    parameters: {
      type: 'object',
      properties: { title: { type: 'string' } },
      required: ['title'],
    },
  },
  {
    name: 'delete_task',
    description: 'Delete an existing task, matched by (part of) its title.',
    parameters: {
      type: 'object',
      properties: { title: { type: 'string' } },
      required: ['title'],
    },
  },
  {
    name: 'add_workout',
    description: 'Log a completed workout / training session.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'e.g. Run, Strength, Yoga, Cycling.' },
        duration: { type: 'number', description: 'Minutes.' },
        intensity: { type: 'integer', description: '1 (easy) to 5 (max).' },
        date: { type: 'string', description: 'ISO date YYYY-MM-DD. Defaults to today.' },
        notes: { type: 'string' },
      },
      required: ['type', 'duration'],
    },
  },
  {
    name: 'log_gym_session',
    description:
      'Log gym sessions with exercises and sets. Pass the user\'s gym notes VERBATIM in `log`: a date line ' +
      '("November 20 Fri"), optional muscle-group headings ("Chest"), and exercise lines with WEIGHTxREPS sets ' +
      '("Leg press machine 160x15, 200x15", drop sets "34x8/28x8"). Re-logging a date replaces that day.',
    parameters: {
      type: 'object',
      properties: { log: { type: 'string', description: 'The gym notes text.' } },
      required: ['log'],
    },
  },
  {
    name: 'add_goal',
    description: 'Create a new goal for the user.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        category: { type: 'string', description: 'e.g. Fitness, Finance, Career.' },
        targetDate: { type: 'string', description: 'ISO date YYYY-MM-DD, optional.' },
        description: { type: 'string' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_goal_progress',
    description: 'Update the progress percentage of an existing goal, matched by title.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        progress: { type: 'number', description: '0 to 100.' },
      },
      required: ['title', 'progress'],
    },
  },
  {
    name: 'list_calendar_events',
    description:
      "Read events from the user's Google Calendar. Defaults to the next 7 days. Use for questions about their schedule.",
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Start, ISO date or datetime (local time). Defaults to now.' },
        to: { type: 'string', description: 'End, ISO date or datetime (local time). Defaults to 7 days after `from`.' },
        query: { type: 'string', description: 'Optional text to match in titles, e.g. "dentist".' },
      },
    },
  },
  {
    name: 'add_calendar_event',
    description: "Create an event in the user's Google Calendar.",
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        start: { type: 'string', description: 'Local datetime, e.g. 2026-07-02T09:00 (no timezone suffix).' },
        end: { type: 'string', description: 'Local datetime. Defaults to 1 hour after start.' },
        description: { type: 'string' },
      },
      required: ['title', 'start'],
    },
  },
  {
    name: 'log_activity_sessions',
    description:
      'Log timed daily-activity sessions (toilet, shower, breakfast, walking the dog…) and push them to Google Calendar. ' +
      'Pass the user\'s log text VERBATIM in `log`, e.g. "Time in Toilet\n23.11.26 - 30min (4:25PM)\n18.11.26 - 55min (4:50PM) and 45min (10:25PM)". ' +
      'Dates are DD.MM.YY. For a single spoken entry, build one line in that format (e.g. "Shower\n23.11.26 - 15min (9:10AM)").',
    parameters: {
      type: 'object',
      properties: {
        log: { type: 'string', description: 'Log text: an activity heading line, then "DD.MM.YY - <n>min (<h:mm>AM|PM)" lines.' },
        activity: { type: 'string', description: 'Activity name if the log has no heading line.' },
      },
      required: ['log'],
    },
  },
  {
    name: 'remember',
    description:
      'Save a durable fact, preference or note about the user to Jarvis memory (read by Claude in every future chat). ' +
      'Use when the user says "remember…" or shares something lasting about themselves.',
    parameters: {
      type: 'object',
      properties: { note: { type: 'string', description: 'One short, self-contained fact.' } },
      required: ['note'],
    },
  },
];

/** Run a tool by name. Returns a short human summary of what happened. */
export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'add_transaction': {
      const type = (s(args.type) === 'income' ? 'income' : 'expense') as TransactionType;
      const amount = n(args.amount);
      if (!(amount > 0)) return 'Failed: amount must be a positive number.';
      const category = s(args.category) || 'Other';
      await db.transactions.add({
        type,
        amount,
        category,
        note: s(args.note) || undefined,
        date: s(args.date) || todayISO(),
      });
      return `Logged ${type} of ${amount} for ${category}.`;
    }

    case 'add_task': {
      const title = s(args.title);
      if (!title) return 'Failed: task needs a title.';
      const priority = (['low', 'medium', 'high'].includes(s(args.priority)) ? s(args.priority) : 'medium') as TaskPriority;
      await db.tasks.add({
        title,
        priority,
        dueDate: s(args.dueDate) || undefined,
        project: s(args.project) || undefined,
        done: false,
      });
      return `Added task "${title}".`;
    }

    case 'complete_task': {
      const title = s(args.title).toLowerCase();
      const match = (await db.tasks.all()).find((t) => t.title.toLowerCase().includes(title));
      if (!match) return `No task matching "${s(args.title)}".`;
      await db.tasks.put({ ...match, done: true });
      return `Marked "${match.title}" as done.`;
    }

    case 'delete_task': {
      const title = s(args.title).toLowerCase();
      const match = (await db.tasks.all()).find((t) => t.title.toLowerCase().includes(title));
      if (!match) return `No task matching "${s(args.title)}".`;
      await db.tasks.remove(match.id);
      return `Deleted task "${match.title}".`;
    }

    case 'add_workout': {
      const type = s(args.type);
      const duration = n(args.duration);
      if (!type || !(duration > 0)) return 'Failed: workout needs a type and positive duration.';
      const rawIntensity = Math.round(n(args.intensity));
      const intensity = (Number.isFinite(rawIntensity) ? Math.min(5, Math.max(1, rawIntensity)) : 3) as 1 | 2 | 3 | 4 | 5;
      await db.workouts.add({
        type,
        duration,
        intensity,
        date: s(args.date) || todayISO(),
        notes: s(args.notes) || undefined,
      });
      return `Logged ${duration}min ${type} workout.`;
    }

    case 'log_gym_session': {
      const r = await saveGymLog(s(args.log));
      return r.summary;
    }

    case 'add_goal': {
      const title = s(args.title);
      if (!title) return 'Failed: goal needs a title.';
      await db.goals.add({
        title,
        category: s(args.category) || 'General',
        targetDate: s(args.targetDate) || undefined,
        description: s(args.description) || undefined,
        status: 'active',
        progress: 0,
        milestones: [],
      });
      return `Created goal "${title}".`;
    }

    case 'update_goal_progress': {
      const title = s(args.title).toLowerCase();
      const match = (await db.goals.all()).find((g) => g.title.toLowerCase().includes(title));
      if (!match) return `No goal matching "${s(args.title)}".`;
      const progress = Math.min(100, Math.max(0, Math.round(n(args.progress))));
      await db.goals.put({ ...match, progress, status: progress >= 100 ? 'done' : match.status });
      return `Updated "${match.title}" to ${progress}%.`;
    }

    case 'list_calendar_events': {
      const from = s(args.from) ? new Date(s(args.from)) : new Date();
      const to = s(args.to) ? new Date(s(args.to)) : new Date(from.getTime() + 7 * 86_400_000);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 'Failed: bad date range.';
      try {
        const events = await listCalendarEvents(from, to, s(args.query) || undefined);
        if (!events.length) return 'No events in that range.';
        return events
          .map((e) =>
            e.allDay
              ? `${e.start} (all day) ${e.title}`
              : `${new Date(e.start).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}–${new Date(e.end).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} ${e.title}`,
          )
          .join('\n');
      } catch (e) {
        return `Failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    case 'add_calendar_event': {
      const title = s(args.title);
      const start = s(args.start);
      if (!title || !start) return 'Failed: event needs a title and start time.';
      try {
        await createCalendarEvent({ title, start, end: s(args.end) || undefined, description: s(args.description) || undefined });
        return `Added "${title}" to Google Calendar.`;
      } catch (e) {
        return `Failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    case 'log_activity_sessions': {
      const { sessions, errors } = parseActivityLog(s(args.log), s(args.activity));
      if (!sessions.length) return `Failed: could not read any sessions.${errors.length ? ` Unreadable: ${errors.slice(0, 3).join(' | ')}` : ''}`;
      const { added, duplicates } = await saveSessions(sessions);
      const sync = added.length ? await syncSessionsToCalendar(added) : null;
      const total = added.reduce((m, a) => m + a.durationMin, 0);
      return [
        `Logged ${added.length} ${sessions[0].activity} session${added.length === 1 ? '' : 's'} (${total} min)`,
        duplicates ? `${duplicates} already logged` : '',
        errors.length ? `${errors.length} line(s) unreadable` : '',
        sync ? sync.summary : '',
      ]
        .filter(Boolean)
        .join(' · ') + '.';
    }

    case 'remember': {
      const note = s(args.note);
      if (!note) return 'Failed: nothing to remember.';
      await appendMemoryNote(note);
      return `Remembered: ${note}`;
    }

    default:
      return `Unknown tool: ${name}.`;
  }
}
