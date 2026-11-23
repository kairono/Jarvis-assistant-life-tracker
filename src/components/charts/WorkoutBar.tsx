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
  sets: number;
  count: number;
  volume: number;
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
            formatter={(v, _n, item) => {
              const row = item?.payload as Row | undefined;
              return [
                `${Number(v)} sets · ${row?.count ?? 0} sessions · ${((row?.volume ?? 0) / 1000).toFixed(1)} t`,
                'Week',
              ];
            }}
            contentStyle={{
              background: c.tooltipBg,
              border: `1px solid ${c.tooltipBorder}`,
              borderRadius: 10,
              color: c.text,
              fontSize: 12,
            }}
          />
          <Bar dataKey="sets" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={c.accent} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
