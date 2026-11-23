import { useState } from 'react';
import { db } from '../lib/db';
import { useCollection } from '../hooks/useStore';
import { shortDate } from '../lib/format';
import { Badge, Button, EmptyState, Field, IconButton, Input, Modal, Panel, ProgressBar, Select, Textarea } from '../components/ui';
import { Icon } from '../components/Icon';
import type { Goal, GoalStatus, Milestone } from '../types';

const STATUS_TONE: Record<GoalStatus, 'success' | 'accent' | 'muted'> = {
  done: 'success',
  active: 'accent',
  paused: 'muted',
};
type Filter = GoalStatus | 'all';
type Draft = Omit<Goal, 'id'> & { id?: string };
const blank = (): Draft => ({ title: '', category: 'Personal', status: 'active', progress: 0, milestones: [] });

const effectiveProgress = (g: Goal | Draft): number =>
  g.milestones.length > 0
    ? Math.round((g.milestones.filter((m) => m.done).length / g.milestones.length) * 100)
    : g.progress;

export function Goals() {
  const goals = useCollection('goals');
  const [filter, setFilter] = useState<Filter>('all');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newMilestone, setNewMilestone] = useState('');

  const visible = goals.filter((g) => (filter === 'all' ? true : g.status === filter));

  async function save() {
    if (!draft || !draft.title.trim()) return;
    const toSave = { ...draft, progress: effectiveProgress(draft) };
    if (draft.id) await db.goals.put(toSave as Goal);
    else await db.goals.add(toSave);
    setDraft(null);
  }

  async function toggleMilestone(goal: Goal, id: string) {
    const milestones = goal.milestones.map((m) => (m.id === id ? { ...m, done: !m.done } : m));
    await db.goals.put({ ...goal, milestones, progress: effectiveProgress({ ...goal, milestones }) });
  }

  function addMilestone() {
    if (!draft || !newMilestone.trim()) return;
    const m: Milestone = { id: crypto.randomUUID(), title: newMilestone.trim(), done: false };
    setDraft({ ...draft, milestones: [...draft.milestones, m] });
    setNewMilestone('');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {(['all', 'active', 'paused', 'done'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 text-xs capitalize transition ${
                filter === f ? 'bg-accent/15 text-accent' : 'text-muted hover:text-text'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <Button onClick={() => setDraft(blank())}>
          <Icon name="plus" size={16} /> New goal
        </Button>
      </div>

      {visible.length === 0 ? (
        <Panel className="p-5"><EmptyState icon="target" text="No goals here yet" /></Panel>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {visible.map((g) => {
            const prog = effectiveProgress(g);
            return (
              <Panel key={g.id} corners className="group p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base text-text">{g.title}</h3>
                      <Badge tone={STATUS_TONE[g.status]}>{g.status}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {g.category}{g.targetDate ? ` · target ${shortDate(g.targetDate)}` : ''}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <IconButton icon="pencil" size={14} onClick={() => setDraft(g)} aria-label="Edit" />
                    <IconButton icon="trash" size={14} onClick={() => db.goals.remove(g.id)} aria-label="Delete" />
                  </div>
                </div>

                {g.description && <p className="mt-2 text-sm text-muted">{g.description}</p>}

                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted">Progress</span>
                    <span className="text-text">{prog}%</span>
                  </div>
                  <ProgressBar value={prog} tone={prog >= 100 ? 'success' : 'accent'} />
                  {g.milestones.length === 0 && g.status !== 'done' && (
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={g.progress}
                      onChange={(e) => db.goals.put({ ...g, progress: Number(e.target.value) })}
                      className="mt-2 w-full accent-accent"
                    />
                  )}
                </div>

                {g.milestones.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {g.milestones.map((m) => (
                      <li key={m.id} className="flex items-center gap-2 text-sm">
                        <button
                          onClick={() => toggleMilestone(g, m.id)}
                          className={`flex h-4 w-4 items-center justify-center rounded border transition ${
                            m.done ? 'border-success bg-success/20 text-success' : 'border-border text-transparent hover:border-accent'
                          }`}
                          aria-label="Toggle milestone"
                        >
                          <Icon name="x" size={10} className={m.done ? 'block' : 'hidden'} />
                        </button>
                        <span className={m.done ? 'text-muted line-through' : 'text-text'}>{m.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            );
          })}
        </div>
      )}

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit goal' : 'New goal'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <Field label="Title">
              <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} autoFocus />
            </Field>
            <Field label="Description">
              <Textarea rows={2} value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Optional" />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Category">
                <Input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
              </Field>
              <Field label="Status">
                <Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as GoalStatus })}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="done">Done</option>
                </Select>
              </Field>
              <Field label="Target date">
                <Input type="date" value={draft.targetDate ?? ''} onChange={(e) => setDraft({ ...draft, targetDate: e.target.value || undefined })} />
              </Field>
            </div>

            {draft.milestones.length === 0 && (
              <Field label={`Progress · ${draft.progress}%`}>
                <input type="range" min={0} max={100} value={draft.progress} onChange={(e) => setDraft({ ...draft, progress: Number(e.target.value) })} className="w-full accent-accent" />
              </Field>
            )}

            <div>
              <span className="label-tech mb-1 block">Milestones</span>
              <ul className="mb-2 space-y-1">
                {draft.milestones.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-surface/60 px-2 py-1.5 text-sm">
                    <span className="flex-1 text-text">{m.title}</span>
                    <IconButton icon="trash" size={13} onClick={() => setDraft({ ...draft, milestones: draft.milestones.filter((x) => x.id !== m.id) })} aria-label="Remove" />
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Input
                  value={newMilestone}
                  onChange={(e) => setNewMilestone(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addMilestone())}
                  placeholder="Add a milestone…"
                />
                <Button variant="ghost" onClick={addMilestone}><Icon name="plus" size={16} /></Button>
              </div>
              {draft.milestones.length > 0 && (
                <p className="mt-2 text-xs text-muted">Progress is tracked from milestones while any exist.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
