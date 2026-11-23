// ------------------------------------------------------------------ //
//  Domain model. Every record carries a string `id` (uuid).           //
//  Dates are ISO strings so they serialise cleanly to IndexedDB and   //
//  later to Supabase without timezone surprises.                      //
// ------------------------------------------------------------------ //

export type ID = string;

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: ID;
  date: string; // ISO date (YYYY-MM-DD)
  amount: number; // in tenge (KZT); `type` gives the direction. Negative only for a refund on an expense
  type: TransactionType;
  category: string;
  note?: string;
  /** Paid in another currency: the original amount and the KZT rate used. */
  currency?: 'USD';
  originalAmount?: number;
  rate?: number;
  /** True when `rate` is an assumed rate, not one the user gave. */
  rateEstimated?: boolean;
}

export interface WorkoutSet {
  kg: number; // 0 = bodyweight
  reps: number;
  /** Second half of a drop set (written "34x8/28x8"). */
  drop?: boolean;
}

export interface Exercise {
  group?: string; // muscle group, e.g. "Chest"
  name: string;
  sets: WorkoutSet[];
  note?: string;
}

export interface Workout {
  id: ID;
  date: string; // ISO date
  type: string; // e.g. "Chest + Biceps", "Run", "Yoga"
  duration?: number; // minutes, when known
  intensity?: 1 | 2 | 3 | 4 | 5;
  notes?: string;
  metrics?: Record<string, number>; // e.g. { weightKg: 80, reps: 40, distanceKm: 5 }
  /** Gym sessions: every exercise with its sets. */
  exercises?: Exercise[];
}

export type GoalStatus = 'active' | 'paused' | 'done';

export interface Milestone {
  id: ID;
  title: string;
  done: boolean;
}

export interface Goal {
  id: ID;
  title: string;
  description?: string;
  category: string;
  targetDate?: string; // ISO date
  status: GoalStatus;
  progress: number; // 0–100
  milestones: Milestone[];
}

export interface VisionItem {
  id: ID;
  title: string;
  imageUrl?: string; // remote URL or data URL
  caption?: string;
  category?: string;
  position: { x: number; y: number }; // board coordinates
}

export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: ID;
  title: string;
  priority: TaskPriority;
  dueDate?: string; // ISO date
  project?: string;
  notes?: string;
  done: boolean;
}

export interface CalendarEvent {
  id: ID;
  title: string;
  start: string; // ISO datetime
  end: string; // ISO datetime
  description?: string;
  source: 'google' | 'local';
}

/** One timed session of a daily activity (toilet, shower, breakfast…). */
export interface ActivitySession {
  id: ID;
  activity: string; // e.g. "Toilet"
  start: string; // ISO datetime
  durationMin: number;
  gcalEventId?: string; // set once pushed to Google Calendar
  note?: string;
}

// Maps a domain name to its record type — the backbone of the generic store.
export interface DomainMap {
  transactions: Transaction;
  workouts: Workout;
  goals: Goal;
  visionItems: VisionItem;
  tasks: Task;
  calendarEvents: CalendarEvent;
  activities: ActivitySession;
}

export type DomainName = keyof DomainMap;
