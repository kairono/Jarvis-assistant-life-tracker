import { useMemo, useState } from 'react';
import { db } from '../lib/db';
import { useCollection } from '../hooks/useStore';
import { exerciseHistory, workoutsByWeek } from '../lib/analytics';
import { shortDate } from '../lib/format';
import { parseGymLog, sessionSets, sessionVolume } from '../lib/gymParse';
import { saveGymLog } from '../lib/gymLog';
import { WorkoutBar } from '../components/charts/WorkoutBar';
import { ExerciseProgress } from '../components/charts/ExerciseProgress';
import { Badge, Button, EmptyState, Field, IconButton, Input, Modal, Panel, SectionHeader, Select, StatCard, Textarea } from '../components/ui';
import { Icon } from '../components/Icon';
import type { Exercise, Workout } from '../types';

const TYPES = ['Strength', 'Run', 'Cycling', 'Yoga', 'Swim', 'HIIT', 'Walk', 'Other'];
const today = () => new Date().toISOString().slice(0, 10);
const tonnes = (kg: number) => `${(kg / 1000).toFixed(1)} t`;
const setText = (e: Exercise) =>
  e.sets.length
    ? e.sets.map((s) => `${s.drop ? '↘ ' : ''}${s.kg ? `${s.kg}×${s.reps}` : `BW×${s.reps}`}`).join(' · ')
    : e.note ?? '—';

type Draft = { id?: string; date: string; type: string; duration: number; intensity: 1 | 2 | 3 | 4 | 5; notes?: string };
const blank = (): Draft => ({ date: today(), type: 'Strength', duration: 45, intensity: 3 });

