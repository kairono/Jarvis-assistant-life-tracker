import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useChartColors } from '../../hooks/useChartColors';
import type { ExerciseHistory } from '../../lib/analytics';
import { shortDate } from '../../lib/format';

/** Top-set weight per session for one exercise. */
export function ExerciseProgress({ history }: { history: ExerciseHistory }) {
  const c = useChartColors();
  const data = history.sessions.map((s) => ({ ...s, label: shortDate(s.date) }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="label" stroke={c.muted} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis stroke={c.muted} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} unit=" kg" width={60} />
          <Tooltip
            formatter={(v, _n, item) => [`${Number(v)} kg × ${(item?.payload as { topReps?: number })?.topReps ?? 0}`, 'Top set']}
            contentStyle={{
              background: c.tooltipBg,
              border: `1px solid ${c.tooltipBorder}`,
              borderRadius: 10,
              color: c.text,
              fontSize: 12,
            }}
          />
          <Line type="monotone" dataKey="topKg" stroke={c.accent} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
