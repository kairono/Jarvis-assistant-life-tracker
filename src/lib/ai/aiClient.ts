import type { AiProvider, AskResult, ChatMessage } from './AiProvider';
import { OpenAiCompatibleProvider } from './OpenAiCompatibleProvider';
import { GeminiProvider } from './GeminiProvider';
import { ClaudeSampleProvider } from './ClaudeSampleProvider';
import { buildContext } from './context';
import { ASSISTANT_SYSTEM_PROMPT } from './systemPrompt';
import { TOOLS, executeTool } from './tools';
import {
  DEFAULT_MODEL_ID,
  MODELS,
  PROVIDER_ENV_HINT,
  findModel,
  type ModelSpec,
  type ProviderId,
} from './models';

// ------------------------------------------------------------------ //
//  aiClient — the single AI entry point for the UI.                   //
//                                                                     //
//  Holds one provider instance per backend. The UI passes a modelId   //
//  (chosen in the chat picker); the client resolves it to a provider  //
//  and that provider's own model string, builds the data context,     //
//  and dispatches. Add a backend by registering a provider here and   //
//  adding entries to models.ts — no UI changes required.              //
// ------------------------------------------------------------------ //
class AiClient {
  private readonly providers: Record<ProviderId, AiProvider> = {
    groq: new OpenAiCompatibleProvider({
      name: 'Groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      getKey: () => import.meta.env.VITE_GROQ_API_KEY ?? '',
      fallbackModel: 'llama-3.3-70b-versatile',
    }),
    gemini: new GeminiProvider(),
    claude: new ClaudeSampleProvider(),
  };

  readonly models: ModelSpec[] = MODELS;
  readonly defaultModelId = DEFAULT_MODEL_ID;

  /** The provider backing a given model id, if any. */
  private providerFor(modelId: string): AiProvider | undefined {
    const spec = findModel(modelId);
    return spec && this.providers[spec.provider];
  }

  /** Human-readable provider name for a model id (e.g. "Groq"). */
  providerName(modelId: string): string {
    return this.providerFor(modelId)?.name ?? 'Unknown';
  }

  /** True when the model's provider has an API key configured. */
  isModelConfigured(modelId: string): boolean {
    return this.providerFor(modelId)?.isConfigured() ?? false;
  }

  /** Env var a model's provider needs, for "not configured" hints. */
  envHintFor(modelId: string): string {
    const spec = findModel(modelId);
    return spec ? PROVIDER_ENV_HINT[spec.provider] : '';
  }

  /** The subset of models whose provider is ready to use. */
  availableModels(): ModelSpec[] {
    return MODELS.filter((m) => this.providers[m.provider].isConfigured());
  }

  /**
   * Build the data context, then ask the chosen model's provider — passing
   * prior conversation (memory) and the tools it can use to modify data.
   */
  async ask(
    question: string,
    modelId: string,
    history: ChatMessage[] = [],
    signal?: AbortSignal,
  ): Promise<AskResult> {
    // A model id saved from the other build (local vs artifact) falls back to the default.
    const spec = findModel(modelId) ?? findModel(DEFAULT_MODEL_ID)!;
    const provider = this.providers[spec.provider];
    if (!provider.isConfigured()) {
      throw new Error(
        `No API key for ${spec.label}. Add ${PROVIDER_ENV_HINT[spec.provider]} to your .env and restart the dev server.`,
      );
    }
    const context = await buildContext(question);
    return provider.ask({
      system: ASSISTANT_SYSTEM_PROMPT,
      context,
      history,
      question,
      model: spec.model,
      tools: TOOLS,
      execute: executeTool,
      signal,
    });
  }
}

export const aiClient = new AiClient();
