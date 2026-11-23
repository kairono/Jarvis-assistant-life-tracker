import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useChartColors } from '../../hooks/useChartColors';
import { money } from '../../lib/format';
import { EmptyState } from '../ui';
import type { NameValue } from '../../lib/analytics';

export function SpendingPie({ data }: { data: NameValue[] }) {
  const c = useChartColors();
  if (data.length === 0) return <EmptyState icon="wallet" text="No spending yet" />;

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-56 w-56 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={62}
              outerRadius={88}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={c.palette[i % c.palette.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => money(Number(v))}
              contentStyle={{
                background: c.tooltipBg,
                border: `1px solid ${c.tooltipBorder}`,
                borderRadius: 10,
                color: c.text,
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="label-tech">Total</span>
          <span className="font-display text-lg text-text text-glow">{money(total)}</span>
        </div>
      </div>

      <ul className="flex-1 space-y-1.5">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.palette[i % c.palette.length] }} />
            <span className="flex-1 text-muted">{d.name}</span>
            <span className="text-text">{money(d.value)}</span>
            <span className="w-10 text-right text-xs text-muted">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
