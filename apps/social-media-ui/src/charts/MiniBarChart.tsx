import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

type BarDatum = { label: string; value: number; color?: string };
type Props = { data: BarDatum[]; height?: number };

export default function MiniBarChart({ data, height = 200 }: Props) {
  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 80 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={80} />
        <Tooltip formatter={(v: number) => v.toLocaleString()} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color || "var(--color-brand)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
