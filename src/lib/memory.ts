import { db, artifactStore } from './db';
import { getEffectiveProfile, profileSummary } from './profile';
import {
  activitiesSection,
  calendarSection,
  financeSection,
  goalsSection,
  summary,
  tasksSection,
  trainingSection,
} from './ai/context';

// ------------------------------------------------------------------ //
//  Jarvis memory — one Markdown briefing Claude reads in any chat.    //
//                                                                     //
//  `memory/summary`  auto-generated from all data (totals, not raw    //
//                    tracker rows — those stay in `activities`).      //
//  `memory/notes`    durable facts saved by the user or by Claude     //
//                    ("remember that…"), never auto-overwritten.      //
//  Locally (no artifact) notes live in localStorage.                  //
// ------------------------------------------------------------------ //

export interface MemoryNote {
  text: string;
  at: string; // ISO
}

const LOCAL_KEY = 'jarvis.memory.notes';

export async function getMemoryNotes(): Promise<MemoryNote[]> {
  if (artifactStore) {
    const raw = await artifactStore.raw();
    const snap = await raw?.doc('memory/notes').get();
    return ((snap?.data()?.notes as MemoryNote[] | undefined) ?? []).filter((n) => n?.text);
  }
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]') as MemoryNote[];
  } catch {
    return [];
  }
}

async function setMemoryNotes(notes: MemoryNote[]): Promise<void> {
  if (artifactStore) {
    const raw = await artifactStore.raw();
    await raw?.doc('memory/notes').set({ notes, updatedAt: new Date().toISOString() });
  } else {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(notes));
    } catch {
      /* storage blocked — notes are best-effort locally */
    }
  }
  notesListeners.forEach((l) => l());
}

export async function appendMemoryNote(text: string): Promise<void> {
  const notes = await getMemoryNotes();
  await setMemoryNotes([...notes, { text: text.trim(), at: new Date().toISOString() }]);
}

export async function removeMemoryNote(index: number): Promise<void> {
  const notes = await getMemoryNotes();
  await setMemoryNotes(notes.filter((_, i) => i !== index));
}

const notesListeners = new Set<() => void>();
export function onNotesChange(l: () => void): () => void {
  notesListeners.add(l);
  return () => notesListeners.delete(l);
}

/** Build the Markdown briefing from everything Jarvis holds. */
export async function buildMemoryMarkdown(): Promise<string> {
  const [profile, head, fin, tr, go, ta, ca, act, notes] = await Promise.all([
    getEffectiveProfile().then(profileSummary),
    summary(),
    financeSection(),
    trainingSection(),
    goalsSection(),
    tasksSection(),
    calendarSection({ live: false }),
    activitiesSection({ recent: false }),
    getMemoryNotes(),
  ]);
  const section = (block: string) => {
    const [title, ...rest] = block.split('\n');
    return `## ${title.charAt(0) + title.slice(1).toLowerCase()}\n${rest.join('\n')}`;
  };
  return [
    '# Jarvis memory',
    `_Auto-generated ${new Date().toLocaleString()}. Raw rows (transactions, tracker sessions, …) live in the artifact database collections; this is the briefing._`,
    profile ? section(profile) : '',
    section(head),
    section(fin),
    section(tr),
    section(go),
    section(ta),
    section(ca),
    section(act),
    '## Notes to remember',
    notes.length ? notes.map((n) => `- ${n.text}`).join('\n') : '(none yet)',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Artifact only: keep `memory/summary` current. Rebuilds a few seconds after
 * any data change and writes only when the Markdown actually changed.
 */
export function startMemorySync(): () => void {
  if (!artifactStore) return () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = '';
  const run = async () => {
    const raw = await artifactStore!.raw();
    if (!raw || artifactStore!.status !== 'ready') return;
    const md = await buildMemoryMarkdown();
    // Ignore the timestamp line when comparing, so we don't rewrite every tick.
    const body = md.replace(/^_Auto-generated.*$/m, '');
    if (!last) {
      const prev = (await raw.doc('memory/summary').get()).data()?.markdown as string | undefined;
      last = (prev ?? '').replace(/^_Auto-generated.*$/m, '');
    }
    if (body === last) return;
    last = body;
    await raw.doc('memory/summary').set({ markdown: md, updatedAt: new Date().toISOString() });
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void run().catch(() => {}), 3000);
  };
  const unsubs = [db.subscribe(schedule), onNotesChange(schedule)];
  schedule();
  return () => {
    clearTimeout(timer);
    unsubs.forEach((u) => u());
  };
}
