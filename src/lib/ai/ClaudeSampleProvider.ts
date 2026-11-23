import type { AiProvider, AskRequest, AskResult } from './AiProvider';
import { capability } from '../claude/runtime';

// ------------------------------------------------------------------ //
//  ClaudeSampleProvider — the artifact's built-in Claude.             //
//                                                                     //
//  Uses the claude.ai `sample` capability: no API key, runs as the    //
//  viewer. Our provider-agnostic TOOLS become sample tools whose      //
//  `execute` runs the same executeTool() the other providers use.    //
// ------------------------------------------------------------------ //
type Tier = 'quick' | 'default' | 'complex';

export class ClaudeSampleProvider implements AiProvider {
  readonly name = 'Claude';

  isConfigured(): boolean {
    return typeof window !== 'undefined' && typeof window.claude?.use === 'function';
  }

  async ask(req: AskRequest): Promise<AskResult> {
    const sample = await capability('sample');
    if (!sample) throw new Error('Claude is unavailable in this view (open the artifact on claude.ai while signed in).');

    const actions: string[] = [];
    const tools = (req.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.parameters,
      execute: async (input: Record<string, unknown>) => {
        const summary = req.execute ? await req.execute(t.name, input) : 'Tool execution unavailable.';
        actions.push(summary);
        return summary;
      },
    }));

    // `sample` is memoryless: the system prompt rides in the first user turn.
    const history = req.history.filter((m) => m.content.trim());
    const messages = [
      ...history,
      {
        role: 'user' as const,
        content: `${req.system}\n\n---\nSnapshot of my current data:\n\n${req.context}\n\n---\nMy message: ${req.question}`,
      },
    ];
    // sample input must start with a user turn.
    while (messages.length && messages[0].role !== 'user') messages.shift();

    try {
      const res = await sample(messages, {
        modelTier: (req.model as Tier) || 'default',
        cache: false,
        signal: req.signal,
        tools: tools.length ? tools : undefined,
      });
      return { text: res.text.trim() || (actions.length ? 'Done.' : '(no response)'), actions };
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === 'not_granted') throw new Error('Claude access was declined for this page. Allow it in the artifact’s Permissions menu.');
      if (err.code === 'rate_limited') throw new Error('Claude is rate-limited right now — try again in a moment.');
      throw new Error(err.message || 'Claude request failed.');
    }
  }
}
