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
  /** The user's personal profile as a single-line JSON string. */
  readonly VITE_USER_PROFILE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
