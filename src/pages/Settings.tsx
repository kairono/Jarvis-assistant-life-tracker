import { useState } from 'react';
import { db } from '../lib/db';
import { useTheme } from '../theme/ThemeContext';
import { ACCENTS, FONTS, THEMES, hexToTriplet, tripletToHex } from '../theme/themes';
import { aiClient } from '../lib/ai/aiClient';
import { downloadExport } from '../lib/exportData';
import { Badge, Button, Panel, SectionHeader } from '../components/ui';
import { Icon } from '../components/Icon';
import { JarvisCore } from '../components/JarvisCore';
import { ProfilePanel } from '../components/ProfilePanel';

const rgb = (t: string) => `rgb(${t.split(/\s+/).join(', ')})`;

export function Settings() {
  const theme = useTheme();
  const activeTheme = THEMES.find((t) => t.id === theme.themeId) ?? THEMES[0];
  const activeAccent = theme.accent ?? activeTheme.vars.accent;
  const [confirmReset, setConfirmReset] = useState<null | 'clear' | 'sample'>(null);

  async function runReset(kind: 'clear' | 'sample') {
    if (kind === 'sample') {
      await db.resetToSample();
    } else {
      // A full clear also tombstones the profile so it isn't re-seeded from the
      // env baseline on the next load.
      await db.reset();
      await db.deleteProfile();
    }
    setConfirmReset(null);
  }

  return (
    <div className="space-y-6">
      {/* Profile — the person's whole data */}
      <ProfilePanel />

      {/* Theme presets */}
      <Panel className="p-5">
        <SectionHeader title="Theme" subtitle="Pick a base look — the whole app re-skins instantly" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {THEMES.map((t) => {
            const active = t.id === theme.themeId;
            return (
              <button
                key={t.id}
                onClick={() => theme.setThemeId(t.id)}
                className={`rounded-xl border p-3 text-left transition ${
                  active ? 'border-accent shadow-glow-sm' : 'border-border hover:border-accent/50'
                }`}
                style={{ background: rgb(t.vars.surface) }}
              >
                <div className="mb-2 flex items-center gap-1.5">
                  {[t.vars.accent, t.vars.accent2, t.vars.text].map((v, i) => (
                    <span key={i} className="h-4 w-4 rounded-full" style={{ background: rgb(v) }} />
                  ))}
                  {active && <Icon name="check" size={14} style={{ color: rgb(t.vars.accent) }} className="ml-auto" />}
                </div>
                <div className="text-sm font-medium" style={{ color: rgb(t.vars.text) }}>{t.name}</div>
                <div className="mt-0.5 text-[11px]" style={{ color: rgb(t.vars.muted) }}>{t.blurb}</div>
              </button>
            );
          })}
        </div>
      </Panel>

      {/* Accent color */}
      <Panel className="p-5">
        <SectionHeader title="Accent color" subtitle="Override the highlight color used across charts, buttons & the core" />
        <div className="flex flex-wrap items-center gap-2">
          {ACCENTS.map((a) => {
            const active = theme.accent === a.rgb;
            return (
              <button
                key={a.name}
                onClick={() => theme.setAccent(a.rgb)}
                title={a.name}
                className={`h-9 w-9 rounded-full border-2 transition ${active ? 'scale-110 border-text' : 'border-transparent hover:scale-105'}`}
                style={{ background: rgb(a.rgb) }}
              />
            );
          })}
          <label className="ml-1 flex cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm text-muted hover:border-accent/50">
            <span
              className="h-5 w-5 rounded-full border border-border"
              style={{ background: rgb(activeAccent) }}
            />
            Custom
            <input
              type="color"
              value={tripletToHex(activeAccent)}
              onChange={(e) => {
                const t = hexToTriplet(e.target.value);
                if (t) theme.setAccent(t);
              }}
              className="h-0 w-0 opacity-0"
            />
          </label>
          {theme.accent && (
            <Button variant="ghost" onClick={() => theme.setAccent(null)} className="text-xs">
              Use theme default
            </Button>
          )}
          <div className="ml-auto">
            <JarvisCore size={56} />
          </div>
        </div>
      </Panel>

      {/* Font */}
      <Panel className="p-5">
        <SectionHeader title="Font" subtitle="Sets the interface font throughout the app" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {FONTS.map((f) => {
            const active = f.id === theme.fontId;
            return (
              <button
                key={f.id}
                onClick={() => theme.setFontId(f.id)}
                style={{ fontFamily: f.stack }}
                className={`rounded-lg border px-3 py-3 text-center transition ${
                  active ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted hover:border-accent/50 hover:text-text'
                }`}
              >
                <div className="text-lg">Aa</div>
                <div className="mt-1 text-xs">{f.name}</div>
              </button>
            );
          })}
        </div>
      </Panel>

      {/* Assistant */}
      <Panel className="p-5">
        <SectionHeader
          title="Assistant"
          subtitle="Models Jarvis can use — pick one live in the chat panel"
        />
        <div className="space-y-2 text-sm">
          {aiClient.models.map((m) => {
            const ready = aiClient.isModelConfigured(m.id);
            return (
              <div key={m.id} className="flex items-center justify-between">
                <span className="text-text">{m.label}</span>
                {ready ? (
                  <Badge tone="success">Ready</Badge>
                ) : (
                  <Badge tone="muted">{aiClient.envHintFor(m.id)}</Badge>
                )}
              </div>
            );
          })}
          <p className="pt-2 text-xs text-muted">
            Add the API key shown next to a model to your{' '}
            <code className="font-mono text-text">.env</code> (then restart the dev server) to
            enable it — get free keys from{' '}
            <span className="text-text">console.groq.com</span> and{' '}
            <span className="text-text">aistudio.google.com</span>. Tune Jarvis's personality in{' '}
            <code className="font-mono text-text">src/lib/ai/systemPrompt.ts</code>.
          </p>
        </div>
      </Panel>

      {/* Data */}
      <Panel className="p-5">
        <SectionHeader title="Data" subtitle="Everything is stored locally in your browser (IndexedDB)" />
        {confirmReset ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-danger/40 bg-danger/10 p-3">
            <span className="text-sm text-text">
              {confirmReset === 'clear' ? 'Delete all data? This cannot be undone.' : 'Replace all data with the sample set?'}
            </span>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={() => setConfirmReset(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => runReset(confirmReset)}>Confirm</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => downloadExport()}>Export my data</Button>
            <Button variant="ghost" onClick={() => setConfirmReset('sample')}>Reset to sample data</Button>
            <Button variant="danger" onClick={() => setConfirmReset('clear')}>
              <Icon name="trash" size={15} /> Clear all data
            </Button>
            <Button variant="ghost" onClick={theme.reset} className="ml-auto">Reset personalization</Button>
          </div>
        )}
      </Panel>
    </div>
  );
}
