import { db } from './db';
import { getEffectiveProfile, isAnonymousProfile, type UserProfile } from './profile';
import type { DomainMap, DomainName } from '../types';

// ------------------------------------------------------------------ //
//  Data export — a one-click backup of everything Jarvis holds.       //
//                                                                     //
//  Bundles the profile plus every domain collection into a single     //
//  JSON file the user can download (e.g. before deleting their data). //
// ------------------------------------------------------------------ //

const DOMAINS: DomainName[] = [
  'transactions',
  'workouts',
  'goals',
  'visionItems',
  'tasks',
  'calendarEvents',
];

export interface JarvisExport {
  app: 'jarvis';
  schemaVersion: number;
  exportedAt: string; // ISO timestamp
  profile: UserProfile | null;
  data: { [K in DomainName]: DomainMap[K][] };
}

/** Gather the profile and all collections into a single serialisable object. */
export async function buildExport(): Promise<JarvisExport> {
  const entries = await Promise.all(
    DOMAINS.map(async (d) => [d, await db.collection(d).all()] as const),
  );
  const data = Object.fromEntries(entries) as JarvisExport['data'];

  const profile = await getEffectiveProfile();
  return {
    app: 'jarvis',
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    profile: isAnonymousProfile(profile) ? null : profile,
    data,
  };
}

/** Build the export and trigger a browser download of the JSON file. */
export async function downloadExport(): Promise<void> {
  const payload = await buildExport();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jarvis-export-${payload.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
