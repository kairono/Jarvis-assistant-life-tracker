import type { Table } from 'dexie';
import type { DomainMap, DomainName } from '../../types';
import { PROFILE_ID, type UserProfile } from '../profile';
import type { Collection, DataStore, NewRecord } from './DataStore';
import { JarvisDB, dexie } from './schema';

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

/** Wraps a single Dexie table in the generic Collection interface and
 *  pings the parent store's subscribers after every write. */
class DexieCollection<T extends { id: string }> implements Collection<T> {
  private readonly table: Table<T, string>;
  private readonly notify: () => void;

  constructor(table: Table<T, string>, notify: () => void) {
    this.table = table;
    this.notify = notify;
  }

  all(): Promise<T[]> {
    return this.table.toArray();
  }

  get(id: string): Promise<T | undefined> {
    return this.table.get(id);
  }

  async add(record: NewRecord<T>): Promise<T> {
    const full = { ...record, id: record.id ?? uid() } as T;
    await this.table.put(full);
    this.notify();
    return full;
  }

  async put(record: T): Promise<T> {
    await this.table.put(record);
    this.notify();
    return record;
  }

  async remove(id: string): Promise<void> {
    await this.table.delete(id);
    this.notify();
  }

  async bulkAdd(records: NewRecord<T>[]): Promise<void> {
    const full = records.map((r) => ({ ...r, id: r.id ?? uid() }) as T);
    await this.table.bulkPut(full);
    this.notify();
  }

  count(): Promise<number> {
    return this.table.count();
  }
}

// ------------------------------------------------------------------ //
//  IndexedDbStore — the live DataStore implementation (Dexie).        //
// ------------------------------------------------------------------ //
export class IndexedDbStore implements DataStore {
  private readonly db: JarvisDB;
  private readonly listeners = new Set<() => void>();
  private readonly collections: { [K in DomainName]: Collection<DomainMap[K]> };

  readonly transactions: Collection<DomainMap['transactions']>;
  readonly workouts: Collection<DomainMap['workouts']>;
  readonly goals: Collection<DomainMap['goals']>;
  readonly visionItems: Collection<DomainMap['visionItems']>;
  readonly tasks: Collection<DomainMap['tasks']>;
  readonly calendarEvents: Collection<DomainMap['calendarEvents']>;
  readonly activities: Collection<DomainMap['activities']>;

  constructor(db: JarvisDB = dexie) {
    this.db = db;
    const notify = () => this.emit();
    this.transactions = new DexieCollection(db.transactions, notify);
    this.workouts = new DexieCollection(db.workouts, notify);
    this.goals = new DexieCollection(db.goals, notify);
    this.visionItems = new DexieCollection(db.visionItems, notify);
    this.tasks = new DexieCollection(db.tasks, notify);
    this.calendarEvents = new DexieCollection(db.calendarEvents, notify);
    this.activities = new DexieCollection(db.activities, notify);
    this.collections = {
      transactions: this.transactions,
      workouts: this.workouts,
      goals: this.goals,
      visionItems: this.visionItems,
      tasks: this.tasks,
      calendarEvents: this.calendarEvents,
      activities: this.activities,
    };
  }

  collection<K extends DomainName>(name: K): Collection<DomainMap[K]> {
    return this.collections[name];
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach((l) => l());
  }

  async getProfile(): Promise<UserProfile | null> {
    const row = await this.db.profile.get(PROFILE_ID);
    if (!row) return null;
    // Strip the storage-only `id` so callers get a clean UserProfile.
    const { id: _id, ...profile } = row;
    return profile;
  }

  async saveProfile(profile: UserProfile): Promise<UserProfile> {
    await this.db.profile.put({ ...profile, id: PROFILE_ID });
    this.emit();
    return profile;
  }

  async deleteProfile(): Promise<void> {
    // Store an empty tombstone (rather than clearing the row) so getProfile
    // returns a non-null, empty profile — keeping the deletion sticky.
    await this.db.profile.put({ id: PROFILE_ID, name: '' });
    this.emit();
  }

  async reset(): Promise<void> {
    await Promise.all([
      this.db.transactions.clear(),
      this.db.workouts.clear(),
      this.db.goals.clear(),
      this.db.visionItems.clear(),
      this.db.tasks.clear(),
      this.db.calendarEvents.clear(),
      this.db.activities.clear(),
      this.db.profile.clear(),
    ]);
    this.emit();
  }
}
