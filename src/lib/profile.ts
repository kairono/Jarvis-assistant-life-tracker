// ------------------------------------------------------------------ //
//  User profile — "the person's whole data".                         //
//                                                                     //
//  This is the personal, identifying information about the single     //
//  user JARVIS serves: who they are, their health/finance context,    //
//  preferences, and emergency details.                                //
//                                                                     //
//  Source of truth (in priority order):                              //
//   1. A profile saved locally in IndexedDB (edited via Settings).    //
//   2. The VITE_USER_PROFILE env var — a single-line JSON baseline.   //
//                                                                     //
//  Neither source lives in the repo: `.env` is git-ignored and        //
//  IndexedDB is browser-local, so personal data is never pushed to    //
//  GitHub. See `.env.example` for the expected shape, and the         //
//  Settings page to view/edit it.                                     //
// ------------------------------------------------------------------ //

import { db } from './db';

export interface UserProfile {
  name: string;
  preferredName?: string;
  age?: number;
  dateOfBirth?: string; // ISO date (YYYY-MM-DD)
  email?: string;
  phone?: string;
  location?: string;
  occupation?: string;
  employer?: string;
  bio?: string;
  currency?: string; // ISO 4217 code, e.g. "USD"
  timezone?: string; // IANA tz, e.g. "Europe/Berlin"
  health?: {
    heightCm?: number;
    weightKg?: number;
    bloodType?: string;
    allergies?: string[];
    conditions?: string[];
  };
  finance?: {
    annualIncome?: number;
    monthlyBudget?: number;
    bank?: string;
  };
  preferences?: {
    interests?: string[];
    dietaryRestrictions?: string[];
  };
  emergencyContact?: {
    name?: string;
    relation?: string;
    phone?: string;
  };
}

/** How the profile is stored in IndexedDB: a singleton row keyed by id. */
export const PROFILE_ID = 'me';
export type StoredProfile = UserProfile & { id: string };

// Used when nothing is configured anywhere, so the app still runs.
const ANONYMOUS_PROFILE: UserProfile = { name: 'there' };

let envCache: UserProfile | null = null;

/**
 * Parse the baseline profile from the VITE_USER_PROFILE env var (a single-line
 * JSON string — see `.env.example`). Cached after first read. Falls back to an
 * anonymous profile (and warns) if missing or malformed, so a bad/empty `.env`
 * never crashes the app.
 */
export function envProfile(): UserProfile {
  if (envCache) return envCache;

  const raw = import.meta.env.VITE_USER_PROFILE?.trim();
  if (!raw) {
    envCache = ANONYMOUS_PROFILE;
    return envCache;
  }

  try {
    const parsed = JSON.parse(raw) as UserProfile;
    if (!parsed || typeof parsed.name !== 'string') {
      throw new Error('profile JSON must be an object with a "name" string');
    }
    envCache = parsed;
  } catch (err) {
    console.warn(
      '[profile] Could not parse VITE_USER_PROFILE — falling back to anonymous profile.',
      err,
    );
    envCache = ANONYMOUS_PROFILE;
  }
  return envCache;
}

/** A profile with no real identity set (empty/blank/the anonymous fallback). */
export function isAnonymousProfile(p: UserProfile | null | undefined): boolean {
  return !p || !p.name?.trim() || p.name === ANONYMOUS_PROFILE.name;
}

/**
 * The effective profile the app should use.
 *
 * Once the profile has been touched locally (saved OR explicitly deleted), the
 * IndexedDB copy is authoritative and we return it as-is — even when it's an
 * empty "tombstone", so a deletion stays deleted across reloads instead of
 * being resurrected from the env baseline. The env var only seeds the very
 * first run, before any local row exists.
 */
export async function getEffectiveProfile(): Promise<UserProfile> {
  const saved = await db.getProfile();
  if (saved) return saved;
  return envProfile();
}

/**
 * Compact, human-readable summary of a profile for the AI context. Only
 * includes fields that are actually set, so the model never sees blanks.
 * Returns '' for an anonymous profile.
 */
export function profileSummary(p: UserProfile): string {
  if (isAnonymousProfile(p)) return '';

  const lines: string[] = ['ABOUT THE USER'];
  const id = [p.preferredName ? `goes by ${p.preferredName}` : null, p.age ? `${p.age}y` : null]
    .filter(Boolean)
    .join(', ');
  lines.push(`Name: ${p.name}${id ? ` (${id})` : ''}.`);

  const where = [p.occupation, p.employer && `at ${p.employer}`, p.location && `in ${p.location}`]
    .filter(Boolean)
    .join(' ');
  if (where) lines.push(where.charAt(0).toUpperCase() + where.slice(1) + '.');

  if (p.bio) lines.push(p.bio);

  if (p.health) {
    const h = p.health;
    const bits = [
      h.heightCm && `${h.heightCm}cm`,
      h.weightKg && `${h.weightKg}kg`,
      h.conditions?.length && `conditions: ${h.conditions.join(', ')}`,
      h.allergies?.length && `allergies: ${h.allergies.join(', ')}`,
    ].filter(Boolean);
    if (bits.length) lines.push(`Health — ${bits.join('; ')}.`);
  }

  if (p.preferences) {
    const pr = p.preferences;
    const bits = [
      pr.interests?.length && `interests: ${pr.interests.join(', ')}`,
      pr.dietaryRestrictions?.length && `diet: ${pr.dietaryRestrictions.join(', ')}`,
    ].filter(Boolean);
    if (bits.length) lines.push(bits.join('; ') + '.');
  }

  return lines.join('\n');
}
