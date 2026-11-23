/// <reference types="vite/client" />

// Typed access to the env vars this app reads via `import.meta.env`.
// Only VITE_-prefixed vars are exposed to the client bundle by Vite.
interface ImportMetaEnv {
  /** Anthropic API key powering the JARVIS assistant. */
  readonly VITE_ANTHROPIC_API_KEY?: string;
  /** Anthropic model id (optional; sensible default if blank). */
  readonly VITE_ANTHROPIC_MODEL?: string;
  /** Google OAuth client id for Calendar integration. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** Groq API key (free) — powers the Llama models in the chat picker. */
  readonly VITE_GROQ_API_KEY?: string;
  /** Google Gemini API key (free) — powers the Gemini models in the picker. */
  readonly VITE_GEMINI_API_KEY?: string;
  /** Override the Gemini Live (voice) model id if auto-discovery picks wrong. */
  readonly VITE_GEMINI_LIVE_MODEL?: string;
  /** Override the Gemini Live API version (v1beta / v1alpha) for the override model. */
  readonly VITE_GEMINI_LIVE_API_VERSION?: string;
  /** The user's personal profile as a single-line JSON string. */
  readonly VITE_USER_PROFILE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
