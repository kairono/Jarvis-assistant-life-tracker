// ------------------------------------------------------------------ //
//  GeminiLiveClient — real-time, two-way voice with Gemini.          //
//                                                                     //
//  Opens a WebSocket to Google's Live API, streams microphone audio  //
//  up (16 kHz PCM) and plays the model's spoken reply back down       //
//  (24 kHz PCM), with live transcripts and barge-in (interruption).  //
//                                                                     //
//  Runs entirely in the browser with the Gemini key — fine for local //
//  single-user use; put a token relay in front before deploying.     //
//                                                                     //
//  Model / voice are easy to change below if Google renames them.    //
// ------------------------------------------------------------------ //

// Which live model + API version to use is DISCOVERED at runtime from the key
// (different accounts have different models enabled, some only under v1alpha).
// Set VITE_GEMINI_LIVE_MODEL to skip discovery and force a specific model.
const ENV_MODEL = import.meta.env.VITE_GEMINI_LIVE_MODEL?.trim();
const ENV_VERSION = import.meta.env.VITE_GEMINI_LIVE_API_VERSION?.trim();
// API versions to probe, in order, when discovering.
const API_VERSIONS = ['v1beta', 'v1alpha'];
// Last-resort fallback if discovery finds nothing.
const FALLBACK = { version: 'v1beta', model: 'models/gemini-2.5-flash-native-audio-latest' };

const VOICE = 'Puck'; // Puck, Charon, Kore, Fenrir, Aoede
const INPUT_RATE = 16_000;
const OUTPUT_RATE = 24_000;

const withPrefix = (m: string) => (m.startsWith('models/') ? m : `models/${m}`);

const wsUrl = (key: string, version: string) =>
  `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${version}.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(key)}`;

interface LiveTarget {
  version: string;
  model: string;
}

/**
 * Find a model on this key that supports the live (bidiGenerateContent) method,
 * probing each API version. Prefers "flash" models (fastest/cheapest). Returns
 * null if none are exposed, so the caller can fall back.
 */
