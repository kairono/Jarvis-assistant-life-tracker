import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { db } from '../lib/db';
import { envProfile, getEffectiveProfile, type UserProfile } from '../lib/profile';
import { useStoreData } from '../hooks/useStore';
import { Badge, Button, Field, Input, Panel, SectionHeader, Textarea } from './ui';

// ------------------------------------------------------------------ //
//  ProfilePanel — view & edit "the person's whole data".             //
//                                                                     //
//  The env var (VITE_USER_PROFILE) is the baseline; saving here       //
//  writes a local override to IndexedDB. Both stay off GitHub.        //
// ------------------------------------------------------------------ //

// The form works in plain strings; we convert to/from the typed profile.
interface Draft {
  name: string;
  preferredName: string;
  age: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  location: string;
  occupation: string;
  employer: string;
  bio: string;
  currency: string;
  timezone: string;
  heightCm: string;
  weightKg: string;
  bloodType: string;
  allergies: string;
  conditions: string;
  annualIncome: string;
  monthlyBudget: string;
  bank: string;
  interests: string;
  dietaryRestrictions: string;
  ecName: string;
  ecRelation: string;
  ecPhone: string;
}

const csv = (a?: string[]) => (a?.length ? a.join(', ') : '');
const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
const num = (s: string) => {
  const n = Number(s);
  return s.trim() === '' || Number.isNaN(n) ? undefined : n;
};
const str = (s: string) => (s.trim() ? s.trim() : undefined);

