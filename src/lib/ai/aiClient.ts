import type { AiProvider, AskOptions } from './AiProvider';
import { ClaudeProvider } from './ClaudeProvider';
import { buildContext } from './context';

// ------------------------------------------------------------------ //
//  aiClient — the single AI entry point for the UI.                   //
//                                                                     //
//  Swap the provider here (e.g. new LocalLlmProvider()) to change     //
//  the whole app's AI backend. The UI calls aiClient.ask(question);   //
//  the client assembles a relevant context snapshot and hands         //
//  (context, question) to the active provider.                        //
// ------------------------------------------------------------------ //
class AiClient {
  private provider: AiProvider = new ClaudeProvider();

  get providerName(): string {
    return this.provider.name;
  }

  isConfigured(): boolean {
    return this.provider.isConfigured();
  }

  /** High-level call used by the UI: builds context, then asks the provider. */
  async ask(question: string, opts?: AskOptions): Promise<string> {
    const context = await buildContext(question);
    return this.provider.ask(context, question, opts);
  }

  /** Low-level escape hatch if a caller wants to supply its own context. */
  askWithContext(context: string, question: string, opts?: AskOptions): Promise<string> {
    return this.provider.ask(context, question, opts);
  }
}

export const aiClient = new AiClient();
