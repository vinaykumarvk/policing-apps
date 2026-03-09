import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@puda/shared";
import { apiBaseUrl } from "../types";
import EmptyState from "../components/EmptyState";
import { StackedBarChart, MiniBarChart, TrendLineChart } from "../charts";

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean; onNavigate: (view: string) => void };

type PendencyStage = {
  state_id: string; count: number; avg_hours: number; min_hours: number; max_hours: number;
  bucket_0_4h: number; bucket_4_12h: number; bucket_12_24h: number;
  bucket_1_3d: number; bucket_3_7d: number; bucket_7d_plus: number;
};

const AGING_COLORS = {
  "0-4h": "#10b981", "4-12h": "#3b82f6", "12-24h": "#f59e0b",
  "1-3d": "#ef4444", "3-7d": "#dc2626", "7d+": "#991b1b",
};

export default function PendencyDashboard({ authHeaders, isOffline, onNavigate }: Props) {
  const { t } = useTranslation();
  const [entityType, setEntityType] = useState<"alerts" | "cases">("alerts");
  const [stages, setStages] = useState<PendencyStage[]>([]);
  const [trends, setTrends] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    if (isOffline) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const dateFrom = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    Promise.all([
      fetch(`${apiBaseUrl}/api/v1/dashboard/pendency?entityType=${entityType}`, authHeaders()).then(r => r.ok ? r.json() : null),
      fetch(`${apiBaseUrl}/api/v1/dashboard/trends?metric=${entityType}&dateFrom=${dateFrom}&granularity=daily`, authHeaders()).then(r => r.ok ? r.json() : null),
    ])
      .then(([pendData, trendData]) => {
        if (pendData) setStages(pendData.stages || []);
        if (trendData) {
          // Pivot trend rows into bucketed data
          const byBucket = new Map<string, Record<string, number>>();
          for (const r of (trendData.trends || []) as { bucket: string; breakdown: string; count: number }[]) {
            const key = r.bucket?.slice(0, 10) || "";
            if (!byBucket.has(key)) byBucket.set(key, {});
            byBucket.get(key)![r.breakdown] = r.count;
          }
          setTrends([...byBucket.entries()].map(([bucket, vals]) => ({ bucket, total: Object.values(vals).reduce((s, v) => s + v, 0), ...vals })));
        }
      })
      .catch(err => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [authHeaders, isOffline, entityType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="loading-center">{t("common.loading")}</div>;

  const totalOpen = stages.reduce((s, p) => s + p.count, 0);

  // Find bottleneck — stage with longest avg dwell time
  const bottleneck = stages.length > 0
    ? stages.reduce((worst, s) => (parseFloat(String(s.avg_hours)) > parseFloat(String(worst.avg_hours)) ? s : worst))
    : null;

  // Stage distribution for stacked bar
  const stageBarData = stages.map(s => ({
    label: s.state_id.replace(/_/g, " "),
    "0-4h": s.bucket_0_4h || 0,
    "4-12h": s.bucket_4_12h || 0,
    "12-24h": s.bucket_12_24h || 0,
    "1-3d": s.bucket_1_3d || 0,
    "3-7d": s.bucket_3_7d || 0,
    "7d+": s.bucket_7d_plus || 0,
  }));

  const agingSegments = Object.entries(AGING_COLORS).map(([key, color]) => ({ key, color, label: key }));

  // Aggregate aging across all stages
  const alertAging = [
    { label: "0-4h", value: stages.reduce((s, p) => s + (p.bucket_0_4h || 0), 0), color: AGING_COLORS["0-4h"] },
    { label: "4-12h", value: stages.reduce((s, p) => s + (p.bucket_4_12h || 0), 0), color: AGING_COLORS["4-12h"] },
    { label: "12-24h", value: stages.reduce((s, p) => s + (p.bucket_12_24h || 0), 0), color: AGING_COLORS["12-24h"] },
    { label: "1-3d", value: stages.reduce((s, p) => s + (p.bucket_1_3d || 0), 0), color: AGING_COLORS["1-3d"] },
    { label: "3-7d", value: stages.reduce((s, p) => s + (p.bucket_3_7d || 0), 0), color: AGING_COLORS["3-7d"] },
    { label: "7d+", value: stages.reduce((s, p) => s + (p.bucket_7d_plus || 0), 0), color: AGING_COLORS["7d+"] },
  ];

  return (
    <>
      <div className="page__header">
        <h1>{t("dashboard.pendency_title")}</h1>
        <p className="subtitle">{t("dashboard.pendency_subtitle")}</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Entity type tabs */}
      <div className="tab-bar" style={{ marginBottom: "var(--space-4)" }}>
        <button type="button" className={`tab-btn ${entityType === "alerts" ? "tab-btn--active" : ""}`} onClick={() => setEntityType("alerts")}>
          {t("dashboard.alerts")} <span className="tab-btn__count">{entityType === "alerts" ? totalOpen : ""}</span>
        </button>
        <button type="button" className={`tab-btn ${entityType === "cases" ? "tab-btn--active" : ""}`} onClick={() => setEntityType("cases")}>
          {t("dashboard.cases_col")} <span className="tab-btn__count">{entityType === "cases" ? totalOpen : ""}</span>
        </button>
      </div>

      {/* Row 1: Stage-wise Distribution */}
      <div className="chart-section" style={{ marginBottom: "var(--space-4)" }}>
        <h2 className="chart-section__title">{t("dashboard.stage_distribution")}</h2>
        <StackedBarChart data={stageBarData} segments={agingSegments} height={280} />
      </div>

      {/* Row 2: Aging Buckets */}
      <div className="dashboard-row dashboard-row--2col">
        <div className="chart-section">
          <h2 className="chart-section__title">{t("dashboard.aging_histogram")}</h2>
          <MiniBarChart data={alertAging} height={220} />
        </div>

        {/* Bottleneck Identifier */}
        <div className="chart-section">
          <h2 className="chart-section__title">{t("dashboard.bottleneck")}</h2>
          {bottleneck ? (
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="stat-card" style={{ borderColor: "var(--color-danger)", borderWidth: "2px" }}>
                <p className="stat-card__label">{t("dashboard.slowest_stage")}</p>
                <p className="stat-card__value" style={{ fontSize: "1.25rem" }}>{bottleneck.state_id.replace(/_/g, " ")}</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
                <div className="stat-card">
                  <p className="stat-card__label">{t("dashboard.avg_dwell")}</p>
                  <p className="stat-card__value" style={{ fontSize: "1.1rem" }}>{parseFloat(String(bottleneck.avg_hours)).toFixed(1)}h</p>
                </div>
                <div className="stat-card">
                  <p className="stat-card__label">{t("dashboard.items_stuck")}</p>
                  <p className="stat-card__value" style={{ fontSize: "1.1rem" }}>{bottleneck.count}</p>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState icon="chart" title={t("common.no_data")} />
          )}
        </div>
      </div>

      {/* Row 3: Backlog Trend */}
      <div className="chart-section" style={{ marginTop: "var(--space-4)" }}>
        <h2 className="chart-section__title">{t("dashboard.backlog_trend")}</h2>
        <TrendLineChart
          data={trends}
          series={[{ key: "total", color: "#3b82f6", label: t("dashboard.open_items") }]}
          height={260}
        />
      </div>
    </>
  );
}
