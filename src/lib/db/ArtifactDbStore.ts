import type { DomainMap, DomainName } from '../../types';
import { capability, type ClaudeDb } from '../claude/runtime';
import type { UserProfile } from '../profile';
import type { Collection, DataStore, NewRecord } from './DataStore';
import { DOMAINS } from './domains';

// ------------------------------------------------------------------ //
//  ArtifactDbStore — DataStore on the claude.ai artifact database.    //
//                                                                     //
//  Each domain is a collection whose doc id == record id; the profile //
//  is the doc `profile/me`. One live snapshot per collection keeps an //
//  in-memory mirror, so reads are instant and every change (from this //
//  page OR from Claude writing rows in chat) re-renders the UI.       //
// ------------------------------------------------------------------ //

export type DbStatus = 'loading' | 'ready' | 'unavailable';

const uid = (): string => crypto.randomUUID();
/** The db rejects `undefined`; a JSON round-trip drops those keys. */
const clean = (v: object): Record<string, unknown> => JSON.parse(JSON.stringify(v));

const TIMEOUT_MS = 10_000;

// Retired views (Vision board, local calendar) are no longer subscribed live;
// their rows are fetched once, only if something (e.g. Export) asks for them.
const LIVE: DomainName[] = DOMAINS.filter((d) => d !== 'visionItems' && d !== 'calendarEvents');

class ArtifactCollection<T extends { id: string }> implements Collection<T> {
  rows = new Map<string, T>();
  private readonly name: string;
  private readonly store: ArtifactDbStore;
  /** Resolves when THIS collection's first snapshot (or fetch) lands. */
  private loaded: Promise<void>;
  private markLoaded!: () => void;
  private started = false;

  constructor(name: string, store: ArtifactDbStore) {
    this.name = name;
    this.store = store;
    this.loaded = new Promise((r) => (this.markLoaded = r));
  }

  /** Begin loading: a live snapshot, or a one-off fetch for retired domains. */
  start(db: ClaudeDb, live: boolean): void {
    if (this.started) return;
    this.started = true;
    const settle = () => this.markLoaded();
    setTimeout(settle, TIMEOUT_MS); // never block a page forever
    const fill = (snap: { docs: { id: string; data(): unknown }[] }) => {
      this.rows = new Map(snap.docs.map((d) => [d.id, { ...((d.data() as object) ?? {}), id: d.id } as T]));
      settle();
      this.store.emit();
    };
    if (live) db.collection(this.name).onSnapshot(fill, settle);
    else db.collection(this.name).get().then(fill, settle);
  }

  private async whenLoaded(): Promise<void> {
    const db = await this.store.ready();
    if (db) this.start(db, false);
    await this.loaded;
  }

  private async ref() {
    const db = await this.store.ready();
    if (!db) throw new Error('Jarvis storage is unavailable (sign in to claude.ai to load your data).');
    return db.collection(this.name);
  }

  async all(): Promise<T[]> {
    await this.whenLoaded();
    return [...this.rows.values()];
  }
  async get(id: string): Promise<T | undefined> {
    await this.whenLoaded();
    return this.rows.get(id);
  }
  async add(record: NewRecord<T>): Promise<T> {
    const full = { ...record, id: record.id ?? uid() } as T;
    return this.put(full);
  }
  async put(record: T): Promise<T> {
    // Optimistic mirror update so the UI reflects the write immediately.
    this.rows.set(record.id, record);
    this.store.emit();
    await (await this.ref()).doc(record.id).set(clean(record));
    return record;
  }
  async remove(id: string): Promise<void> {
    this.rows.delete(id);
    this.store.emit();
    await (await this.ref()).doc(id).delete();
  }
  async bulkAdd(records: NewRecord<T>[]): Promise<void> {
    // One write at a time per doc; sequential keeps us under rate limits.
    for (const r of records) await this.add(r);
  }
  async count(): Promise<number> {
    await this.whenLoaded();
    return this.rows.size;
  }
}

export class ArtifactDbStore implements DataStore {
  private readonly listeners = new Set<() => void>();
  private readonly statusListeners = new Set<(s: DbStatus) => void>();
  private readonly collections: { [K in DomainName]: ArtifactCollection<DomainMap[K]> };
  private profile: UserProfile | null = null;
  private readyPromise: Promise<ClaudeDb | null> | null = null;
  status: DbStatus = 'loading';

