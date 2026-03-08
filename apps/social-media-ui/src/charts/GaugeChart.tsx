type Props = { value: number; max: number; color: string; label: string };

export default function GaugeChart({ value, max, color, label }: Props) {
  const pct = Math.min(100, Math.max(0, (value / Math.max(1, max)) * 100));
  return (
    <div className="gauge">
      <div
        className="gauge__ring"
        style={{
          background: `conic-gradient(${color} ${pct * 3.6}deg, var(--color-bg-elevated) 0deg)`,
        }}
      >
        <div className="gauge__inner">
          <span className="gauge__value">{Math.round(pct)}%</span>
        </div>
      </div>
      <span className="gauge__label">{label}</span>
    </div>
  );
}
