import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@puda/shared";
import { apiBaseUrl } from "../types";
import DashboardFilters, { FilterState, defaultFilters, GranularityBar } from "../components/DashboardFilters";
import EmptyState from "../components/EmptyState";
import { TrendLineChart, DonutChart, FunnelChart, Sparkline, HeatMapGrid, GaugeChart } from "../charts";

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean; onNavigate: (view: string) => void };

type Analytics = {
  alertTrends: { bucket: string; priority: string; count: number }[];
  caseStages: { state_id: string; count: number; avg_hours: number }[];
  alertStages: { state_id: string; count: number; avg_hours: number }[];
  platformDistribution: { platform: string; count: number }[];
  categoryDistribution: { category: string; count: number }[];
  districtComparison: { district: string; unit_id: string; alert_count: number; case_count: number; breached: number }[];
  topActors: { actor_id: string; canonical_name: string; display_name: string; risk_score: number; total_flagged_posts: number; is_repeat_offender: boolean }[];
  sla: { on_track: number; at_risk: number; breached: number };
  conversion: { total_alerts: number; converted: number };
  avgResolutionHours: number;
};

type HeatmapData = { districts: string[]; categories: string[]; values: number[][] };

type RecentAlert = { alert_id: string; title: string; priority: string; state_id: string; created_at: string };

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626", HIGH: "#ef4444", MEDIUM: "#f59e0b", LOW: "#3b82f6",
};

const STAGE_COLORS: Record<string, string> = {
  NEW: "#3b82f6", TRIAGED: "#8b5cf6", IN_REVIEW: "#06b6d4",
  ESCALATED_SUPERVISOR: "#ef4444", ESCALATED_CONTROL_ROOM: "#dc2626",
  CONVERTED_TO_CASE: "#10b981", OPEN: "#3b82f6",
  ASSIGNED: "#8b5cf6", UNDER_INVESTIGATION: "#f59e0b",
  AWAITING_REVIEW: "#06b6d4", PENDING_REVIEW: "#06b6d4",
  CLOSED: "#10b981", REOPENED: "#ef4444",
};

const PLATFORM_COLORS: Record<string, string> = {
  Twitter: "#1da1f2", Facebook: "#1877f2", Instagram: "#e4405f",
  Telegram: "#0088cc", YouTube: "#ff0000", WhatsApp: "#25d366",
};

function pivotTrends(rows: { bucket: string; priority: string; count: number }[]) {
  const byBucket = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const key = r.bucket?.slice(0, 10) || "";
    if (!byBucket.has(key)) byBucket.set(key, {});
    byBucket.get(key)![r.priority] = r.count;
  }
  return [...byBucket.entries()].map(([bucket, vals]) => ({ bucket, ...vals }));
}

