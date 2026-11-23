import type { AiProvider, AskRequest, AskResult } from './AiProvider';
import { geminiTools } from './geminiTools';

// ------------------------------------------------------------------ //
//  GeminiProvider — Google's Generative Language API.                 //
//                                                                     //
//  Uses Google's own request shape (system_instruction + contents +  //
//  functionDeclarations). Loops to run any function calls the model   //
//  requests before returning the final text.                          //
// ------------------------------------------------------------------ //

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_TOOL_ROUNDS = 5;

interface FunctionCall {
  name: string;
  args?: Record<string, unknown>;
}
interface Part {
  text?: string;
  functionCall?: FunctionCall;
  functionResponse?: { name: string; response: Record<string, unknown> };
}
interface Content {
  role: 'user' | 'model';
  parts: Part[];
}
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Part[] } }>;
}

export class GeminiProvider implements AiProvider {
  readonly name = 'Google Gemini';

  private get key(): string {
    return import.meta.env.VITE_GEMINI_API_KEY?.trim() ?? '';
  }

  isConfigured(): boolean {
    return this.key.length > 0;
  }

  async ask(req: AskRequest): Promise<AskResult> {
    const key = this.key;
    if (!key) throw new Error('Google Gemini: no API key configured.');

    const model = req.model ?? DEFAULT_MODEL;
    const url = `${BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`;

    const contents: Content[] = [
      ...req.history.map(
        (m): Content => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }),
      ),
      { role: 'user', parts: [{ text: req.question }] },
    ];

    const tools = req.tools?.length ? geminiTools(req.tools) : undefined;
    const actions: string[] = [];

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: `${req.system}\n\nHere is a snapshot of the user's current data:\n\n${req.context}` }],
          },
          contents,
          ...(tools ? { tools } : {}),
          generationConfig: { maxOutputTokens: 1024 },
        }),
        signal: req.signal,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Gemini API error ${res.status}: ${detail.slice(0, 300)}`);
      }

      const data = (await res.json()) as GeminiResponse;
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const calls = parts.filter((p) => p.functionCall).map((p) => p.functionCall!);

      if (calls.length === 0 || !req.execute || round === MAX_TOOL_ROUNDS) {
        const text = parts
          .map((p) => p.text ?? '')
          .join('')
          .trim();
        return { text: text || (actions.length ? '✓ Done.' : '(no response)'), actions };
      }

      // Echo the model's function-call turn, then feed back each result.
      contents.push({ role: 'model', parts: calls.map((functionCall) => ({ functionCall })) });
      const responseParts: Part[] = [];
      for (const call of calls) {
        const result = await req.execute(call.name, call.args ?? {});
        actions.push(result);
        responseParts.push({ functionResponse: { name: call.name, response: { result } } });
      }
      contents.push({ role: 'user', parts: responseParts });
    }

    return { text: actions.length ? '✓ Done.' : '(no response)', actions };
  }
}
