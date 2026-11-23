import { useCallback, useEffect, useRef, useState } from 'react';
import { IS_ARTIFACT } from '../lib/runtime';
import { capability, type ClaudeDictation, type ClaudeTts } from '../lib/claude/runtime';

// Minimal typings for the Web Speech API (not in lib.dom by default).
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type RecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface Speech {
  sttSupported: boolean;
  ttsSupported: boolean;
  listening: boolean;
  /** Live (partial) transcript while listening — artifact dictation only. */
  partial: string;
  startListening(onText: (text: string) => void): void;
  stopListening(): void;
  speak(text: string): void;
  stopSpeaking(): void;
}

/** Speech-to-text + text-to-speech. In the artifact: claude.ai dictation + Claude voice;
 *  locally: the browser's Web Speech API. */
export function useSpeech(): Speech {
  // IS_ARTIFACT is a build-time constant, so the hook order never changes.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return IS_ARTIFACT ? useClaudeSpeech() : useBrowserSpeech();
}

function useClaudeSpeech(): Speech {
  const dictRef = useRef<ClaudeDictation | null>(null);
  const ttsRef = useRef<ClaudeTts | null>(null);
  const [stt, setStt] = useState(false);
  const [tts, setTts] = useState(false);
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const finalsRef = useRef<string[]>([]);
  const onTextRef = useRef<((t: string) => void) | null>(null);

  // Resolve namespaces up front: dictation.start() must run synchronously
  // inside the click handler, with nothing awaited before it.
  useEffect(() => {
    let alive = true;
    const offs: Array<() => void> = [];
    void capability('dictation').then((d) => {
      if (!alive || !d) return;
      dictRef.current = d;
      setStt(true);
      offs.push(d.onPartial(({ text }) => setPartial(text)));
      offs.push(d.onFinal(({ text }) => finalsRef.current.push(text)));
      offs.push(
        d.onState(({ state }) => {
          setListening(state === 'listening' || state === 'starting');
          if (state === 'idle') {
            const text = finalsRef.current.join(' ').trim();
            finalsRef.current = [];
            setPartial('');
            if (text) onTextRef.current?.(text);
          }
        }),
      );
    });
    void capability('tts').then((t) => {
      if (!alive || !t) return;
      ttsRef.current = t;
      setTts(true);
    });
    return () => {
      alive = false;
      offs.forEach((o) => o());
      void dictRef.current?.stop().catch(() => {});
    };
  }, []);

  const startListening = useCallback((onText: (t: string) => void) => {
    const d = dictRef.current;
    if (!d) return;
    onTextRef.current = onText;
    finalsRef.current = [];
    void ttsRef.current?.stop().catch(() => {});
    d.start().catch(() => setListening(false));
  }, []);

  const stopListening = useCallback(() => {
    void dictRef.current?.stop().catch(() => {});
  }, []);

  const speak = useCallback((text: string) => {
    // Plain text, ≤ 2000 chars; drop markdown symbols so they aren't read out.
    const clean = text.replace(/[*_#`>]/g, '').slice(0, 2000);
    ttsRef.current?.speak(clean).catch(() => {});
  }, []);

  const stopSpeaking = useCallback(() => {
    void ttsRef.current?.stop().catch(() => {});
  }, []);

  return { sttSupported: stt, ttsSupported: tts, listening, partial, startListening, stopListening, speak, stopSpeaking };
}

/** Web Speech API wrapper: speech-to-text + text-to-speech, with support flags. */
function useBrowserSpeech(): Speech {
  const sttSupported = typeof window !== 'undefined' && getRecognitionCtor() !== null;
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const startListening = useCallback(
    (onText: (text: string) => void) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor) return;
      const rec = new Ctor();
      rec.lang = navigator.language || 'en-US';
      rec.interimResults = false;
      rec.continuous = false;
      rec.onresult = (e) => {
        const text = Array.from({ length: e.results.length })
          .map((_, i) => e.results[i][0].transcript)
          .join(' ')
          .trim();
        if (text) onText(text);
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      recognitionRef.current = rec;
      setListening(true);
      rec.start();
    },
    [],
  );

  const speak = useCallback(
    (text: string) => {
      if (!ttsSupported) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.02;
      u.pitch = 1;
      window.speechSynthesis.speak(u);
    },
    [ttsSupported],
  );

  const stopSpeaking = useCallback(() => {
    if (ttsSupported) window.speechSynthesis.cancel();
  }, [ttsSupported]);

  // Tidy up if the component unmounts mid-listen / mid-speak.
  useEffect(() => () => {
    recognitionRef.current?.stop();
    if (ttsSupported) window.speechSynthesis.cancel();
  }, [ttsSupported]);

  return { sttSupported, ttsSupported, listening, partial: '', startListening, stopListening, speak, stopSpeaking };
}
