import type { AiProvider, AskRequest, AskResult } from './AiProvider';

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

  // NOTE: this provider is text-only and does not run tools (it isn't in the
  // model picker by default). Kept in sync with the interface for easy re-add.
  async ask(req: AskRequest): Promise<AskResult> {
    if (!this.isConfigured()) {
      throw new Error(
        'No Anthropic API key configured. Add VITE_ANTHROPIC_API_KEY to your .env and restart the dev server.',
      );
    }

    const messages = [
      ...req.history.map((m) => ({ role: m.role, content: m.content })),
      {
        role: 'user' as const,
        content: `Here is a snapshot of my current data:\n\n${req.context}\n\n---\n\nMy question: ${req.question}`,
      },
    ];

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
        model: req.model ?? this.model,
        max_tokens: 1024,
        system: req.system,
        messages,
      }),
      signal: req.signal,
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
    return { text: text || '(no response)', actions: [] };
  }
}
