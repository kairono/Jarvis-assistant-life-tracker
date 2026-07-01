import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { JarvisCore } from '../JarvisCore';
import { Button, IconButton } from '../ui';
import { aiClient } from '../../lib/ai/aiClient';
import { buildContext } from '../../lib/ai/context';
import { ASSISTANT_SYSTEM_PROMPT } from '../../lib/ai/systemPrompt';
import { useSpeech } from '../../hooks/useSpeech';
import { useGeminiLive, type LiveTurn } from '../../hooks/useGeminiLive';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  actions?: string[];
}

const MODEL_KEY = 'jarvis:model';
const CHAT_KEY = 'jarvis:chat';

function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    return raw ? (JSON.parse(raw) as Message[]) : [];
  } catch {
    return [];
  }
}

const SUGGESTIONS = [
  'How much did I spend this month?',
  'Am I on track for my fitness goal?',
  "What should I focus on today?",
  'Summarize my finances.',
];

export function AssistantPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speakReplies, setSpeakReplies] = useState(false);
  const [modelId, setModelId] = useState<string>(
    () => localStorage.getItem(MODEL_KEY) ?? aiClient.defaultModelId,
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  const speech = useSpeech();
  const configured = aiClient.isModelConfigured(modelId);

  // --- Live voice (Gemini) --- //
  const geminiKey = (import.meta.env.VITE_GEMINI_API_KEY ?? '').trim();
  const onLiveTurn = useCallback((turn: LiveTurn) => {
    setMessages((m) => [
      ...m,
      ...(turn.user ? [{ role: 'user' as const, text: turn.user }] : []),
      ...(turn.model ? [{ role: 'assistant' as const, text: turn.model }] : []),
    ]);
  }, []);
  const live = useGeminiLive(onLiveTurn);

  const startLive = useCallback(async () => {
    if (!geminiKey) return;
    const snapshot = await buildContext('give me a full overview of my life right now');
    const systemInstruction =
      `${ASSISTANT_SYSTEM_PROMPT}\n\n` +
      'You are now talking with the user by VOICE, in real time. Keep replies short, ' +
      'natural, and conversational — a sentence or two, like a phone call. Here is a ' +
      `snapshot of their data as ground truth:\n\n${snapshot}`;
    void live.start(systemInstruction, geminiKey);
  }, [geminiKey, live]);

  useEffect(() => {
    localStorage.setItem(MODEL_KEY, modelId);
  }, [modelId]);

  useEffect(() => {
    localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput('');
    setError(null);
    // Snapshot prior turns as memory before appending the new user message.
    const history = messages.map((m) => ({ role: m.role, content: m.text }));
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const { text, actions } = await aiClient.ask(q, modelId, history);
      setMessages((m) => [...m, { role: 'assistant', text, actions }]);
      if (speakReplies) speech.speak(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    if (speech.listening) {
      speech.stopListening();
    } else {
      speech.startListening((text) => setInput((prev) => (prev ? `${prev} ${text}` : text)));
    }
  }

  return (
    <div
      className={`fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-border/60 bg-surface/95 backdrop-blur-md transition-transform duration-300 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
        <JarvisCore size={40} />
        <div className="min-w-0 flex-1">
          <div className="font-display tracking-widest text-text">JARVIS</div>
          <div className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${configured ? 'bg-success' : 'bg-warn'}`}
              title={configured ? 'Ready' : 'No API key for this model'}
            />
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              aria-label="Choose model"
              className="min-w-0 flex-1 cursor-pointer truncate bg-transparent text-[11px] text-muted focus:text-text focus:outline-none"
            >
              {aiClient.models.map((m) => (
                <option key={m.id} value={m.id} className="bg-surface text-text">
                  {m.label}
                  {aiClient.isModelConfigured(m.id) ? '' : ' · no key'}
                </option>
              ))}
            </select>
          </div>
        </div>
        {geminiKey && (
          <IconButton
            icon="activity"
            onClick={() => (live.active ? live.stop() : startLive())}
            aria-label={live.active ? 'End live voice' : 'Start live voice'}
            title={live.active ? 'End live voice' : 'Talk to Jarvis (live voice)'}
            className={live.active ? 'animate-pulse border-accent text-accent' : ''}
          />
        )}
        {messages.length > 0 && (
          <IconButton
            icon="trash"
            onClick={() => setMessages([])}
            aria-label="Clear chat history"
            title="Clear chat history"
          />
        )}
        {speech.ttsSupported && (
          <IconButton
            icon="volume"
            onClick={() => {
              if (speakReplies) speech.stopSpeaking();
              setSpeakReplies((v) => !v);
            }}
            aria-label="Toggle spoken replies"
            className={speakReplies ? 'border-accent/60 text-accent' : ''}
          />
        )}
        <IconButton icon="x" onClick={onClose} aria-label="Close assistant" />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {live.active && (
          <div className="rounded-xl border border-accent/40 bg-accent/10 p-3">
            <div className="flex items-center gap-3">
              <span className={live.state === 'speaking' ? 'animate-pulse' : ''}>
                <JarvisCore size={34} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-text">
                  {live.state === 'connecting'
                    ? 'Connecting…'
                    : live.state === 'speaking'
                      ? 'Jarvis is speaking…'
                      : 'Listening — go ahead'}
                </div>
                <div className="truncate text-[11px] text-muted">
                  {live.userCaption || 'Live voice call'}
                </div>
              </div>
              <Button variant="danger" onClick={live.stop}>End</Button>
            </div>
            {live.modelCaption && (
              <p className="mt-2 line-clamp-3 text-xs text-muted">{live.modelCaption}</p>
            )}
          </div>
        )}
        {live.error && (
          <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
            {live.error}
          </div>
        )}

        {!configured && (
          <div className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-xs text-warn">
            Add <code className="font-mono">{aiClient.envHintFor(modelId)}</code> to your{' '}
            <code className="font-mono">.env</code> and restart the dev server to use{' '}
            {aiClient.providerName(modelId)}. Voice and the rest of the app work without it, and
            you can switch models above.
          </div>
        )}

        {messages.length === 0 && !live.active && (
          <div className="space-y-4 pt-4">
            <p className="text-center text-sm text-muted">
              Ask me about your finances, training, goals, or day.
            </p>
            {geminiKey && (
              <button
                onClick={startLive}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-accent/50 bg-accent/10 px-3 py-2.5 text-sm text-accent transition hover:bg-accent/20"
              >
                <Icon name="activity" size={16} /> Talk to Jarvis (live voice)
              </button>
            )}
            <div className="grid gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-lg border border-border bg-panel/50 px-3 py-2 text-left text-sm text-muted transition hover:border-accent/50 hover:text-text"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[85%]">
              <div
                className={`whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-sm ${
                  m.role === 'user'
                    ? 'bg-accent/15 text-text'
                    : 'border border-border/70 bg-panel/70 text-text'
                }`}
              >
                {m.text}
              </div>
              {m.actions && m.actions.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {m.actions.map((a, j) => (
                    <div
                      key={j}
                      className="flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/10 px-2.5 py-1.5 text-xs text-success"
                    >
                      <Icon name="check" size={13} /> {a}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            Thinking…
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger">{error}</div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border/60 p-3">
        <div className="flex items-end gap-2">
          {speech.sttSupported && (
            <IconButton
              icon="mic"
              onClick={toggleMic}
              aria-label="Voice input"
              className={speech.listening ? 'animate-pulse border-accent text-accent' : ''}
            />
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder={speech.listening ? 'Listening…' : 'Ask Jarvis…'}
            className="input-base max-h-28 flex-1 resize-none"
          />
          <Button onClick={() => send(input)} disabled={busy || !input.trim()} aria-label="Send">
            <Icon name="send" size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
