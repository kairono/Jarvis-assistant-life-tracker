import type { AiProvider, AskRequest, AskResult } from './AiProvider';
import type { ToolDef } from './tools';

// ------------------------------------------------------------------ //
//  OpenAiCompatibleProvider — one class for every backend that        //
//  speaks the OpenAI Chat Completions format (Groq, OpenRouter,       //
//  Mistral, Cerebras, local Ollama, …). Handles tool/function calling //
//  by looping until the model returns a final text answer.            //
//                                                                     //
//  NOTE: calls the API directly from the browser, exposing the key.   //
//  Fine for local single-user use; route through a proxy to deploy.   //
// ------------------------------------------------------------------ //

const MAX_TOOL_ROUNDS = 5;

interface Config {
  name: string;
  url: string;
  getKey: () => string;
  fallbackModel: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}
interface ChatResponse {
  choices?: Array<{ message?: { content?: string; tool_calls?: ToolCall[] } }>;
}

const toOpenAiTools = (tools: ToolDef[]) =>
  tools.map((t) => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

export class OpenAiCompatibleProvider implements AiProvider {
  readonly name: string;
  private readonly url: string;
  private readonly getKey: () => string;
  private readonly fallbackModel: string;

  constructor(cfg: Config) {
    this.name = cfg.name;
    this.url = cfg.url;
    this.getKey = cfg.getKey;
    this.fallbackModel = cfg.fallbackModel;
  }

  isConfigured(): boolean {
    return this.getKey().trim().length > 0;
  }

  async ask(req: AskRequest): Promise<AskResult> {
    const key = this.getKey().trim();
    if (!key) throw new Error(`${this.name}: no API key configured.`);

    const messages: ChatMessage[] = [
      { role: 'system', content: `${req.system}\n\nHere is a snapshot of the user's current data:\n\n${req.context}` },
      ...req.history.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
      { role: 'user', content: req.question },
    ];

    const tools = req.tools?.length ? toOpenAiTools(req.tools) : undefined;
    const actions: string[] = [];

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: req.model ?? this.fallbackModel,
          max_tokens: 1024,
          messages,
          ...(tools ? { tools, tool_choice: 'auto' } : {}),
        }),
        signal: req.signal,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`${this.name} API error ${res.status}: ${detail.slice(0, 300)}`);
      }

      const data = (await res.json()) as ChatResponse;
      const msg = data.choices?.[0]?.message;
      const calls = msg?.tool_calls ?? [];

      if (calls.length === 0 || !req.execute || round === MAX_TOOL_ROUNDS) {
        return { text: msg?.content?.trim() || (actions.length ? '✓ Done.' : '(no response)'), actions };
      }

      // Record the assistant's tool-call turn, then execute each call.
      messages.push({ role: 'assistant', content: msg?.content ?? null, tool_calls: calls });
      for (const call of calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>;
        } catch {
          /* leave args empty */
        }
        const result = await req.execute(call.function.name, args);
        actions.push(result);
        messages.push({ role: 'tool', tool_call_id: call.id, content: result });
      }
    }

    return { text: actions.length ? '✓ Done.' : '(no response)', actions };
  }
}
