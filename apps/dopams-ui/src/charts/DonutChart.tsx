import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

type Slice = { name: string; value: number; color?: string };
type Props = { data: Slice[]; height?: number; innerRadius?: number };

const COLORS = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

export default function DonutChart({ data, height = 260, innerRadius = 55 }: Props) {
  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={innerRadius} outerRadius={90} paddingAngle={2}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color || COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => v.toLocaleString()} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
