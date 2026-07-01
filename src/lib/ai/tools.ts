import { db } from '../db';
import type { TaskPriority, TransactionType } from '../../types';

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
    name: 'add_calendar_event',
    description: 'Add a calendar event.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        start: { type: 'string', description: 'ISO datetime, e.g. 2026-07-02T09:00.' },
        end: { type: 'string', description: 'ISO datetime. Defaults to 1 hour after start.' },
        description: { type: 'string' },
      },
      required: ['title', 'start'],
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

    case 'add_calendar_event': {
      const title = s(args.title);
      const start = s(args.start);
      if (!title || !start) return 'Failed: event needs a title and start time.';
      const end = s(args.end) || new Date(new Date(start).getTime() + 3_600_000).toISOString();
      await db.calendarEvents.add({ title, start, end, description: s(args.description) || undefined, source: 'local' });
      return `Added event "${title}".`;
    }

    default:
      return `Unknown tool: ${name}.`;
  }
}
