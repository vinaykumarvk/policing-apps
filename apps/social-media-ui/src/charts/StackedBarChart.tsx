import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

type SegmentDef = { key: string; color: string; label: string };
type Props = { data: Record<string, unknown>[]; segments: SegmentDef[]; height?: number; labelKey?: string };

export default function StackedBarChart({ data, segments, height = 300, labelKey = "label" }: Props) {
  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Legend />
        {segments.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} stackId="stack" fill={s.color} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
