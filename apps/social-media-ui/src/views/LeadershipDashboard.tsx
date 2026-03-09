import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@puda/shared";
import { apiBaseUrl } from "../types";
import DashboardFilters, { FilterState, defaultFilters } from "../components/DashboardFilters";
import { TrendLineChart, DonutChart, FunnelChart, Sparkline, HeatMapGrid } from "../charts";

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean; onNavigate: (view: string) => void };

type Analytics = {
  alertTrends: { bucket: string; priority: string; count: number }[];
  caseStages: { state_id: string; count: number; avg_hours: number }[];
  alertStages: { state_id: string; count: number; avg_hours: number }[];
  categoryDistribution: { category: string; count: number }[];
  districtComparison: { district: string; unit_id: string; alert_count: number; case_count: number; breached: number }[];
  sla: { on_track: number; at_risk: number; breached: number };
  conversion: { total_alerts: number; converted: number };
  avgResolutionHours: number;
};

type HeatmapData = { districts: string[]; categories: string[]; values: number[][] };

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626", HIGH: "#ef4444", MEDIUM: "#f59e0b", LOW: "#3b82f6",
};

const STAGE_COLORS: Record<string, string> = {
  NEW: "#3b82f6", TRIAGED: "#8b5cf6", INVESTIGATING: "#f59e0b",
  ESCALATED: "#ef4444", CONVERTED_TO_CASE: "#10b981",
  ASSIGNED: "#8b5cf6", UNDER_INVESTIGATION: "#f59e0b",
  PENDING_REVIEW: "#06b6d4", CLOSED: "#6b7280",
};

const CATEGORY_COLORS = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

function pivotTrends(rows: { bucket: string; priority: string; count: number }[]) {
  const byBucket = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const key = r.bucket?.slice(0, 10) || "";
    if (!byBucket.has(key)) byBucket.set(key, {});
    byBucket.get(key)![r.priority] = r.count;
  }
  return [...byBucket.entries()].map(([bucket, vals]) => ({ bucket, ...vals }));
}

