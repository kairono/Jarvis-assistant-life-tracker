import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useChartColors } from '../../hooks/useChartColors';

interface Row {
  week: string;
  minutes: number;
  count: number;
}

export function WorkoutBar({ data }: { data: Row[] }) {
  const c = useChartColors();
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="week" stroke={c.muted} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis stroke={c.muted} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: c.grid }}
            formatter={(v, _n, item) => [
              `${Number(v)} min · ${(item?.payload as Row | undefined)?.count ?? 0} sessions`,
              'Volume',
            ]}
            contentStyle={{
              background: c.tooltipBg,
              border: `1px solid ${c.tooltipBorder}`,
              borderRadius: 10,
              color: c.text,
              fontSize: 12,
            }}
          />
          <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={c.accent} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
