import { LineChart, Line, ResponsiveContainer } from "recharts";

type Props = { data: number[]; color?: string; width?: number; height?: number };

export default function Sparkline({ data, color = "var(--color-brand)", width = 80, height = 28 }: Props) {
  if (!data.length) return null;
  const chartData = data.map((v, i) => ({ v, i }));
  return (
    <div style={{ width, height, display: "inline-block" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
