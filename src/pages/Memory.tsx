import { useEffect, useState } from 'react';
import { useStoreData } from '../hooks/useStore';
import { appendMemoryNote, buildMemoryMarkdown, getMemoryNotes, onNotesChange, removeMemoryNote, type MemoryNote } from '../lib/memory';
import { IS_ARTIFACT } from '../lib/runtime';
import { Button, EmptyState, IconButton, Input, Panel, SectionHeader } from '../components/ui';
import { Icon } from '../components/Icon';

function useNotes(): MemoryNote[] {
  const [notes, setNotes] = useState<MemoryNote[]>([]);
  useEffect(() => {
    const load = () => void getMemoryNotes().then(setNotes);
    load();
    return onNotesChange(load);
  }, []);
  return notes;
}

export function Memory() {
  const markdown = useStoreData(buildMemoryMarkdown, '', []);
  const notes = useNotes();
  const [draft, setDraft] = useState('');

  async function add() {
    if (!draft.trim()) return;
    await appendMemoryNote(draft);
    setDraft('');
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-sm text-muted">
        <Icon name="brain" size={15} className="mr-1.5 inline text-accent" />
        {IS_ARTIFACT
          ? 'This briefing is saved to the artifact as memory/summary and refreshes whenever your data changes. Claude reads it first in any chat about Jarvis.'
          : 'Preview of the memory briefing. In the claude.ai artifact it is saved for Claude to read in any chat.'}
      </div>

      <Panel className="p-5">
        <SectionHeader title="Notes to remember" subtitle="Lasting facts for Claude. Jarvis chat adds these when you say “remember…”" />
        <div className="mb-3 flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void add()}
            placeholder="e.g. I teach on Preply most evenings, GMT+5"
            className="input-base flex-1"
          />
          <Button onClick={add} disabled={!draft.trim()}>
            <Icon name="plus" size={16} /> Add
          </Button>
        </div>
        {notes.length === 0 ? (
          <EmptyState icon="brain" text="No notes yet" />
        ) : (
          <ul className="space-y-1.5">
            {notes.map((n, i) => (
              <li key={`${n.at}-${i}`} className="group flex items-center gap-3 rounded-lg border border-border/60 bg-panel/40 px-3 py-2 text-sm text-text">
                <span className="flex-1">{n.text}</span>
                <span className="text-[11px] text-muted">{new Date(n.at).toLocaleDateString()}</span>
                <IconButton icon="trash" size={14} onClick={() => removeMemoryNote(i)} aria-label="Delete note" className="opacity-0 group-hover:opacity-100" />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="p-5">
        <SectionHeader title="Briefing" subtitle="Auto-generated from all your data" />
        <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg bg-surface/60 p-4 font-mono text-xs leading-relaxed text-muted">
          {markdown || 'Building…'}
        </pre>
      </Panel>
    </div>
  );
}