  readonly transactions: Collection<DomainMap['transactions']>;
  readonly workouts: Collection<DomainMap['workouts']>;
  readonly goals: Collection<DomainMap['goals']>;
  readonly visionItems: Collection<DomainMap['visionItems']>;
  readonly tasks: Collection<DomainMap['tasks']>;
  readonly calendarEvents: Collection<DomainMap['calendarEvents']>;
  readonly activities: Collection<DomainMap['activities']>;

  constructor() {
    this.profileLoaded = new Promise((r) => (this.markProfile = r));
    const make = <K extends DomainName>(k: K) => new ArtifactCollection<DomainMap[K]>(k, this);
    this.collections = Object.fromEntries(DOMAINS.map((d) => [d, make(d)])) as typeof this.collections;
    this.transactions = this.collections.transactions;
    this.workouts = this.collections.workouts;
    this.goals = this.collections.goals;
    this.visionItems = this.collections.visionItems;
    this.tasks = this.collections.tasks;
    this.calendarEvents = this.collections.calendarEvents;
    this.activities = this.collections.activities;
  }

  /**
   * Connect once. Resolves as soon as the db namespace is available; each
   * collection then loads on its own, so a page waits only for its own data.
   */
  ready(): Promise<ClaudeDb | null> {
    if (!this.readyPromise) this.readyPromise = this.connect();
    return this.readyPromise;
  }

  private async connect(): Promise<ClaudeDb | null> {
    const db = await capability('db');
    if (!db) {
      this.setStatus('unavailable');
      return null;
    }
    for (const name of LIVE) (this.collections[name] as ArtifactCollection<{ id: string }>).start(db, true);
    let profileSeen = false;
    db.doc('profile/me').onSnapshot(
      (snap) => {
        profileSeen = true;
        this.profile = snap.exists ? ((snap.data() ?? null) as UserProfile | null) : null;
        this.markProfile();
        this.emit();
      },
      () => this.markProfile(),
    );
    setTimeout(() => this.markProfile(), TIMEOUT_MS);
    // "ready" once every live collection has answered (or timed out); only
    // flag storage as unavailable if nothing at all came back.
    void Promise.all(LIVE.map((n) => this.collections[n].count())).then(() => {
      const any = profileSeen || LIVE.some((n) => (this.collections[n] as ArtifactCollection<{ id: string }>).rows.size > 0);
      this.setStatus(any || this.answered ? 'ready' : 'unavailable');
    });
    return db;
  }

  /** Set when any snapshot arrives, even an empty one. */
  answered = false;
  private profileLoaded: Promise<void>;
  private markProfile: () => void = () => {};

  private setStatus(s: DbStatus) {
    this.status = s;
    this.statusListeners.forEach((l) => l(s));
    this.emit();
  }

  onStatus(l: (s: DbStatus) => void): () => void {
    this.statusListeners.add(l);
    return () => this.statusListeners.delete(l);
  }

  collection<K extends DomainName>(name: K): Collection<DomainMap[K]> {
    return this.collections[name];
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    void this.ready();
    return () => this.listeners.delete(listener);
  }

  private emitQueued = false;
  /** Coalesce bursts (several snapshots landing at once) into one re-render. */
  emit(): void {
    this.answered = true;
    if (this.emitQueued) return;
    this.emitQueued = true;
    setTimeout(() => {
      this.emitQueued = false;
      this.listeners.forEach((l) => l());
    }, 16);
  }

  async getProfile(): Promise<UserProfile | null> {
    if (await this.ready()) await this.profileLoaded;
    return this.profile;
  }

  async saveProfile(profile: UserProfile): Promise<UserProfile> {
    const db = await this.ready();
    this.profile = profile;
    this.emit();
    await db?.doc('profile/me').set(clean(profile));
    return profile;
  }

  async deleteProfile(): Promise<void> {
    await this.saveProfile({ name: '' });
  }

  async reset(): Promise<void> {
    for (const name of DOMAINS) {
      const col = this.collections[name];
      for (const r of await col.all()) await col.remove(r.id);
    }
    await this.deleteProfile();
  }

  /** Raw db access for docs outside the domain model (e.g. memory). */
  async raw(): Promise<ClaudeDb | null> {
    return this.ready();
  }
}
