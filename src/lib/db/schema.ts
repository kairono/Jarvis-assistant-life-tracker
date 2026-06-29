import Dexie, { type Table } from 'dexie';
import type {
  Transaction,
  Workout,
  Goal,
  VisionItem,
  Task,
  CalendarEvent,
} from '../../types';
import type { StoredProfile } from '../profile';

// Dexie database definition. Indexes are listed per table; `id` is the
// primary key everywhere, plus a few secondary indexes for common queries
// (by date / status / due date).
export class JarvisDB extends Dexie {
  transactions!: Table<Transaction, string>;
  workouts!: Table<Workout, string>;
  goals!: Table<Goal, string>;
  visionItems!: Table<VisionItem, string>;
  tasks!: Table<Task, string>;
  calendarEvents!: Table<CalendarEvent, string>;
  // Singleton row holding the user's personal profile (see lib/profile.ts).
  profile!: Table<StoredProfile, string>;

  constructor() {
    super('jarvis');
    this.version(1).stores({
      transactions: 'id, date, type, category',
      workouts: 'id, date, type',
      goals: 'id, status, category, targetDate',
      visionItems: 'id, category',
      tasks: 'id, done, priority, dueDate, project',
      calendarEvents: 'id, start, source',
    });
    // v2 adds the profile store; existing tables carry over untouched.
    this.version(2).stores({ profile: 'id' });
  }
}

export const dexie = new JarvisDB();
