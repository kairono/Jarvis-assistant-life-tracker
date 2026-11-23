import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useChartColors } from '../../hooks/useChartColors';
import { money } from '../../lib/format';

interface Row {
  month: string;
  income: number;
  expense: number;
}

export function IncomeExpenseLine({ data }: { data: Row[] }) {
  const c = useChartColors();
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="month" stroke={c.muted} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis
            stroke={c.muted}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : `${v}`)}
          />
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
          <Legend wrapperStyle={{ fontSize: 12, color: c.muted }} />
          <Line type="monotone" dataKey="income" name="Income" stroke={c.success} strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="expense" name="Expense" stroke={c.danger} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
