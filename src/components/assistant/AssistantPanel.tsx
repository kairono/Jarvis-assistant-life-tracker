import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { JarvisCore } from '../JarvisCore';
import { Button, IconButton } from '../ui';
import { aiClient } from '../../lib/ai/aiClient';
import { useSpeech } from '../../hooks/useSpeech';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

const SUGGESTIONS = [
  'How much did I spend this month?',
  'Am I on track for my fitness goal?',
  "What should I focus on today?",
  'Summarize my finances.',
];

export function AssistantPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speakReplies, setSpeakReplies] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const speech = useSpeech();
  const configured = aiClient.isConfigured();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput('');
    setError(null);
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const reply = await aiClient.ask(q);
      setMessages((m) => [...m, { role: 'assistant', text: reply }]);
      if (speakReplies) speech.speak(reply);
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
        <div className="flex-1">
          <div className="font-display tracking-widest text-text">JARVIS</div>
          <div className="text-[11px] text-muted">
            {configured ? `${aiClient.providerName} · ready` : 'AI key not configured'}
          </div>
        </div>
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
        {!configured && (
          <div className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-xs text-warn">
            Add <code className="font-mono">VITE_ANTHROPIC_API_KEY</code> to your{' '}
            <code className="font-mono">.env</code> and restart the dev server to enable replies.
            Voice and the rest of the app work without it.
          </div>
        )}

        {messages.length === 0 && (
          <div className="space-y-4 pt-4">
            <p className="text-center text-sm text-muted">
              Ask me about your finances, training, goals, or day.
            </p>
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
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-sm ${
                m.role === 'user'
                  ? 'bg-accent/15 text-text'
                  : 'border border-border/70 bg-panel/70 text-text'
              }`}
            >
              {m.text}
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