export function Training() {
  const workouts = useCollection('workouts', (a, b) => b.date.localeCompare(a.date));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [paste, setPaste] = useState<string | null>(null);
  const [pasteMsg, setPasteMsg] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [shown, setShown] = useState(12);
  const [exKey, setExKey] = useState<string>('');

  const { last30, sets30, volume30, weeks, histories } = useMemo(() => {
    const cutoff = Date.now() - 30 * 86_400_000;
    const last30 = workouts.filter((w) => new Date(`${w.date}T00:00:00`).getTime() >= cutoff);
    return {
      last30,
      sets30: last30.reduce((n, w) => n + sessionSets(w.exercises ?? []), 0),
      volume30: last30.reduce((n, w) => n + sessionVolume(w.exercises ?? []), 0),
      weeks: workoutsByWeek(workouts, 12),
      histories: exerciseHistory(workouts),
    };
  }, [workouts]);
  const selected = histories.find((h) => h.key === exKey) ?? histories[0];
  const preview = paste ? parseGymLog(paste) : [];

  async function save() {
    if (!draft) return;
    const record: Omit<Workout, 'id'> & { id?: string } = {
      id: draft.id,
      date: draft.date,
      type: draft.type,
      duration: draft.duration || undefined,
      intensity: draft.intensity,
      notes: draft.notes,
    };
    if (record.id) await db.workouts.put({ ...(workouts.find((w) => w.id === record.id) ?? {}), ...record } as Workout);
    else await db.workouts.add(record);
    setDraft(null);
  }

  async function savePaste() {
    if (!paste) return;
    const r = await saveGymLog(paste);
    setPasteMsg(r.summary);
    if (r.saved) setPaste(null);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sessions · 30 days" value={last30.length} icon="flame" />
        <StatCard label="Sets · 30 days" value={sets30} icon="activity" tone="success" />
        <StatCard label="Volume · 30 days" value={tonnes(volume30)} icon="activity" tone="warn" />
        <StatCard label="Logged · all time" value={workouts.length} icon="check" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel className="p-5">
          <SectionHeader title="Sets per week" subtitle="Last 12 weeks" />
          <WorkoutBar data={weeks} />
        </Panel>
        <Panel className="p-5">
          <SectionHeader
            title="Exercise progress"
            subtitle={selected ? `Top set per session · best ${selected.best.kg} kg × ${selected.best.reps} (${shortDate(selected.best.date)})` : 'Top set per session'}
            action={
              histories.length > 0 && (
                <Select value={selected?.key ?? ''} onChange={(e) => setExKey(e.target.value)} className="max-w-[12rem] py-1.5 text-xs">
                  {histories.map((h) => (
                    <option key={h.key} value={h.key}>{h.name} ({h.sessions.length})</option>
                  ))}
                </Select>
              )
            }
          />
          {selected ? <ExerciseProgress history={selected} /> : <EmptyState icon="activity" text="Log a gym session to see progress" />}
        </Panel>
      </div>

      {histories.length > 0 && (
        <Panel className="p-5">
          <SectionHeader title="Personal bests" subtitle="Heaviest top set per exercise · first vs latest" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="label-tech border-b border-border/60 text-left">
                  <th className="py-2 font-normal">Exercise</th>
                  <th className="py-2 font-normal">Group</th>
                  <th className="py-2 text-right font-normal">Best</th>
                  <th className="py-2 text-right font-normal">First → latest</th>
                  <th className="py-2 text-right font-normal">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {histories.slice(0, 15).map((h) => {
                  const first = h.sessions[0];
                  const last = h.sessions[h.sessions.length - 1];
                  const up = last.topKg > first.topKg || (last.topKg === first.topKg && last.topReps > first.topReps);
                  const down = last.topKg < first.topKg;
                  return (
                    <tr key={h.key} className="cursor-pointer border-b border-border/40 hover:bg-white/5" onClick={() => setExKey(h.key)}>
                      <td className="py-2 text-text">{h.name}</td>
                      <td className="py-2 text-muted">{h.group ?? '—'}</td>
                      <td className="py-2 text-right font-mono text-text">{h.best.kg ? `${h.best.kg}×${h.best.reps}` : `BW×${h.best.reps}`}</td>
                      <td className={`py-2 text-right font-mono ${up ? 'text-success' : down ? 'text-danger' : 'text-muted'}`}>
                        {first.topKg}×{first.topReps} → {last.topKg}×{last.topReps}
                      </td>
                      <td className="py-2 text-right text-muted">{h.sessions.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel className="p-5">
        <SectionHeader
          title="Workout log"
          subtitle={`${workouts.length} sessions`}
          action={
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setPaste(''); setPasteMsg(''); }}>
                <Icon name="pencil" size={16} /> Paste gym log
              </Button>
              <Button onClick={() => setDraft(blank())}><Icon name="plus" size={16} /> Log workout</Button>
            </div>
          }
        />
        {pasteMsg && <p className="mb-3 text-sm text-success">{pasteMsg}</p>}
        {workouts.length === 0 ? (
          <EmptyState icon="activity" text="No workouts logged yet" />
        ) : (
          <ul className="space-y-2">
            {workouts.slice(0, shown).map((w) => {
              const exs = w.exercises ?? [];
              const isOpen = open === w.id;
              return (
                <li key={w.id} className="group rounded-2xl border border-border/60 bg-white/[0.03]">
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <button
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      onClick={() => setOpen(isOpen ? null : w.id)}
                      aria-expanded={isOpen}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                        <Icon name={exs.length ? 'flame' : 'activity'} size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm text-text">
                          {w.type}
                          {exs.length > 0 && <Badge tone="muted">{exs.length} exercises · {sessionSets(exs)} sets</Badge>}
                          {exs.length > 0 && <Badge tone="accent">{tonnes(sessionVolume(exs))}</Badge>}
                          {w.duration ? <Badge tone="muted">{w.duration} min</Badge> : null}
                          {w.intensity ? <Badge tone="warn">{'●'.repeat(w.intensity)}</Badge> : null}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted">
                          {shortDate(w.date)}
                          {w.notes ? ` · ${w.notes}` : ''}
                        </div>
                      </div>
                      {exs.length > 0 && (
                        <Icon name="chevron" size={16} className={`shrink-0 text-muted transition ${isOpen ? 'rotate-90' : ''}`} />
                      )}
                    </button>
                    <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                      {!exs.length && (
                        <IconButton
                          icon="pencil"
                          size={14}
                          onClick={() => setDraft({ id: w.id, date: w.date, type: w.type, duration: w.duration ?? 0, intensity: w.intensity ?? 3, notes: w.notes })}
                          aria-label="Edit"
                        />
                      )}
                      <IconButton icon="trash" size={14} onClick={() => db.workouts.remove(w.id)} aria-label="Delete" />
                    </div>
                  </div>
                  {isOpen && exs.length > 0 && (
                    <div className="space-y-1 border-t border-white/10 px-4 py-3">
                      {exs.map((e, i) => (
                        <div key={i} className="flex flex-col gap-0.5 text-sm sm:flex-row sm:items-baseline sm:gap-3">
                          <span className="text-text sm:w-64 sm:shrink-0">
                            {e.name}
                            {e.group && i > 0 && exs[i - 1].group === e.group ? '' : e.group ? <span className="ml-2 text-[11px] text-muted">{e.group}</span> : ''}
                          </span>
                          <span className="font-mono text-xs text-muted">{setText(e)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {shown < workouts.length && (
          <div className="mt-4 flex justify-center">
            <Button variant="ghost" onClick={() => setShown((n) => n + 20)}>Show more ({workouts.length - shown} older)</Button>
          </div>
        )}
      </Panel>

      <Modal
        open={paste !== null}
        onClose={() => setPaste(null)}
        title="Paste gym log"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setPaste(null)}>Cancel</Button>
            <Button onClick={savePaste} disabled={!preview.length}>
              Save {preview.length ? `${preview.length} session${preview.length === 1 ? '' : 's'}` : ''}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted">
            A date line ("November 20 Fri"), optional muscle-group headings ("Chest"), then exercises with WEIGHTxREPS sets.
            "34x8/28x8" is a drop set, 0 kg is bodyweight. Pasting a day again replaces it.
          </p>
          <Textarea
            rows={10}
            value={paste ?? ''}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={'November 20 Fri\nLegs\nLeg press machine 160x15, 200x15, 240x15\nShoulders\nShrugs 34x10, 34x8/28x8'}
            className="font-mono text-xs"
          />
          {preview.length > 0 && (
            <ul className="space-y-1 text-xs text-muted">
              {preview.map((s) => (
                <li key={s.date}>
                  <span className="text-text">{shortDate(s.date)}</span> · {s.groups.join(' + ') || 'Gym'} · {s.exercises.length} exercises · {sessionSets(s.exercises)} sets
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

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
                <Input type="number" min={0} value={draft.duration || ''} onChange={(e) => setDraft({ ...draft, duration: Number(e.target.value) })} placeholder="Optional" />
              </Field>
              <Field label="Intensity">
                <Select value={draft.intensity} onChange={(e) => setDraft({ ...draft, intensity: Number(e.target.value) as Draft['intensity'] })}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} / 5</option>)}
                </Select>
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
