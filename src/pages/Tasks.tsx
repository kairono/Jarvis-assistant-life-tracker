import { useState } from 'react';
import { db } from '../lib/db';
import { useCollection } from '../hooks/useStore';
import { relativeDay } from '../lib/format';
import { Badge, Button, EmptyState, Field, IconButton, Input, Modal, Panel, Select, SectionHeader } from '../components/ui';
import { Icon } from '../components/Icon';
import type { Task, TaskPriority } from '../types';

const PRIORITY_TONE: Record<TaskPriority, 'danger' | 'warn' | 'muted'> = {
  high: 'danger',
  medium: 'warn',
  low: 'muted',
};
type Filter = 'active' | 'done' | 'all';
type Draft = Omit<Task, 'id'> & { id?: string };

export function Tasks() {
  const tasks = useCollection('tasks');
  const [filter, setFilter] = useState<Filter>('active');
  const [quick, setQuick] = useState('');
  const [quickPriority, setQuickPriority] = useState<TaskPriority>('medium');
  const [draft, setDraft] = useState<Draft | null>(null);

  const visible = tasks
    .filter((t) => (filter === 'all' ? true : filter === 'done' ? t.done : !t.done))
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));

  async function quickAdd() {
    const title = quick.trim();
    if (!title) return;
    await db.tasks.add({ title, priority: quickPriority, done: false });
    setQuick('');
  }

  async function save() {
    if (!draft || !draft.title.trim()) return;
    if (draft.id) await db.tasks.put(draft as Task);
    else await db.tasks.add(draft);
    setDraft(null);
  }

  return (
    <div className="space-y-6">
      {/* Quick add */}
      <Panel className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && quickAdd()}
            placeholder="Quick add a task…  (press Enter)"
            className="flex-1"
          />
          <Select value={quickPriority} onChange={(e) => setQuickPriority(e.target.value as TaskPriority)} className="sm:w-36">
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
          <Button onClick={quickAdd}>
            <Icon name="plus" size={16} /> Add
          </Button>
        </div>
      </Panel>

      <Panel className="p-5">
        <SectionHeader
          title="To-do"
          subtitle={`${tasks.filter((t) => !t.done).length} open · ${tasks.filter((t) => t.done).length} done`}
          action={
            <div className="flex gap-1 rounded-lg border border-border p-1">
              {(['active', 'done', 'all'] as Filter[]).map((f) => (
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
          }
        />

        {visible.length === 0 ? (
          <EmptyState icon="check" text="Nothing here. Add a task above." />
        ) : (
          <ul className="space-y-2">
            {visible.map((t) => {
              const overdue = !t.done && t.dueDate && relativeDay(t.dueDate).includes('ago');
              return (
                <li
                  key={t.id}
                  className="group flex items-center gap-3 rounded-lg border border-border/60 bg-panel/40 px-3 py-2.5"
                >
                  <button
                    onClick={() => db.tasks.put({ ...t, done: !t.done })}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                      t.done ? 'border-success bg-success/20 text-success' : 'border-border text-transparent hover:border-accent'
                    }`}
                    aria-label="Toggle done"
                  >
                    <Icon name="x" size={12} className={t.done ? 'block' : 'hidden'} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-sm ${t.done ? 'text-muted line-through' : 'text-text'}`}>{t.title}</div>
                    {(t.project || t.dueDate) && (
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                        {t.project && <span>{t.project}</span>}
                        {t.dueDate && (
                          <span className={overdue ? 'text-danger' : ''}>· {relativeDay(t.dueDate)}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
                  <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <IconButton icon="pencil" size={14} onClick={() => setDraft(t)} aria-label="Edit" />
                    <IconButton icon="trash" size={14} onClick={() => db.tasks.remove(t.id)} aria-label="Delete" />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit task' : 'New task'}
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
            <div className="grid grid-cols-2 gap-3">
              <Field label="Priority">
                <Select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as TaskPriority })}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </Select>
              </Field>
              <Field label="Due date">
                <Input
                  type="date"
                  value={draft.dueDate ?? ''}
                  onChange={(e) => setDraft({ ...draft, dueDate: e.target.value || undefined })}
                />
              </Field>
            </div>
            <Field label="Project">
              <Input value={draft.project ?? ''} onChange={(e) => setDraft({ ...draft, project: e.target.value || undefined })} placeholder="Optional" />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
