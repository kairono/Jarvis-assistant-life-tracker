import type { ToolDef } from './tools';

// ------------------------------------------------------------------ //
//  AI abstraction.                                                    //
//                                                                     //
//  Every AI call goes through an AiProvider.ask(). Providers receive  //
//  the system prompt, a data snapshot, prior conversation (memory),   //
//  the new question, and optionally a set of tools they may call to   //
//  modify the user's data. They return the reply text plus a list of  //
//  any actions they executed.                                         //
// ------------------------------------------------------------------ //

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Executes a tool call and returns a short human summary of the result. */
export type ToolExecutor = (name: string, args: Record<string, unknown>) => Promise<string>;

export interface AskRequest {
  system: string; // personality / rules
  context: string; // compact snapshot of the user's data
  history: ChatMessage[]; // prior turns, for conversational memory
  question: string; // the latest user message
  model?: string; // provider-specific model id
  tools?: ToolDef[]; // tools the model may call
  execute?: ToolExecutor; // runs a tool the model requests
  signal?: AbortSignal;
}

export interface AskResult {
  text: string;
  actions: string[]; // summaries of tool calls that were executed
}

export interface AiProvider {
  /** Human-readable provider name, shown in the UI. */
  readonly name: string;

  /** True when the provider has what it needs to run (e.g. an API key). */
  isConfigured(): boolean;

  /** Single inference entry point (may loop internally to run tools). */
  ask(req: AskRequest): Promise<AskResult>;
}
