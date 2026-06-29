import { useCallback, useEffect, useRef, useState } from 'react';

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

/** Web Speech API wrapper: speech-to-text + text-to-speech, with support flags. */
export function useSpeech() {
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

  return { sttSupported, ttsSupported, listening, startListening, stopListening, speak, stopSpeaking };
}
