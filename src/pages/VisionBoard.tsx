import { useEffect, useRef, useState } from 'react';
import { db } from '../lib/db';
import { useCollection } from '../hooks/useStore';
import { Button, EmptyState, Field, IconButton, Input, Modal, Panel, Textarea } from '../components/ui';
import { Icon } from '../components/Icon';
import type { VisionItem } from '../types';

const CARD_W = 220;
type Draft = Omit<VisionItem, 'id'> & { id?: string };
const blank = (): Draft => ({ title: '', caption: '', category: '', position: { x: 24, y: 24 } });

interface DragState {
  id: string;
  offX: number;
  offY: number;
  rectLeft: number;
  rectTop: number;
}

export function VisionBoard() {
  const items = useCollection('visionItems');
  const [draft, setDraft] = useState<Draft | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [livePos, setLivePos] = useState<{ x: number; y: number } | null>(null);

  // Window-level drag handling so the pointer can leave the card while moving.
  useEffect(() => {
    if (!drag) return;
    const item = items.find((i) => i.id === drag.id);
    if (!item) return;
    const board = boardRef.current;

    const onMove = (e: PointerEvent) => {
      const maxX = (board?.clientWidth ?? 800) - CARD_W;
      const x = Math.max(0, Math.min(maxX, e.clientX - drag.rectLeft - drag.offX));
      const y = Math.max(0, e.clientY - drag.rectTop - drag.offY);
      setLivePos({ x, y });
    };
    const onUp = () => {
      if (livePos) db.visionItems.put({ ...item, position: livePos });
      setDrag(null);
      setLivePos(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, items, livePos]);

  function startDrag(e: React.PointerEvent, item: VisionItem) {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDrag({
      id: item.id,
      offX: e.clientX - (rect.left + item.position.x),
      offY: e.clientY - (rect.top + item.position.y),
      rectLeft: rect.left,
      rectTop: rect.top,
    });
    setLivePos(item.position);
  }

  function onFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setDraft((d) => (d ? { ...d, imageUrl: String(reader.result) } : d));
    reader.readAsDataURL(file);
  }

  async function save() {
    if (!draft || !draft.title.trim()) return;
    if (draft.id) await db.visionItems.put(draft as VisionItem);
    else await db.visionItems.add(draft);
    setDraft(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Drag cards to arrange. This is the life you are building.</p>
        <Button onClick={() => setDraft(blank())}><Icon name="plus" size={16} /> Add vision</Button>
      </div>

      <Panel className="overflow-hidden p-0">
        <div
          ref={boardRef}
          className="hud-grid relative min-h-[68vh] w-full overflow-auto"
        >
          {items.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <EmptyState icon="image" text="Add images of what you're working toward" />
            </div>
          )}
          {items.map((item) => {
            const pos = drag?.id === item.id && livePos ? livePos : item.position;
            const dragging = drag?.id === item.id;
            return (
              <div
                key={item.id}
                className={`group absolute select-none rounded-xl border border-border/70 bg-panel/80 shadow-panel transition-shadow ${dragging ? 'z-10 shadow-glow ring-1 ring-accent/50' : ''}`}
                style={{ left: pos.x, top: pos.y, width: CARD_W }}
              >
                <div
                  onPointerDown={(e) => startDrag(e, item)}
                  className="flex cursor-grab items-center justify-between rounded-t-xl border-b border-border/60 bg-surface/60 px-3 py-1.5 active:cursor-grabbing"
                >
                  <span className="truncate text-xs font-medium text-text">{item.title}</span>
                  <div className="flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                    <IconButton icon="pencil" size={12} className="h-6 w-6" onClick={() => setDraft(item)} aria-label="Edit" />
                    <IconButton icon="trash" size={12} className="h-6 w-6" onClick={() => db.visionItems.remove(item.id)} aria-label="Delete" />
                  </div>
                </div>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.title} draggable={false} className="h-32 w-full object-cover" />
                ) : (
                  <div className="flex h-32 w-full items-center justify-center bg-surface/40 text-muted">
                    <Icon name="image" size={28} />
                  </div>
                )}
                {item.caption && <p className="px-3 py-2 text-xs text-muted">{item.caption}</p>}
              </div>
            );
          })}
        </div>
      </Panel>

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit vision' : 'Add vision'}
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
            <Field label="Caption">
              <Textarea rows={2} value={draft.caption ?? ''} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} placeholder="Optional" />
            </Field>
            <Field label="Category">
              <Input value={draft.category ?? ''} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="e.g. Travel, Fitness" />
            </Field>
            <Field label="Image URL">
              <Input value={draft.imageUrl ?? ''} onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })} placeholder="Paste a link, or upload below" />
            </Field>
            <div>
              <span className="label-tech mb-1 block">Or upload</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:text-text"
              />
            </div>
            {draft.imageUrl && <img src={draft.imageUrl} alt="preview" className="max-h-40 w-full rounded-lg object-cover" />}
          </div>
        )}
      </Modal>
    </div>
  );
}
