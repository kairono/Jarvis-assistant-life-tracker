// ------------------------------------------------------------------ //
//  Thin typed access to the claude.ai artifact runtime.               //
//  Only `window.claude.use(name)` is promised; every capability       //
//  resolves to its namespace, or null when this view can't run it.    //
//  Types mirror the platform's .d.ts (runtime contract 0.2.98),       //
//  trimmed to what Jarvis calls.                                      //
// ------------------------------------------------------------------ //

export type Unsubscribe = () => void;

export interface DocSnap {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
export interface QuerySnap {
  docs: DocSnap[];
}
export interface DbError {
  code: string;
  message: string;
}
export interface DocRef {
  id: string;
  get(): Promise<DocSnap>;
  set(data: Record<string, unknown>): Promise<void>;
  update(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
  onSnapshot(next: (s: DocSnap) => void, error?: (e: DbError) => void): Unsubscribe;
}
export interface CollectionRef {
  doc(id?: string): DocRef;
  get(): Promise<QuerySnap>;
  limit(n: number): { get(): Promise<QuerySnap> };
  onSnapshot(next: (s: QuerySnap) => void, error?: (e: DbError) => void): Unsubscribe;
}
export interface ClaudeDb {
  doc(path: string): DocRef;
  collection(path: string): CollectionRef;
}

export interface SampleTool {
  name: string;
  description: string;
  inputSchema?: { type: 'object'; properties?: Record<string, unknown>; required?: string[] };
  execute(input: Record<string, unknown>, ctx: { signal: AbortSignal }): unknown;
}
export interface SampleOptions {
  onText?: (u: { text: string; delta: string }) => void;
  signal?: AbortSignal;
  modelTier?: 'quick' | 'default' | 'complex';
  cache?: boolean;
  tools?: SampleTool[];
}
export interface ClaudeSample {
  (
    input: string | { role: 'user' | 'assistant'; content: string }[],
    opts?: SampleOptions,
  ): Promise<{ text: string; truncated: boolean }>;
}

export interface ClaudeDictation {
  start(opts?: { language?: string }): Promise<void>;
  stop(): Promise<void>;
  onFinal(h: (e: { text: string }) => void): Unsubscribe;
  onPartial(h: (e: { text: string }) => void): Unsubscribe;
  onState(h: (e: { state: 'idle' | 'starting' | 'listening' | 'finishing'; reason?: string }) => void): Unsubscribe;
}
export interface ClaudeTts {
  speak(text: string, opts?: { voice?: string; rate?: number }): Promise<{ playedMs: number }>;
  stop(): Promise<void>;
}

export interface McpResult {
  payload?: unknown;
  content?: unknown;
  [k: string]: unknown;
}
export interface ClaudeMcp {
  callTool(server: string, tool: string, input: Record<string, unknown>): Promise<McpResult>;
}

export interface ClaudeDownloads {
  save(req: { filename: string; data: string | Blob }): Promise<{ status: 'saved' | 'delivered' }>;
}

interface CapabilityMap {
  downloads: ClaudeDownloads;
  db: ClaudeDb;
  sample: ClaudeSample;
  dictation: ClaudeDictation;
  tts: ClaudeTts;
  mcp: ClaudeMcp;
}

declare global {
  interface Window {
    claude?: { use?: (name: string) => Promise<unknown> };
  }
}

const cache = new Map<string, Promise<unknown>>();

/** Resolve a capability namespace (memoized), or null when unavailable. */
export function capability<K extends keyof CapabilityMap>(name: K): Promise<CapabilityMap[K] | null> {
  if (!cache.has(name)) {
    const fn = typeof window !== 'undefined' ? window.claude?.use : undefined;
    cache.set(name, fn ? fn(name).catch(() => null) : Promise.resolve(null));
  }
  return cache.get(name) as Promise<CapabilityMap[K] | null>;
}
