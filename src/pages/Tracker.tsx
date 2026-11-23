import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { db } from '../lib/db';
import { useCollection } from '../hooks/useStore';
import { useChartColors } from '../hooks/useChartColors';
import {
  activityEmoji,
  fmtMinutes,
  parseActivityLog,
  saveSessions,
  sessionKey,
  type ParseResult,
} from '../lib/activityLog';
import { calendarSyncAvailable, syncSessionsToCalendar } from '../lib/gcal';
import { IS_ARTIFACT } from '../lib/runtime';
import { Badge, Button, EmptyState, IconButton, Panel, SectionHeader, StatCard, Textarea } from '../components/ui';
import { Icon } from '../components/Icon';
import type { ActivitySession } from '../types';

const byStartDesc = (a: ActivitySession, b: ActivitySession) => b.start.localeCompare(a.start);
const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const DAYS = 14;

export function Tracker() {
  const sessions = useCollection('activities', byStartDesc);
  const c = useChartColors();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed: ParseResult | null = useMemo(() => (text.trim() ? parseActivityLog(text) : null), [text]);
  const existing = useMemo(() => new Set(sessions.map((s) => sessionKey(s.activity, s.start))), [sessions]);
  const fresh = parsed?.sessions.filter((s) => !existing.has(s.key)) ?? [];

  const activities = useMemo(() => [...new Set(sessions.map((s) => s.activity))].sort(), [sessions]);
  const pendingSync = sessions.filter((s) => !s.gcalEventId);

  // Minutes per activity per day, last 14 days (stacked bar).
  const daily = useMemo(() => {
    const rows: Record<string, Record<string, number | string>> = {};
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const k = dayKey(d.toISOString());
      rows[k] = { day: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) };
    }
    for (const s of sessions) {
      const r = rows[dayKey(s.start)];
      if (r) r[s.activity] = (Number(r[s.activity]) || 0) + s.durationMin;
    }
    return Object.values(rows);
  }, [sessions]);

  // Per-activity totals: last 7 days, last 30 days, average session.
  const totals = useMemo(() => {
    const now = Date.now();
    return activities.map((a) => {
      const list = sessions.filter((s) => s.activity === a);
      const within = (days: number) => list.filter((s) => now - new Date(s.start).getTime() < days * 86_400_000);
      const sum = (l: ActivitySession[]) => l.reduce((m, s) => m + s.durationMin, 0);
      const w = within(7);
      const m = within(30);
      return {
        activity: a,
        week: sum(w),
        weekCount: w.length,
        month: sum(m),
        perDay30: sum(m) / 30,
        avg: list.length ? sum(list) / list.length : 0,
        count: list.length,
      };
    });
  }, [sessions, activities]);

  async function saveAndSync() {
    if (!parsed?.sessions.length) return;
    setBusy(true);
    setStatus(null);
    try {
      const { added, duplicates } = await saveSessions(parsed.sessions);
      const sync = added.length ? await syncSessionsToCalendar(added) : null;
      setStatus(
        [`Saved ${added.length} session${added.length === 1 ? '' : 's'}`, duplicates ? `${duplicates} already logged` : '', sync?.summary]
          .filter(Boolean)
          .join(' · '),
      );
      if (added.length || duplicates) setText('');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function syncPending() {
    setBusy(true);
    const r = await syncSessionsToCalendar(pendingSync);
    setStatus(r.summary);
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {totals.slice(0, 4).map((t) => (
          <StatCard
            key={t.activity}
            label={`${activityEmoji(t.activity)} ${t.activity} · 7 days`}
            value={fmtMinutes(t.week)}
            sub={`${t.weekCount} sessions · avg ${fmtMinutes(t.avg)}`}
            icon="clock"
          />
        ))}
        {totals.length === 0 && <StatCard label="Tracked activities" value="0" sub="Paste a log below to start" icon="clock" />}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel className="p-5 lg:col-span-2">
          <SectionHeader title="Paste a log" subtitle="Heading line, then DD.MM.YY - 30min (4:25PM)" />
          <Textarea
            rows={9}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Time in Toilet\n23.11.26 - 30min (4:25PM)\n18.11.26 - 55min (4:50PM) and 45min (10:25PM)\n\nShower\n23.11.26 - 15min (9:10AM)'}
            className="input-base w-full font-mono text-xs"
          />
          {parsed && (
            <div className="mt-3 space-y-1 text-xs">
              <div className="text-muted">
                {parsed.sessions.length} read · <span className="text-success">{fresh.length} new</span>
                {parsed.sessions.length - fresh.length > 0 && ` · ${parsed.sessions.length - fresh.length} already logged`}
              </div>
              {parsed.errors.map((e, i) => (
                <div key={i} className="truncate text-danger" title={e}>⚠ {e}</div>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={saveAndSync} disabled={busy || !fresh.length}>
              <Icon name="plus" size={16} /> Save{calendarSyncAvailable() ? ' & add to Calendar' : ''}
            </Button>
            {pendingSync.length > 0 && calendarSyncAvailable() && (
              <Button variant="ghost" onClick={syncPending} disabled={busy}>
                Sync {pendingSync.length} pending
              </Button>
            )}
          </div>
          {status && <p className="mt-2 text-xs text-muted">{status}</p>}
          {!calendarSyncAvailable() && (
            <p className="mt-3 text-[11px] text-muted">
              {IS_ARTIFACT
                ? 'Google Calendar sync turns on once the Google Calendar connector is connected on claude.ai.'
                : 'Google Calendar sync runs in the claude.ai artifact version of Jarvis.'}{' '}
              Tip: you can also paste a log into the Jarvis chat.
            </p>
          )}
        </Panel>

        <Panel className="p-5 lg:col-span-3">
          <SectionHeader title="Minutes per day" subtitle={`Last ${DAYS} days`} />
          {sessions.length === 0 ? (
            <EmptyState icon="clock" text="No sessions yet" />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke={c.grid} vertical={false} />
                  <XAxis dataKey="day" stroke={c.muted} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis stroke={c.muted} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: c.grid }}
                    formatter={(v, n) => [`${Number(v)} min`, String(n)]}
                    contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 10, color: c.text, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: c.muted }} />
                  {activities.map((a, i) => (
                    <Bar key={a} dataKey={a} stackId="m" fill={c.palette[i % c.palette.length]} radius={i === activities.length - 1 ? [4, 4, 0, 0] : 0} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      {totals.length > 0 && (
        <Panel className="p-5">
          <SectionHeader title="Totals" subtitle="Per activity" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-2 pr-4 font-normal">Activity</th>
                  <th className="py-2 pr-4 font-normal">Last 7 days</th>
                  <th className="py-2 pr-4 font-normal">Last 30 days</th>
                  <th className="py-2 pr-4 font-normal">Per day (30d)</th>
                  <th className="py-2 pr-4 font-normal">Avg session</th>
                  <th className="py-2 font-normal">Sessions</th>
                </tr>
              </thead>
              <tbody className="text-text">
                {totals.map((t) => (
                  <tr key={t.activity} className="border-t border-border/50">
                    <td className="py-2 pr-4">{activityEmoji(t.activity)} {t.activity}</td>
                    <td className="py-2 pr-4">{fmtMinutes(t.week)}</td>
                    <td className="py-2 pr-4">{fmtMinutes(t.month)}</td>
                    <td className="py-2 pr-4">{fmtMinutes(t.perDay30)}</td>
                    <td className="py-2 pr-4">{fmtMinutes(t.avg)}</td>
                    <td className="py-2">{t.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel className="p-5">
        <SectionHeader title="Sessions" subtitle={`${sessions.length} logged`} />
        {sessions.length === 0 ? (
          <EmptyState icon="clock" text="Nothing logged yet" />
        ) : (
          <ul className="space-y-1.5">
            {sessions.slice(0, 60).map((s) => (
              <li key={s.id} className="group flex items-center gap-3 rounded-lg border border-border/60 bg-panel/40 px-3 py-2">
                <span className="w-6 text-center">{activityEmoji(s.activity) || '•'}</span>
                <div className="min-w-0 flex-1 text-sm text-text">
                  {s.activity} <span className="text-muted">· {fmtMinutes(s.durationMin)}</span>
                  <div className="text-xs text-muted">
                    {new Date(s.start).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
                <Badge tone={s.gcalEventId ? 'success' : 'muted'}>{s.gcalEventId ? 'in calendar' : 'not synced'}</Badge>
                <IconButton
                  icon="trash"
                  size={14}
                  onClick={() => db.activities.remove(s.id)}
                  aria-label="Delete session"
                  className="opacity-0 transition group-hover:opacity-100"
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