/** Drop undefined values; return undefined if nothing meaningful is left. */
function prune<T extends Record<string, unknown>>(o: T): T | undefined {
  const kept = Object.entries(o).filter(
    ([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0),
  );
  return kept.length ? (Object.fromEntries(kept) as T) : undefined;
}

const toDraft = (p: UserProfile): Draft => ({
  name: p.name === 'there' ? '' : p.name,
  preferredName: p.preferredName ?? '',
  age: p.age?.toString() ?? '',
  dateOfBirth: p.dateOfBirth ?? '',
  email: p.email ?? '',
  phone: p.phone ?? '',
  location: p.location ?? '',
  occupation: p.occupation ?? '',
  employer: p.employer ?? '',
  bio: p.bio ?? '',
  currency: p.currency ?? '',
  timezone: p.timezone ?? '',
  heightCm: p.health?.heightCm?.toString() ?? '',
  weightKg: p.health?.weightKg?.toString() ?? '',
  bloodType: p.health?.bloodType ?? '',
  allergies: csv(p.health?.allergies),
  conditions: csv(p.health?.conditions),
  annualIncome: p.finance?.annualIncome?.toString() ?? '',
  monthlyBudget: p.finance?.monthlyBudget?.toString() ?? '',
  bank: p.finance?.bank ?? '',
  interests: csv(p.preferences?.interests),
  dietaryRestrictions: csv(p.preferences?.dietaryRestrictions),
  ecName: p.emergencyContact?.name ?? '',
  ecRelation: p.emergencyContact?.relation ?? '',
  ecPhone: p.emergencyContact?.phone ?? '',
});

const fromDraft = (d: Draft): UserProfile =>
  prune({
    name: d.name.trim() || 'there',
    preferredName: str(d.preferredName),
    age: num(d.age),
    dateOfBirth: str(d.dateOfBirth),
    email: str(d.email),
    phone: str(d.phone),
    location: str(d.location),
    occupation: str(d.occupation),
    employer: str(d.employer),
    bio: str(d.bio),
    currency: str(d.currency),
    timezone: str(d.timezone),
    health: prune({
      heightCm: num(d.heightCm),
      weightKg: num(d.weightKg),
      bloodType: str(d.bloodType),
      allergies: list(d.allergies),
      conditions: list(d.conditions),
    }),
    finance: prune({
      annualIncome: num(d.annualIncome),
      monthlyBudget: num(d.monthlyBudget),
      bank: str(d.bank),
    }),
    preferences: prune({
      interests: list(d.interests),
      dietaryRestrictions: list(d.dietaryRestrictions),
    }),
    emergencyContact: prune({
      name: str(d.ecName),
      relation: str(d.ecRelation),
      phone: str(d.ecPhone),
    }),
  }) as UserProfile;

export function ProfilePanel() {
  const profile = useStoreData<UserProfile>(getEffectiveProfile, envProfile(), []);
  const isLocal = useStoreData<boolean>(async () => (await db.getProfile()) !== null, false, []);
  const [draft, setDraft] = useState<Draft>(() => toDraft(profile));
  const [dirty, setDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Re-seed the form when the stored profile changes (e.g. after a data reset).
  useEffect(() => {
    setDraft(toDraft(profile));
    setDirty(false);
  }, [profile]);

  const set =
    (k: keyof Draft) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { value } = e.target;
      setDraft((d) => ({ ...d, [k]: value }));
      setDirty(true);
      setJustSaved(false);
    };

  async function save(e: FormEvent) {
    e.preventDefault();
    await db.saveProfile(fromDraft(draft));
    setDirty(false);
    setJustSaved(true);
  }

  function useBaseline() {
    setDraft(toDraft(envProfile()));
    setDirty(true);
    setJustSaved(false);
  }

  async function deleteAll() {
    // Sticky deletion: leaves a tombstone so the data does NOT come back from
    // the env baseline when the site is reopened. The form clears via the
    // effect above once the stored profile updates.
    await db.deleteProfile();
    setConfirmDelete(false);
    setDirty(false);
    setJustSaved(false);
  }

  return (
    <Panel className="p-5">
      <SectionHeader
        title="Profile"
        subtitle="Who Jarvis is helping — fed into every AI reply. Stored locally, never on GitHub."
        action={
          isLocal ? <Badge tone="success">Saved locally</Badge> : <Badge tone="muted">From .env baseline</Badge>
        }
      />

      <form onSubmit={save} className="space-y-5">
        {/* Identity */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Name">
            <Input value={draft.name} onChange={set('name')} placeholder="Full name" />
          </Field>
          <Field label="Preferred name">
            <Input value={draft.preferredName} onChange={set('preferredName')} placeholder="What Jarvis calls you" />
          </Field>
          <Field label="Age">
            <Input type="number" min={0} value={draft.age} onChange={set('age')} />
          </Field>
          <Field label="Date of birth">
            <Input type="date" value={draft.dateOfBirth} onChange={set('dateOfBirth')} />
          </Field>
          <Field label="Email">
            <Input type="email" value={draft.email} onChange={set('email')} />
          </Field>
          <Field label="Phone">
            <Input value={draft.phone} onChange={set('phone')} />
          </Field>
          <Field label="Location">
            <Input value={draft.location} onChange={set('location')} placeholder="City, Country" />
          </Field>
          <Field label="Occupation">
            <Input value={draft.occupation} onChange={set('occupation')} />
          </Field>
          <Field label="Employer">
            <Input value={draft.employer} onChange={set('employer')} />
          </Field>
          <Field label="Currency">
            <Input value={draft.currency} onChange={set('currency')} placeholder="USD" />
          </Field>
          <Field label="Timezone">
            <Input value={draft.timezone} onChange={set('timezone')} placeholder="Europe/London" />
          </Field>
        </div>

        <Field label="Bio">
          <Textarea rows={2} value={draft.bio} onChange={set('bio')} placeholder="A sentence or two of context for Jarvis" />
        </Field>

        {/* Health */}
        <div>
          <p className="label-tech mb-2">Health</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Height (cm)">
              <Input type="number" min={0} value={draft.heightCm} onChange={set('heightCm')} />
            </Field>
            <Field label="Weight (kg)">
              <Input type="number" min={0} value={draft.weightKg} onChange={set('weightKg')} />
            </Field>
            <Field label="Blood type">
              <Input value={draft.bloodType} onChange={set('bloodType')} placeholder="O+" />
            </Field>
            <Field label="Allergies">
              <Input value={draft.allergies} onChange={set('allergies')} placeholder="comma, separated" />
            </Field>
            <Field label="Conditions">
              <Input value={draft.conditions} onChange={set('conditions')} placeholder="comma, separated" />
            </Field>
          </div>
        </div>

        {/* Finance */}
        <div>
          <p className="label-tech mb-2">Finance</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Annual income">
              <Input type="number" min={0} value={draft.annualIncome} onChange={set('annualIncome')} />
            </Field>
            <Field label="Monthly budget">
              <Input type="number" min={0} value={draft.monthlyBudget} onChange={set('monthlyBudget')} />
            </Field>
            <Field label="Bank">
              <Input value={draft.bank} onChange={set('bank')} />
            </Field>
          </div>
        </div>

        {/* Preferences */}
        <div>
          <p className="label-tech mb-2">Preferences</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Interests">
              <Input value={draft.interests} onChange={set('interests')} placeholder="comma, separated" />
            </Field>
            <Field label="Dietary restrictions">
              <Input value={draft.dietaryRestrictions} onChange={set('dietaryRestrictions')} placeholder="comma, separated" />
            </Field>
          </div>
        </div>

        {/* Emergency contact */}
        <div>
          <p className="label-tech mb-2">Emergency contact</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Name">
              <Input value={draft.ecName} onChange={set('ecName')} />
            </Field>
            <Field label="Relation">
              <Input value={draft.ecRelation} onChange={set('ecRelation')} placeholder="partner, parent…" />
            </Field>
            <Field label="Phone">
              <Input value={draft.ecPhone} onChange={set('ecPhone')} />
            </Field>
          </div>
        </div>

        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-danger/40 bg-danger/10 p-3">
            <span className="text-sm text-text">
              Delete your profile for good? It won't come back from the .env baseline.
            </span>
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button type="button" variant="danger" onClick={deleteAll}>Delete forever</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="submit" disabled={!dirty}>Save profile</Button>
            {justSaved && !dirty && <Badge tone="success">Saved ✓</Badge>}
            <Button type="button" variant="ghost" onClick={useBaseline} className="ml-auto">
              Load .env baseline
            </Button>
            <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete my data
            </Button>
          </div>
        )}
      </form>
    </Panel>
  );
}