async function discoverLiveTarget(key: string): Promise<LiveTarget | null> {
  for (const version of API_VERSIONS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/${version}/models?pageSize=1000&key=${encodeURIComponent(key)}`,
      );
      if (!res.ok) continue;
      const data = (await res.json()) as {
        models?: Array<{ name: string; supportedGenerationMethods?: string[] }>;
      };
      const live = (data.models ?? []).filter((m) =>
        m.supportedGenerationMethods?.includes('bidiGenerateContent'),
      );
      // Skip translation-only models (they translate, they don't converse).
      const usable = live.filter((m) => !/translate/i.test(m.name));
      // Prefer a "flash" model (fast/cheap); fall back to anything usable.
      const pick = usable.find((m) => /flash/i.test(m.name)) ?? usable[0] ?? live[0];
      if (pick) return { version, model: pick.name };
    } catch {
      /* try the next version */
    }
  }
  return null;
}

export type LiveStatus = 'connecting' | 'listening' | 'speaking' | 'closed' | 'error';

export interface GeminiLiveCallbacks {
  onStatus?: (status: LiveStatus) => void;
  onUserTranscript?: (deltaText: string) => void;
  onModelTranscript?: (deltaText: string) => void;
  onTurnComplete?: () => void;
  onError?: (message: string) => void;
}

// --- Minimal shapes of the JSON frames we care about. --- //
interface Part {
  text?: string;
  inlineData?: { data?: string; mimeType?: string };
}
interface ServerContent {
  modelTurn?: { parts?: Part[] };
  interrupted?: boolean;
  turnComplete?: boolean;
  inputTranscription?: { text?: string };
  outputTranscription?: { text?: string };
}
interface LiveMessage {
  setupComplete?: unknown;
  serverContent?: ServerContent;
}

// --- Audio helpers. --- //
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function pcm16ToFloat32(bytes: Uint8Array): Float32Array<ArrayBuffer> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = Math.floor(bytes.byteLength / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = view.getInt16(i * 2, true) / 0x8000;
  return out;
}

function float32ToPcm16Base64(input: Float32Array): string {
  const buf = new ArrayBuffer(input.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function downsample(input: Float32Array, inRate: number, outRate: number): Float32Array {
  if (outRate >= inRate) return input;
  const ratio = inRate / outRate;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) out[i] = input[Math.floor(i * ratio)] ?? 0;
  return out;
}

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private ready = false;
  private stopped = false;

  private inputCtx: AudioContext | null = null;
  private outputCtx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;

  private readonly sources = new Set<AudioBufferSourceNode>();
  private playHead = 0;

  private readonly apiKey: string;
  private readonly systemInstruction: string;
  private readonly cb: GeminiLiveCallbacks;
  private model = FALLBACK.model; // resolved in start()

  constructor(apiKey: string, systemInstruction: string, cb: GeminiLiveCallbacks = {}) {
    this.apiKey = apiKey;
    this.systemInstruction = systemInstruction;
    this.cb = cb;
  }

  private setStatus(s: LiveStatus) {
    if (!this.stopped || s === 'closed' || s === 'error') this.cb.onStatus?.(s);
  }

  /** Pick which model + API version to connect with (env override, else discover). */
  private async resolveTarget(): Promise<LiveTarget> {
    if (ENV_MODEL) return { version: ENV_VERSION || 'v1beta', model: withPrefix(ENV_MODEL) };
    const found = await discoverLiveTarget(this.apiKey);
    return found ?? FALLBACK;
  }

  /** Open the socket and begin the session. Call from a user gesture. */
  async start(): Promise<void> {
    if (!this.apiKey) throw new Error('No Gemini API key.');
    this.setStatus('connecting');

    const target = await this.resolveTarget();
    if (this.stopped) return;
    this.model = target.model;

    const ws = new WebSocket(wsUrl(this.apiKey, target.version));
    this.ws = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          setup: {
            model: this.model,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
            },
            systemInstruction: { parts: [{ text: this.systemInstruction }] },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        }),
      );
    };

    ws.onmessage = (ev) => void this.onMessage(ev);
    ws.onerror = () => this.cb.onError?.('Voice connection error.');
    ws.onclose = (e) => {
      if (!this.stopped) {
        if (e.code !== 1000) {
          const reason = e.reason?.trim();
          const hint =
            e.code === 1008
              ? ` — "${this.model}" isn't available for live voice on this key. Try setting VITE_GEMINI_LIVE_MODEL in .env, or your key may lack Live API access.`
              : '';
          this.cb.onError?.(
            `Voice connection closed (${e.code})${reason ? `: ${reason}` : ''}.${hint}`,
          );
        }
        this.setStatus('closed');
      }
    };
  }

  private async onMessage(ev: MessageEvent): Promise<void> {
    let text: string;
    try {
      text = typeof ev.data === 'string' ? ev.data : await (ev.data as Blob).text();
    } catch {
      return;
    }
    let msg: LiveMessage;
    try {
      msg = JSON.parse(text) as LiveMessage;
    } catch {
      return;
    }

    if (msg.setupComplete) {
      try {
        await this.startMic();
        this.ready = true;
        this.setStatus('listening');
      } catch (err) {
        this.cb.onError?.(err instanceof Error ? err.message : 'Microphone unavailable.');
        this.stop();
      }
      return;
    }

    const sc = msg.serverContent;
    if (!sc) return;

    if (sc.interrupted) this.flushPlayback();
    if (sc.inputTranscription?.text) this.cb.onUserTranscript?.(sc.inputTranscription.text);
    if (sc.outputTranscription?.text) this.cb.onModelTranscript?.(sc.outputTranscription.text);

    for (const part of sc.modelTurn?.parts ?? []) {
      if (part.inlineData?.data) this.enqueueAudio(part.inlineData.data);
    }
    if (sc.turnComplete) this.cb.onTurnComplete?.();
  }

  // --- Microphone capture → 16 kHz PCM → socket. --- //
  private async startMic(): Promise<void> {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.inputCtx = new Ctx({ sampleRate: INPUT_RATE });
    this.outputCtx = new Ctx({ sampleRate: OUTPUT_RATE });
    await this.inputCtx.resume();
    await this.outputCtx.resume();

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });

    const source = this.inputCtx.createMediaStreamSource(this.stream);
    const processor = this.inputCtx.createScriptProcessor(4096, 1, 1);
    this.processor = processor;

    processor.onaudioprocess = (e) => {
      if (!this.ready || this.ws?.readyState !== WebSocket.OPEN) return;
      const input = e.inputBuffer.getChannelData(0);
      const rate = this.inputCtx?.sampleRate ?? INPUT_RATE;
      const pcm = downsample(input, rate, INPUT_RATE);
      const data = float32ToPcm16Base64(pcm);
      this.ws.send(
        JSON.stringify({ realtimeInput: { mediaChunks: [{ mimeType: `audio/pcm;rate=${INPUT_RATE}`, data }] } }),
      );
    };

    // ScriptProcessor only runs when connected to the graph; route it through a
    // muted gain node so the mic isn't echoed to the speakers.
    const mute = this.inputCtx.createGain();
    mute.gain.value = 0;
    source.connect(processor);
    processor.connect(mute);
    mute.connect(this.inputCtx.destination);
  }

  // --- Playback: schedule 24 kHz PCM chunks gaplessly. --- //
  private enqueueAudio(b64: string): void {
    const ctx = this.outputCtx;
    if (!ctx) return;
    const f32 = pcm16ToFloat32(b64ToBytes(b64));
    if (f32.length === 0) return;

    const buffer = ctx.createBuffer(1, f32.length, OUTPUT_RATE);
    buffer.copyToChannel(f32, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime, this.playHead);
    src.start(startAt);
    this.playHead = startAt + buffer.duration;

    this.sources.add(src);
    this.setStatus('speaking');
    src.onended = () => {
      this.sources.delete(src);
      if (this.sources.size === 0 && !this.stopped) this.setStatus('listening');
    };
  }

  private flushPlayback(): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    this.playHead = this.outputCtx?.currentTime ?? 0;
    if (!this.stopped) this.setStatus('listening');
  }

  /** Tear everything down. */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.ready = false;
    this.flushPlayback();

    if (this.processor) this.processor.onaudioprocess = null;
    this.processor?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.inputCtx?.close();
    void this.outputCtx?.close();

    try {
      this.ws?.close(1000);
    } catch {
      /* ignore */
    }
    this.setStatus('closed');
  }
}