export default function Dashboard({ authHeaders, isOffline, onNavigate }: Props) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    if (isOffline) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ dateFrom: filters.dateFrom, dateTo: filters.dateTo, granularity: filters.granularity });
    if (filters.district) params.set("district", filters.district);
    if (filters.priority) params.set("priority", filters.priority);

    Promise.all([
      fetch(`${apiBaseUrl}/api/v1/dashboard/analytics?${params}`, authHeaders()).then(r => r.ok ? r.json() : null),
      fetch(`${apiBaseUrl}/api/v1/dashboard/heatmap?dateFrom=${filters.dateFrom}`, authHeaders()).then(r => r.ok ? r.json() : null),
      fetch(`${apiBaseUrl}/api/v1/dashboard/stats?dateFrom=${filters.dateFrom}&dateTo=${filters.dateTo}`, authHeaders()).then(r => r.ok ? r.json() : null),
    ])
      .then(([analyticsData, heatmapData, statsData]) => {
        if (analyticsData) setAnalytics(analyticsData);
        if (heatmapData) setHeatmap(heatmapData);
        setRecentAlerts(statsData?.recentAlerts || []);
      })
      .catch(err => setError(err instanceof Error ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [authHeaders, isOffline, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="loading-center">{t("common.loading")}</div>;

  const slaTotal = analytics ? analytics.sla.on_track + analytics.sla.at_risk + analytics.sla.breached : 0;
  const slaPct = slaTotal > 0 ? Math.round((analytics!.sla.on_track / slaTotal) * 100) : 0;
  const convPct = analytics?.conversion.total_alerts ? Math.round((analytics.conversion.converted / analytics.conversion.total_alerts) * 100) : 0;
  const totalOpenAlerts = analytics?.alertStages.reduce((s, st) => s + st.count, 0) || 0;
  const totalOpenCases = analytics?.caseStages.reduce((s, st) => s + st.count, 0) || 0;

  const trendData = analytics ? pivotTrends(analytics.alertTrends) : [];
  const trendSeries = Object.keys(PRIORITY_COLORS).map(p => ({ key: p, color: PRIORITY_COLORS[p], label: p }));

  const platformData = (analytics?.platformDistribution || []).map(p => ({
    name: p.platform || "Unknown", value: p.count, color: PLATFORM_COLORS[p.platform] || "#6b7280",
  }));

  const alertFunnel = (analytics?.alertStages || []).map(s => ({
    label: s.state_id.replace(/_/g, " "), count: s.count, color: STAGE_COLORS[s.state_id] || "#6b7280", avgHours: parseFloat(String(s.avg_hours)) || 0,
  }));

  const caseFunnel = (analytics?.caseStages || []).map(s => ({
    label: s.state_id.replace(/_/g, " "), count: s.count, color: STAGE_COLORS[s.state_id] || "#6b7280", avgHours: parseFloat(String(s.avg_hours)) || 0,
  }));

  // Sparkline data from trends — aggregate by bucket
  const alertSparkline = trendData.map(d => Object.values(d).reduce((sum, v) => sum + (typeof v === "number" ? v : 0), 0));

  return (
    <>
      <div className="page__header">
        <h1>{t("app.page_dashboard")}</h1>
        <p className="subtitle">{t("app.subtitle")}</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Row 1: Filters */}
      <DashboardFilters value={filters} onChange={setFilters} authHeaders={authHeaders} />

      {/* Row 2: KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: "var(--space-4)" }}>
        <button type="button" className="stat-card stat-card--clickable" onClick={() => onNavigate("alerts")}>
          <p className="stat-card__label">{t("dashboard.alert_queue")}</p>
          <p className="stat-card__value">{totalOpenAlerts}</p>
          <div className="stat-card__trend">
            <Sparkline data={alertSparkline} color="#3b82f6" />
          </div>
        </button>

        <button type="button" className="stat-card stat-card--clickable" onClick={() => onNavigate("cases")}>
          <p className="stat-card__label">{t("dashboard.open_cases")}</p>
          <p className="stat-card__value">{totalOpenCases}</p>
        </button>

        <div className="stat-card">
          <p className="stat-card__label">{t("dashboard.sla_compliance")}</p>
          <p className="stat-card__value" style={{ color: slaPct >= 80 ? "var(--color-success)" : slaPct >= 60 ? "var(--color-warning)" : "var(--color-danger)" }}>
            {slaPct}%
          </p>
        </div>

        <div className="stat-card">
          <p className="stat-card__label">{t("dashboard.conversion_rate")}</p>
          <p className="stat-card__value">{convPct}%</p>
        </div>

        <div className="stat-card">
          <p className="stat-card__label">{t("dashboard.avg_resolution")}</p>
          <p className="stat-card__value">{analytics?.avgResolutionHours?.toFixed(1) || "—"}h</p>
        </div>

        <div className="stat-card">
          <p className="stat-card__label">{t("dashboard.active_investigations")}</p>
          <p className="stat-card__value">{analytics?.caseStages.find(s => s.state_id === "UNDER_INVESTIGATION")?.count || 0}</p>
        </div>
      </div>

      {/* Granularity + date presets — affects trend chart */}
      <GranularityBar value={filters} onChange={setFilters} />

      {/* Row 3: Trend Charts (2-column) */}
      <div className="dashboard-row dashboard-row--2col">
        <div className="chart-section">
          <h2 className="chart-section__title">{t("dashboard.alert_volume_trend")}</h2>
          <TrendLineChart data={trendData} series={trendSeries} areaFill height={260} />
        </div>
        <div className="chart-section">
          <h2 className="chart-section__title">{t("dashboard.platform_distribution")}</h2>
          <DonutChart data={platformData} />
        </div>
      </div>

      {/* Row 4: Stage Distribution (2-column) */}
      <div className="dashboard-row dashboard-row--2col">
        <div className="chart-section">
          <h2 className="chart-section__title">{t("dashboard.alert_pipeline")}</h2>
          <FunnelChart stages={alertFunnel} />
        </div>
        <div className="chart-section">
          <h2 className="chart-section__title">{t("dashboard.case_pipeline")}</h2>
          <FunnelChart stages={caseFunnel} />
        </div>
      </div>

      {/* Row 5: District Comparison */}
      {analytics && analytics.districtComparison.length > 0 && (
        <div className="chart-section" style={{ marginBottom: "var(--space-4)" }}>
          <h2 className="chart-section__title">{t("dashboard.district_comparison")}</h2>
          <div className="table-scroll">
            <table className="entity-table entity-table--compact">
              <thead>
                <tr>
                  <th>{t("dashboard.district")}</th>
                  <th>{t("dashboard.alerts")}</th>
                  <th>{t("dashboard.cases_col")}</th>
                  <th>{t("dashboard.breached_col")}</th>
                  <th>{t("dashboard.sla_col")}</th>
                </tr>
              </thead>
              <tbody>
                {analytics.districtComparison.slice(0, 10).map(d => {
                  const dTotal = d.alert_count || 1;
                  const dSlaPct = Math.round(((dTotal - d.breached) / dTotal) * 100);
                  return (
                    <tr key={d.unit_id}>
                      <td data-label={t("dashboard.district")}>{d.district}</td>
                      <td data-label={t("dashboard.alerts")}>{d.alert_count}</td>
                      <td data-label={t("dashboard.cases_col")}>{d.case_count}</td>
                      <td data-label={t("dashboard.breached_col")}>
                        <span className={d.breached > 0 ? "badge badge--critical" : "badge badge--success"}>{d.breached}</span>
                      </td>
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
        </div>
      )}

      {/* Row 6: Category Heat Map */}
      {heatmap && heatmap.districts.length > 0 && (
        <div className="chart-section" style={{ marginBottom: "var(--space-4)" }}>
          <h2 className="chart-section__title">{t("dashboard.category_heatmap")}</h2>
          <HeatMapGrid rows={heatmap.districts} columns={heatmap.categories} values={heatmap.values} />
        </div>
      )}

      {/* Row 7: Top Actors + Recent Alerts (2-column) */}
      <div className="dashboard-row dashboard-row--2col">
        <div className="chart-section">
          <h2 className="chart-section__title">{t("dashboard.top_actors")}</h2>
          {!analytics || analytics.topActors.length === 0 ? (
            <EmptyState icon="search" title={t("dashboard.no_activity")} />
          ) : (
            analytics.topActors.map((actor, i) => (
              <div className="actor-row" key={actor.actor_id}>
                <span className="actor-row__rank">{i + 1}</span>
                <div className="actor-row__info">
                  <div className="actor-row__name">{actor.display_name || actor.canonical_name}</div>
                  <div className="actor-row__meta">
                    {actor.total_flagged_posts} {t("dashboard.flagged_posts")}
                    {actor.is_repeat_offender && <span className="badge badge--critical" style={{ marginLeft: "var(--space-1)" }}>{t("dashboard.repeat")}</span>}
                  </div>
                </div>
                <span className="actor-row__score">{actor.risk_score?.toFixed(0) || "—"}</span>
              </div>
            ))
          )}
        </div>

        <div className="chart-section">
          <h2 className="chart-section__title">{t("dashboard.recent_alerts")}</h2>
          {recentAlerts.length === 0 ? (
            <EmptyState icon="inbox" title={t("dashboard.no_activity")} />
          ) : (
            <div className="table-scroll">
            <table className="entity-table entity-table--compact">
              <thead>
                <tr>
                  <th>{t("alerts.priority")}</th>
                  <th>{t("common.title")}</th>
                  <th>{t("alerts.status")}</th>
                  <th>{t("alerts.created")}</th>
                </tr>
              </thead>
              <tbody>
                {recentAlerts.map(a => (
                  <tr key={a.alert_id} className="entity-table__clickable" onClick={() => onNavigate("alert-detail")}>
                    <td data-label={t("alerts.priority")}>
                      <span className={`badge badge--${a.priority?.toLowerCase() || "default"}`}>{a.priority}</span>
                    </td>
                    <td data-label={t("common.title")}>{a.title}</td>
                    <td data-label={t("alerts.status")}>
                      <span className="badge badge--default">{a.state_id}</span>
                    </td>
                    <td data-label={t("alerts.created")}>
                      {a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
