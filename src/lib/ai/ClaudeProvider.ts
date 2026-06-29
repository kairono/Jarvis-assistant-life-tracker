import type { AiProvider, AskOptions } from './AiProvider';
import { ASSISTANT_SYSTEM_PROMPT } from './systemPrompt';

const API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-6';

// ------------------------------------------------------------------ //
//  ClaudeProvider — talks to the Anthropic Messages API.             //
//                                                                     //
//  TODO: calling Anthropic directly from the browser exposes the API  //
//  key in the client. Fine for a local single-user setup, but move    //
//  this to a small local proxy/server before any deployment. Because  //
//  all calls funnel through this one class, that's a contained change.//
// ------------------------------------------------------------------ //
export class ClaudeProvider implements AiProvider {
  readonly name = 'Claude (Anthropic)';

  private get apiKey(): string {
    return import.meta.env.VITE_ANTHROPIC_API_KEY ?? '';
  }

  private get model(): string {
    return import.meta.env.VITE_ANTHROPIC_MODEL || DEFAULT_MODEL;
  }

  isConfigured(): boolean {
    return this.apiKey.trim().length > 0;
  }

  async ask(context: string, question: string, opts: AskOptions = {}): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error(
        'No Anthropic API key configured. Add VITE_ANTHROPIC_API_KEY to your .env and restart the dev server.',
      );
    }

    const userContent = `Here is a snapshot of my current data:\n\n${context}\n\n---\n\nMy question: ${question}`;

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        // Required for direct browser calls; remove once routed through a proxy.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        system: ASSISTANT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
      signal: opts.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Anthropic API error ${res.status}: ${detail.slice(0, 300)}`);
    }

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (data.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('\n')
      .trim();
    return text || '(no response)';
  }
}
