import { useCallback, useRef, useState } from 'react';
import { GeminiLiveClient, type LiveStatus } from '../lib/ai/GeminiLiveClient';

export type LiveState = 'idle' | LiveStatus;

/** Turn-taking exchange emitted once a full user→model turn completes. */
export interface LiveTurn {
  user: string;
  model: string;
}

/**
 * React wrapper around GeminiLiveClient. Exposes the connection state, the
 * live (in-progress) captions, and start/stop controls. Completed turns are
 * pushed to `onTurn` so the caller can log them in the chat transcript.
 */
export function useGeminiLive(onTurn?: (turn: LiveTurn) => void) {
  const [state, setState] = useState<LiveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [userCaption, setUserCaption] = useState('');
  const [modelCaption, setModelCaption] = useState('');

  const clientRef = useRef<GeminiLiveClient | null>(null);
  const userBuf = useRef('');
  const modelBuf = useRef('');
  const onTurnRef = useRef(onTurn);
  onTurnRef.current = onTurn;

  const start = useCallback(async (systemInstruction: string, apiKey: string) => {
    if (clientRef.current) return;
    setError(null);
    setUserCaption('');
    setModelCaption('');
    userBuf.current = '';
    modelBuf.current = '';

    const client = new GeminiLiveClient(apiKey, systemInstruction, {
      onStatus: (s) => setState(s),
      onUserTranscript: (t) => {
        userBuf.current += t;
        setUserCaption(userBuf.current);
      },
      onModelTranscript: (t) => {
        modelBuf.current += t;
        setModelCaption(modelBuf.current);
      },
      onTurnComplete: () => {
        const turn = { user: userBuf.current.trim(), model: modelBuf.current.trim() };
        if (turn.user || turn.model) onTurnRef.current?.(turn);
        userBuf.current = '';
        modelBuf.current = '';
        setUserCaption('');
        setModelCaption('');
      },
      onError: (m) => setError(m),
    });
    clientRef.current = client;

    try {
      await client.start();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start voice session.');
      setState('error');
      clientRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clientRef.current?.stop();
    clientRef.current = null;
    setState('idle');
    setUserCaption('');
    setModelCaption('');
  }, []);

  const active = state === 'connecting' || state === 'listening' || state === 'speaking';

  return { state, active, error, userCaption, modelCaption, start, stop };
}
