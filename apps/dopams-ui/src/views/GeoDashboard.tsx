import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@puda/shared";
import { apiBaseUrl } from "../types";
import DashboardFilters, { FilterState, defaultFilters } from "../components/DashboardFilters";

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean; onNavigate: (view: string) => void };

type DistrictGeo = {
  district: string; unit_id: string; alert_count: number; case_count: number;
  avg_threat_score: number | null; breach_count: number;
};

function threatColor(score: number | null): string {
  if (score == null || score === 0) return "var(--color-bg-elevated)";
  if (score >= 80) return "#dc2626";
  if (score >= 60) return "#ef4444";
  if (score >= 40) return "#f59e0b";
  if (score >= 20) return "#3b82f6";
  return "#10b981";
}

export default function GeoDashboard({ authHeaders, isOffline, onNavigate }: Props) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [districts, setDistricts] = useState<DistrictGeo[]>([]);
  const [selected, setSelected] = useState<DistrictGeo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    if (isOffline) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    fetch(`${apiBaseUrl}/api/v1/dashboard/geo?dateFrom=${filters.dateFrom}&dateTo=${filters.dateTo}`, authHeaders())
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setDistricts(data.districts || []);
      })
      .catch(err => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [authHeaders, isOffline, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="loading-center">{t("common.loading")}</div>;

  const maxAlerts = Math.max(1, ...districts.map(d => d.alert_count));

  return (
    <>
      <div className="page__header">
        <h1>{t("dashboard.geo_title")}</h1>
        <p className="subtitle">{t("dashboard.geo_subtitle")}</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <DashboardFilters value={filters} onChange={setFilters} authHeaders={authHeaders} />

      {/* Geo Layout: Map visualization + Sidebar */}
      <div className="geo-layout">
        {/* Left: Choropleth grid (district tiles) */}
        <div className="chart-section">
          <h2 className="chart-section__title">{t("dashboard.geo_map")}</h2>
          {districts.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)" }}>{t("common.no_data")}</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(7rem, 1fr))", gap: "var(--space-2)" }}>
              {districts.map(d => {
                const intensity = d.alert_count / maxAlerts;
                const bg = d.alert_count > 0
                  ? `color-mix(in srgb, #1e40af ${Math.round(intensity * 100)}%, #dbeafe)`
                  : "var(--color-bg-elevated)";
                const textColor = intensity > 0.5 ? "#fff" : "var(--color-text)";
                return (
                  <button
                    key={d.unit_id}
                    type="button"
                    className="filter-chip"
                    style={{
                      background: bg, color: textColor, borderColor: selected?.unit_id === d.unit_id ? "var(--color-brand)" : "transparent",
                      display: "flex", flexDirection: "column", alignItems: "center", padding: "var(--space-2)",
                      minHeight: "3.5rem", borderRadius: "var(--radius-md)", borderWidth: "2px",
                    }}
                    onClick={() => setSelected(d)}
                  >
                    <span style={{ fontSize: "0.7rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{d.district}</span>
                    <span style={{ fontSize: "1rem", fontWeight: 700 }}>{d.alert_count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Selected district details */}
        <div className="geo-sidebar">
          <div className="chart-section">
            <h2 className="chart-section__title">{selected ? selected.district : t("dashboard.select_district")}</h2>
            {selected ? (
              <div style={{ display: "grid", gap: "var(--space-3)" }}>
                <div className="stat-card">
                  <p className="stat-card__label">{t("dashboard.alerts")}</p>
                  <p className="stat-card__value">{selected.alert_count}</p>
                </div>
                <div className="stat-card">
                  <p className="stat-card__label">{t("dashboard.cases_col")}</p>
                  <p className="stat-card__value">{selected.case_count}</p>
                </div>
                <div className="stat-card">
                  <p className="stat-card__label">{t("dashboard.avg_threat")}</p>
                  <p className="stat-card__value" style={{ color: threatColor(selected.avg_threat_score) }}>
                    {selected.avg_threat_score != null ? Number(selected.avg_threat_score).toFixed(1) : "\u2014"}
                  </p>
                </div>
                <div className="stat-card">
                  <p className="stat-card__label">{t("dashboard.sla_breaches")}</p>
                  <p className="stat-card__value" style={{ color: selected.breach_count > 0 ? "var(--color-danger)" : undefined }}>{selected.breach_count}</p>
                </div>
              </div>
            ) : (
              <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>{t("dashboard.click_district")}</p>
            )}
          </div>
        </div>
      </div>

      {/* District Comparison Table */}
      <div className="chart-section" style={{ marginTop: "var(--space-4)" }}>
        <h2 className="chart-section__title">{t("dashboard.district_comparison")}</h2>
        {districts.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)" }}>{t("common.no_data")}</p>
        ) : (
          <div className="table-scroll">
            <table className="entity-table entity-table--compact">
              <thead>
                <tr>
                  <th>{t("dashboard.district")}</th>
                  <th>{t("dashboard.alerts")}</th>
                  <th>{t("dashboard.cases_col")}</th>
                  <th>{t("dashboard.avg_threat")}</th>
                  <th>{t("dashboard.sla_col")}</th>
                  <th>{t("dashboard.breached_col")}</th>
                </tr>
              </thead>
              <tbody>
                {districts.map(d => {
                  const dTotal = d.alert_count || 1;
                  const dSlaPct = Math.round(((dTotal - d.breach_count) / dTotal) * 100);
                  return (
                    <tr
                      key={d.unit_id}
                      className="entity-table__clickable"
                      style={{ background: selected?.unit_id === d.unit_id ? "var(--color-brand-soft)" : undefined }}
                      onClick={() => setSelected(d)}
                      tabIndex={0}
                      role="link"
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(d); } }}
                    >
                      <td data-label={t("dashboard.district")}>{d.district}</td>
                      <td data-label={t("dashboard.alerts")}>{d.alert_count}</td>
                      <td data-label={t("dashboard.cases_col")}>{d.case_count}</td>
                      <td data-label={t("dashboard.avg_threat")}>{d.avg_threat_score != null ? Number(d.avg_threat_score).toFixed(1) : "\u2014"}</td>
                      <td data-label={t("dashboard.sla_col")}>
                        <span style={{ color: dSlaPct >= 80 ? "var(--color-success)" : dSlaPct >= 60 ? "var(--color-warning)" : "var(--color-danger)", fontWeight: 700 }}>{dSlaPct}%</span>
                      </td>
                      <td data-label={t("dashboard.breached_col")}>
                        <span className={d.breach_count > 0 ? "badge badge--critical" : "badge badge--success"}>{d.breach_count}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
