type Stage = { label: string; count: number; color: string; avgHours?: number };
type Props = { stages: Stage[] };

export default function FunnelChart({ stages }: Props) {
  if (!stages.length) return null;
  const maxCount = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className="funnel-chart">
      {stages.map((s, i) => (
        <div className="funnel-chart__stage" key={i}>
          <div className="funnel-chart__bar-wrap">
            <div
              className="funnel-chart__bar"
              style={{ width: `${Math.max(8, (s.count / maxCount) * 100)}%`, background: s.color }}
            >
              <span className="funnel-chart__count">{s.count}</span>
            </div>
          </div>
          <div className="funnel-chart__meta">
            <span className="funnel-chart__label">{s.label}</span>
            {s.avgHours != null && (
              <span className="funnel-chart__hours">{s.avgHours.toFixed(1)}h avg</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
