// ------------------------------------------------------------------ //
//  AI abstraction.                                                    //
//                                                                     //
//  Every AI call in the app goes through an AiProvider.ask(). Today   //
//  that's ClaudeProvider (Anthropic API). Later, dropping in a        //
//  LocalLlmProvider with the same interface is a one-line swap in     //
//  aiClient.ts — no UI changes.                                       //
// ------------------------------------------------------------------ //

export interface AskOptions {
  signal?: AbortSignal;
}

export interface AiProvider {
  /** Human-readable provider name, shown in the UI. */
  readonly name: string;

  /** True when the provider has what it needs to run (e.g. an API key). */
  isConfigured(): boolean;

  /**
   * Single inference entry point.
   * @param context  A compact, pre-selected snapshot of the user's data.
   * @param question The user's natural-language question.
   * @returns        The assistant's reply text.
   */
  ask(context: string, question: string, opts?: AskOptions): Promise<string>;
}
