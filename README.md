# JARVIS — Personal Life Assistant

A private, single-user "Jarvis" that knows your life and helps you run it. It
brings your **finances, training, goals, vision board, tasks, and calendar**
into one HUD-style dashboard, and (with an API key) lets you ask questions about
your own data in natural language — typed or spoken.

Runs **entirely locally** in your browser. No auth, no cloud backend, no
multi-user. Data lives in IndexedDB. The architecture is deliberately seamed so
storage can later move to Supabase and the AI layer to a local LLM without
rewriting the UI.

---

## Quick start

```bash
npm install
cp .env.example .env     # optional — only needed for the AI assistant
npm run dev              # http://localhost:5173
```

The app seeds itself with sample data on first run, so the dashboard is
populated immediately. To start clean, go to **Settings → Data → Clear all data**.

### Environment (`.env`)

All keys are optional for Phase 1–2 — the app is fully usable without them.

| Variable | Purpose |
| --- | --- |
| `VITE_GROQ_API_KEY` | **Free.** Enables the Groq (Llama) models in the chat picker. Get one at [console.groq.com](https://console.groq.com/keys). |
| `VITE_GEMINI_API_KEY` | **Free.** Enables the Google Gemini models in the chat picker. Get one at [aistudio.google.com](https://aistudio.google.com/app/apikey). |
| `VITE_ANTHROPIC_API_KEY` | (Paid) Anthropic Claude — provider class still ships in `src/lib/ai/ClaudeProvider.ts` but isn't in the picker by default. |
| `VITE_ANTHROPIC_MODEL` | Claude model id (defaults to `claude-sonnet-4-6`). |
| `VITE_GOOGLE_CLIENT_ID` | Google Calendar sync (Phase 3, not built yet). |
| `VITE_USER_PROFILE` | The person's whole profile as single-line JSON (name, health, finance, prefs) — the baseline JARVIS reads so it knows who it's helping. See `.env.example` for the shape and `src/lib/profile.ts` for the typed model. You can also view/edit the profile live in **Settings → Profile**, which saves a local override to IndexedDB (the env value is the fallback). |

> 🔒 `.env` is git-ignored, so your API keys **and** your personal profile in
> `VITE_USER_PROFILE` are never committed or pushed to GitHub. Only
> `.env.example` (with placeholder values) is tracked.

> ⚠️ Every provider calls its API directly from the browser, which exposes the
> key in the client. Fine for a local single-user setup, but **move it behind a
> small proxy before any deployment**. Because every AI call funnels through
> `aiClient` (which picks a provider by model id), that's a contained change.
>
> To add another backend (OpenRouter, Mistral, local Ollama, …), register a
> provider in `src/lib/ai/aiClient.ts` and add entries to `src/lib/ai/models.ts` —
> most speak the OpenAI-compatible format, so they reuse `OpenAiCompatibleProvider`.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server with hot reload. |
| `npm run build` | Type-check and build for production. |
| `npm run preview` | Preview the production build. |
| `npm run lint` | Run oxlint. |

---

## Personalization

**Settings → Theme / Accent / Font** re-skins the whole app live:

- **5 themes** — Jarvis (cyan HUD, default), Midnight, Crimson, Matrix, Daylight.
- **Accent color** — preset swatches or a custom hex; recolors charts, buttons,
  and the animated core.
- **Font** — Inter, System, Rajdhani, Space Grotesk, or JetBrains Mono.

Choices persist in `localStorage`. The theme is driven by CSS variables on
`<html>` (see `src/theme/`), so adding a new preset is just another entry in
`src/theme/themes.ts`.

---

## Architecture

```
src/
├── types.ts                 Domain model (Transaction, Workout, Goal, …)
├── nav.ts                   View list + titles
├── theme/                   Theme presets + ThemeContext (CSS-variable theming)
├── lib/
│   ├── db/
│   │   ├── DataStore.ts      ← storage INTERFACE (the seam)
│   │   ├── IndexedDbStore.ts ← Dexie implementation (current)
│   │   ├── schema.ts         Dexie tables/indexes
│   │   ├── seed.ts           Sample data
│   │   └── index.ts          exports `db` — the single swap point
│   ├── ai/
│   │   ├── AiProvider.ts      ← AI INTERFACE (the seam)
│   │   ├── ClaudeProvider.ts  ← Anthropic implementation (current)
│   │   ├── systemPrompt.ts    Jarvis's personality (edit freely)
│   │   ├── context.ts         "Context selector" — packs only relevant data
│   │   └── aiClient.ts        exports `aiClient` — the single swap point
│   ├── analytics.ts          Pure aggregations for charts
│   └── format.ts             Money / date helpers
├── hooks/                   useStore (live data), useSpeech, useChartColors
├── components/              Icon, JarvisCore, ui primitives, charts, layout, assistant
└── pages/                   Dashboard, Finances, Training, Goals, Tasks, VisionBoard, Calendar, Settings
```

**Two seams keep migrations cheap:**

1. **Storage** — the UI only touches the `DataStore` interface via `db`. Swap
   `IndexedDbStore` for a future `SupabaseStore` in `src/lib/db/index.ts` (one
   line); no UI changes.
2. **AI** — all inference goes through `AiProvider.ask()` via `aiClient`. Drop in
   a `LocalLlmProvider` in `src/lib/ai/aiClient.ts` to change the backend.

---

## Build phases

| Phase | Status | What it adds |
| --- | --- | --- |
| **1 — Foundation + dashboard** | ✅ Done | Vite/React/TS/Tailwind scaffold, Dexie store behind `DataStore`, app shell, Jarvis-UI dashboard with charts and seeded data. |
| **2 — Domain modules (CRUD)** | ✅ Done | Finances (+ pie & income/expense charts), Training (+ volume chart), Goals (+ milestones), Tasks (quick-add, priorities, due dates), Vision board (drag + image upload). |
| **Extras this session** | ✅ Done | Theme/accent/font personalization, a working AI assistant panel with voice in/out (Phases 4–5, degrade gracefully without a key). |
| **3 — Google Calendar** | ⏳ Next | OAuth 2.0, pull/push events, calendar view. (Local events + view already in place.) |
| **4 — AI assistant** | ◑ Scaffolded | Abstraction + panel + context selector built; refine context & actions. |
| **5 — Voice** | ◑ Scaffolded | Web Speech mic input + spoken replies, with feature-detection fallback. |

---

## Notes

- **Storage:** IndexedDB via Dexie. Clearing browser data wipes everything.
- **Charts:** Recharts, themed from the active palette.
- **Voice:** Uses the browser's Web Speech API; unsupported browsers simply hide
  the mic/speaker controls.
