// ------------------------------------------------------------------ //
//  Model registry — the list the in-chat picker reads.               //
//                                                                     //
//  Each entry maps a friendly label to a provider + that provider's   //
//  own model id. Add/remove lines here to change what's offered; the  //
//  picker only shows models whose provider has a key configured.      //
// ------------------------------------------------------------------ //

export type ProviderId = 'groq' | 'gemini';

export interface ModelSpec {
  id: string; // stable id used by the picker & localStorage
  label: string; // shown in the dropdown
  provider: ProviderId;
  model: string; // the id the provider's API expects
}

export const MODELS: ModelSpec[] = [
  { id: 'groq-llama-3.3-70b', label: 'Llama 3.3 70B · Groq', provider: 'groq', model: 'llama-3.3-70b-versatile' },
  { id: 'groq-llama-3.1-8b', label: 'Llama 3.1 8B · Groq (fast)', provider: 'groq', model: 'llama-3.1-8b-instant' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash · Google', provider: 'gemini', model: 'gemini-2.5-flash' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash · Google', provider: 'gemini', model: 'gemini-2.0-flash' },
];

export const DEFAULT_MODEL_ID = MODELS[0].id;

/** Which env var each provider needs — used for helpful "not configured" hints. */
export const PROVIDER_ENV_HINT: Record<ProviderId, string> = {
  groq: 'VITE_GROQ_API_KEY',
  gemini: 'VITE_GEMINI_API_KEY',
};

export const findModel = (id: string): ModelSpec | undefined => MODELS.find((m) => m.id === id);
