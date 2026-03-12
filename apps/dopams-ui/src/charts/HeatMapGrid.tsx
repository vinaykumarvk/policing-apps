type Props = {
  rows: string[];
  columns: string[];
  values: number[][];
  colorScale?: { low: string; high: string };
};

export default function HeatMapGrid({
  rows, columns, values,
  colorScale = { low: "#dbeafe", high: "#1e40af" },
}: Props) {
  if (!rows.length || !columns.length) return null;
  const flat = values.flat();
  const maxVal = Math.max(1, ...flat);

  const cellColor = (val: number) => {
    const t = val / maxVal;
    return `color-mix(in srgb, ${colorScale.high} ${Math.round(t * 100)}%, ${colorScale.low})`;
  };

  return (
    <div className="heatmap" style={{ overflowX: "auto" }}>
      <table className="heatmap__table">
        <thead>
          <tr>
            <th className="heatmap__corner" />
            {columns.map((c) => (
              <th key={c} className="heatmap__col-header">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r}>
              <th className="heatmap__row-header">{r}</th>
              {columns.map((c, ci) => {
                const val = values[ri]?.[ci] ?? 0;
                return (
                  <td
                    key={c}
                    className="heatmap__cell"
                    style={{ background: val > 0 ? cellColor(val) : "transparent" }}
                    title={`${r} × ${c}: ${val}`}
                  >
                    {val > 0 ? val : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