export default function LeadershipDashboard({ authHeaders, isOffline, onNavigate }: Props) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<FilterState>(() => ({ ...defaultFilters(), dateFrom: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10) }));
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    if (isOffline) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ dateFrom: filters.dateFrom, dateTo: filters.dateTo, granularity: filters.granularity });

    Promise.all([
      fetch(`${apiBaseUrl}/api/v1/dashboard/analytics?${params}`, authHeaders()).then(r => r.ok ? r.json() : null),
      fetch(`${apiBaseUrl}/api/v1/dashboard/heatmap?dateFrom=${filters.dateFrom}`, authHeaders()).then(r => r.ok ? r.json() : null),
    ])
      .then(([analyticsData, heatmapData]) => {
        if (analyticsData) setAnalytics(analyticsData);
        if (heatmapData) setHeatmap(heatmapData);
      })
      .catch(err => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [authHeaders, isOffline, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="loading-center">{t("common.loading")}</div>;

  const slaTotal = analytics ? analytics.sla.on_track + analytics.sla.at_risk + analytics.sla.breached : 0;
  const slaPct = slaTotal > 0 ? Math.round((analytics!.sla.on_track / slaTotal) * 100) : 0;
  const convPct = analytics?.conversion.total_alerts ? Math.round((analytics.conversion.converted / analytics.conversion.total_alerts) * 100) : 0;
  const totalAlerts = analytics?.alertStages.reduce((s, st) => s + st.count, 0) || 0;

  const trendData = analytics ? pivotTrends(analytics.alertTrends) : [];
  const trendSeries = Object.keys(PRIORITY_COLORS).map(p => ({ key: p, color: PRIORITY_COLORS[p], label: p }));

  const categoryData = (analytics?.categoryDistribution || []).slice(0, 8).map((c, i) => ({
    name: c.category, value: c.count, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  // Sparklines from trend data
  const alertSparkline = trendData.map(d => Object.values(d).reduce((sum, v) => sum + (typeof v === "number" ? v : 0), 0));

  // Case lifecycle funnel
  const caseFunnel = [
    { label: t("dashboard.funnel_alerts"), count: analytics?.conversion.total_alerts || 0, color: "#3b82f6" },
    { label: t("dashboard.funnel_cases"), count: analytics?.conversion.converted || 0, color: "#8b5cf6" },
    { label: t("dashboard.funnel_investigating"), count: analytics?.caseStages.find(s => s.state_id === "UNDER_INVESTIGATION")?.count || 0, color: "#f59e0b" },
    { label: t("dashboard.funnel_closed"), count: analytics?.caseStages.find(s => s.state_id === "CLOSED")?.count || 0, color: "#10b981" },
  ];

  return (
    <>
      <div className="page__header">
        <h1>{t("dashboard.leadership_title")}</h1>
        <p className="subtitle">{t("dashboard.leadership_subtitle")}</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <DashboardFilters value={filters} onChange={setFilters} authHeaders={authHeaders} />

      {/* Row 1: Executive KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: "var(--space-4)", gridTemplateColumns: "repeat(2, 1fr)" }}>
        <div className="stat-card">
          <p className="stat-card__label">{t("dashboard.total_alerts")}</p>
          <p className="stat-card__value">{totalAlerts}</p>
          <div className="stat-card__trend"><Sparkline data={alertSparkline} color="#3b82f6" /></div>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">{t("dashboard.conversion_rate")}</p>
          <p className="stat-card__value">{convPct}%</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">{t("dashboard.sla_compliance")}</p>
          <p className="stat-card__value" style={{ color: slaPct >= 80 ? "var(--color-success)" : slaPct >= 60 ? "var(--color-warning)" : "var(--color-danger)" }}>{slaPct}%</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">{t("dashboard.avg_resolution")}</p>
          <p className="stat-card__value">{analytics?.avgResolutionHours?.toFixed(1) || "\u2014"}h</p>
        </div>
      </div>

      {/* Row 2: Trend Analysis */}
      <div className="chart-section" style={{ marginBottom: "var(--space-4)" }}>
        <h2 className="chart-section__title">{t("dashboard.trend_analysis")}</h2>
        <TrendLineChart data={trendData} series={trendSeries} areaFill height={300} />
      </div>

      {/* Row 3: Comparison Panel */}
      <div className="dashboard-row dashboard-row--2col">
        <div className="chart-section">
          <h2 className="chart-section__title">{t("dashboard.district_ranking")}</h2>
          {analytics && analytics.districtComparison.length > 0 ? (
            <div className="table-scroll">
              <table className="entity-table entity-table--compact">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t("dashboard.district")}</th>
                    <th>{t("dashboard.alerts")}</th>
                    <th>{t("dashboard.cases_col")}</th>
                    <th>{t("dashboard.sla_col")}</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.districtComparison.map((d, i) => {
                    const dTotal = d.alert_count || 1;
                    const dSlaPct = Math.round(((dTotal - d.breached) / dTotal) * 100);
                    return (
                      <tr key={d.unit_id}>
                        <td data-label="#">{i + 1}</td>
                        <td data-label={t("dashboard.district")}>{d.district}</td>
                        <td data-label={t("dashboard.alerts")}>{d.alert_count}</td>
                        <td data-label={t("dashboard.cases_col")}>{d.case_count}</td>
                        <td data-label={t("dashboard.sla_col")}>
                          <span style={{ color: dSlaPct >= 80 ? "var(--color-success)" : dSlaPct >= 60 ? "var(--color-warning)" : "var(--color-danger)", fontWeight: 700 }}>
                            {dSlaPct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p style={{ color: "var(--color-text-muted)" }}>{t("common.no_data")}</p>}
        </div>
        <div className="chart-section">
          <h2 className="chart-section__title">{t("dashboard.category_distribution")}</h2>
          <DonutChart data={categoryData} />
        </div>
      </div>

      {/* Row 4: Category x District Heat Map */}
      {heatmap && heatmap.districts.length > 0 && (
        <div className="chart-section" style={{ marginTop: "var(--space-4)", marginBottom: "var(--space-4)" }}>
          <h2 className="chart-section__title">{t("dashboard.category_heatmap")}</h2>
          <HeatMapGrid rows={heatmap.districts} columns={heatmap.categories} values={heatmap.values} />
        </div>
      )}

      {/* Row 5: Case Lifecycle Funnel */}
      <div className="chart-section">
        <h2 className="chart-section__title">{t("dashboard.case_lifecycle")}</h2>
        <FunnelChart stages={caseFunnel} />
      </div>
    </>
  );
}
