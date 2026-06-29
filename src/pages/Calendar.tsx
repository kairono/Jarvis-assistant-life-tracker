import { useState } from 'react';
import { db } from '../lib/db';
import { useCollection } from '../hooks/useStore';
import { dateTime, relativeDay } from '../lib/format';
import { Badge, Button, EmptyState, Field, IconButton, Input, Modal, Panel, SectionHeader, Textarea } from '../components/ui';
import { Icon } from '../components/Icon';
import type { CalendarEvent } from '../types';

type Draft = Omit<CalendarEvent, 'id'> & { id?: string };

const toInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromInput = (v: string) => new Date(v).toISOString();
const blank = (): Draft => {
  const start = new Date();
  start.setHours(start.getHours() + 1, 0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return { title: '', start: start.toISOString(), end: end.toISOString(), source: 'local' };
};

export function Calendar() {
  const events = useCollection('calendarEvents', (a, b) => a.start.localeCompare(b.start));
  const [draft, setDraft] = useState<Draft | null>(null);

  const upcoming = events.filter((e) => new Date(e.end).getTime() >= Date.now());

  async function save() {
    if (!draft || !draft.title.trim()) return;
    if (draft.id) await db.calendarEvents.put(draft as CalendarEvent);
    else await db.calendarEvents.add(draft);
    setDraft(null);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-sm text-muted">
        <Icon name="calendar" size={15} className="mr-1.5 inline text-accent" />
        Google Calendar two-way sync lands in <span className="text-text">Phase 3</span>. For now, events live locally
        and feed your dashboard & assistant.
      </div>

      <Panel className="p-5">
        <SectionHeader
          title="Upcoming events"
          subtitle={`${upcoming.length} scheduled`}
          action={<Button onClick={() => setDraft(blank())}><Icon name="plus" size={16} /> New event</Button>}
        />
        {upcoming.length === 0 ? (
          <EmptyState icon="calendar" text="No upcoming events" />
        ) : (
          <ul className="space-y-2">
            {upcoming.map((e) => (
              <li key={e.id} className="group flex items-center gap-3 rounded-lg border border-border/60 bg-panel/40 px-3 py-2.5">
                <span className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-accent/15 text-accent">
                  <Icon name="calendar" size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm text-text">
                    {e.title}
                    <Badge tone={e.source === 'google' ? 'accent' : 'muted'}>{e.source}</Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {dateTime(e.start)}{e.description ? ` · ${e.description}` : ''}
                  </div>
                </div>
                <span className="text-xs text-muted">{relativeDay(e.start)}</span>
                <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <IconButton icon="pencil" size={14} onClick={() => setDraft(e)} aria-label="Edit" />
                  <IconButton icon="trash" size={14} onClick={() => db.calendarEvents.remove(e.id)} aria-label="Delete" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit event' : 'New event'}
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
              <Field label="Start">
                <Input type="datetime-local" value={toInput(draft.start)} onChange={(e) => setDraft({ ...draft, start: fromInput(e.target.value) })} />
              </Field>
              <Field label="End">
                <Input type="datetime-local" value={toInput(draft.end)} onChange={(e) => setDraft({ ...draft, end: fromInput(e.target.value) })} />
              </Field>
            </div>
            <Field label="Description">
              <Textarea rows={2} value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Optional" />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
