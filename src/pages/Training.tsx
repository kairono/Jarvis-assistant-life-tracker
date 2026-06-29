import { useState } from 'react';
import { db } from '../lib/db';
import { useCollection } from '../hooks/useStore';
import { workoutsByWeek } from '../lib/analytics';
import { shortDate } from '../lib/format';
import { WorkoutBar } from '../components/charts/WorkoutBar';
import { Badge, Button, EmptyState, Field, IconButton, Input, Modal, Panel, SectionHeader, Select, StatCard, Textarea } from '../components/ui';
import { Icon } from '../components/Icon';
import type { Workout } from '../types';

const TYPES = ['Strength', 'Run', 'Cycling', 'Yoga', 'Swim', 'HIIT', 'Walk', 'Other'];
const today = () => new Date().toISOString().slice(0, 10);

type Draft = {
  id?: string;
  date: string;
  type: string;
  duration: number;
  intensity: 1 | 2 | 3 | 4 | 5;
  notes?: string;
  distanceKm?: number;
  volumeKg?: number;
};

const toDraft = (w: Workout): Draft => ({
  id: w.id, date: w.date, type: w.type, duration: w.duration, intensity: w.intensity,
  notes: w.notes, distanceKm: w.metrics?.distanceKm, volumeKg: w.metrics?.volumeKg,
});
const blank = (): Draft => ({ date: today(), type: 'Strength', duration: 45, intensity: 3 });

export function Training() {
  const workouts = useCollection('workouts', (a, b) => b.date.localeCompare(a.date));
  const [draft, setDraft] = useState<Draft | null>(null);

  const cutoff = Date.now() - 30 * 86_400_000;
  const last30 = workouts.filter((w) => new Date(`${w.date}T00:00:00`).getTime() >= cutoff);
  const minutes30 = last30.reduce((s, w) => s + w.duration, 0);
  const avgIntensity = last30.length ? (last30.reduce((s, w) => s + w.intensity, 0) / last30.length).toFixed(1) : '—';

  async function save() {
    if (!draft || draft.duration <= 0) return;
    const metrics: Record<string, number> = {};
    if (draft.distanceKm) metrics.distanceKm = draft.distanceKm;
    if (draft.volumeKg) metrics.volumeKg = draft.volumeKg;
    const record: Omit<Workout, 'id'> & { id?: string } = {
      id: draft.id,
      date: draft.date,
      type: draft.type,
      duration: draft.duration,
      intensity: draft.intensity,
      notes: draft.notes,
      metrics: Object.keys(metrics).length ? metrics : undefined,
    };
    if (record.id) await db.workouts.put(record as Workout);
    else await db.workouts.add(record);
    setDraft(null);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Workouts · 30 days" value={last30.length} icon="flame" />
        <StatCard label="Minutes · 30 days" value={minutes30} icon="activity" tone="success" />
        <StatCard label="Avg intensity" value={`${avgIntensity}/5`} icon="activity" tone="warn" />
        <StatCard label="Logged · all time" value={workouts.length} icon="check" />
      </div>

      <Panel className="p-5">
        <SectionHeader title="Training volume" subtitle="Minutes per week · last 8 weeks" />
        <WorkoutBar data={workoutsByWeek(workouts, 8)} />
      </Panel>

      <Panel className="p-5">
        <SectionHeader
          title="Workout log"
          subtitle={`${workouts.length} sessions`}
          action={<Button onClick={() => setDraft(blank())}><Icon name="plus" size={16} /> Log workout</Button>}
        />
        {workouts.length === 0 ? (
          <EmptyState icon="activity" text="No workouts logged yet" />
        ) : (
          <ul className="space-y-2">
            {workouts.map((w) => (
              <li key={w.id} className="group flex items-center gap-3 rounded-lg border border-border/60 bg-panel/40 px-3 py-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                  <Icon name="activity" size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm text-text">
                    {w.type}
                    <Badge tone="muted">{w.duration} min</Badge>
                    <Badge tone="warn">{'●'.repeat(w.intensity)}</Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {shortDate(w.date)}
                    {w.metrics?.distanceKm ? ` · ${w.metrics.distanceKm} km` : ''}
                    {w.metrics?.volumeKg ? ` · ${w.metrics.volumeKg} kg vol` : ''}
                    {w.notes ? ` · ${w.notes}` : ''}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <IconButton icon="pencil" size={14} onClick={() => setDraft(toDraft(w))} aria-label="Edit" />
                  <IconButton icon="trash" size={14} onClick={() => db.workouts.remove(w.id)} aria-label="Delete" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit workout' : 'Log workout'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
                  {[...new Set([draft.type, ...TYPES])].map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
              <Field label="Date">
                <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Duration (min)">
                <Input type="number" min={1} value={draft.duration || ''} onChange={(e) => setDraft({ ...draft, duration: Number(e.target.value) })} />
              </Field>
              <Field label="Intensity">
                <Select value={draft.intensity} onChange={(e) => setDraft({ ...draft, intensity: Number(e.target.value) as Draft['intensity'] })}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} / 5</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Distance (km)">
                <Input type="number" min={0} step="0.1" value={draft.distanceKm ?? ''} onChange={(e) => setDraft({ ...draft, distanceKm: e.target.value ? Number(e.target.value) : undefined })} placeholder="Optional" />
              </Field>
              <Field label="Volume (kg)">
                <Input type="number" min={0} value={draft.volumeKg ?? ''} onChange={(e) => setDraft({ ...draft, volumeKg: e.target.value ? Number(e.target.value) : undefined })} placeholder="Optional" />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea rows={2} value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Optional" />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
