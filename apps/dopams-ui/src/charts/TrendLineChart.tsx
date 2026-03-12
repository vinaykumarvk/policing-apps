import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Area, AreaChart } from "recharts";

type SeriesDef = { key: string; color: string; label: string };
type Props = { data: Record<string, unknown>[]; series: SeriesDef[]; height?: number; areaFill?: boolean };

export default function TrendLineChart({ data, series, height = 280, areaFill = false }: Props) {
  if (!data.length) return null;
  const Chart = areaFill ? AreaChart : LineChart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Legend />
        {series.map((s) =>
          areaFill ? (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} fill={s.color} fillOpacity={0.15} strokeWidth={2} />
          ) : (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} />
          )
        )}
      </Chart>
    </ResponsiveContainer>
  );
}
