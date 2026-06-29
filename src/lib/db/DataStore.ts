import type { DomainMap, DomainName } from '../../types';
import type { UserProfile } from '../profile';

// ------------------------------------------------------------------ //
//  Storage abstraction.                                               //
//                                                                     //
//  The UI only ever talks to this interface, never to Dexie/Supabase  //
//  directly. Swapping IndexedDbStore for a future SupabaseStore is    //
//  then a one-line change in lib/db/index.ts with zero UI churn.      //
// ------------------------------------------------------------------ //

/** Anything we can supply on create: full record minus the id (we mint it),
 *  or with an id if the caller wants to control it. */
export type NewRecord<T extends { id: string }> = Omit<T, 'id'> & { id?: string };

/** Generic CRUD surface for one domain (table). */
export interface Collection<T extends { id: string }> {
  all(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  add(record: NewRecord<T>): Promise<T>;
  put(record: T): Promise<T>;
  remove(id: string): Promise<void>;
  bulkAdd(records: NewRecord<T>[]): Promise<void>;
  count(): Promise<number>;
}

export interface DataStore {
  readonly transactions: Collection<DomainMap['transactions']>;
  readonly workouts: Collection<DomainMap['workouts']>;
  readonly goals: Collection<DomainMap['goals']>;
  readonly visionItems: Collection<DomainMap['visionItems']>;
  readonly tasks: Collection<DomainMap['tasks']>;
  readonly calendarEvents: Collection<DomainMap['calendarEvents']>;

  /** Strongly-typed accessor by domain name. */
  collection<K extends DomainName>(name: K): Collection<DomainMap[K]>;

  /**
   * Subscribe to any write (add/put/remove/bulkAdd) across all domains.
   * Returns an unsubscribe function. The UI uses this for live refresh
   * without coupling to a specific backend's reactive query system.
   */
  subscribe(listener: () => void): () => void;

  /** The locally-saved user profile, or null if none has been saved yet. */
  getProfile(): Promise<UserProfile | null>;

  /** Save (overwrite) the locally-stored user profile. Notifies subscribers. */
  saveProfile(profile: UserProfile): Promise<UserProfile>;

  /**
   * Delete the user's personal data, leaving an empty "tombstone" so it stays
   * deleted and is NOT re-seeded from the env baseline on reload.
   */
  deleteProfile(): Promise<void>;

  /** Insert sample data on first run (no-op if the store already has data). */
  seedIfEmpty(): Promise<void>;

  /** Wipe everything (used by the "reset data" action in Settings). */
  reset(): Promise<void>;
}
