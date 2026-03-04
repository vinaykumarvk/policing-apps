import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@puda/shared";
import { apiBaseUrl } from "../types";

type AlertBySeverity = { severity: string; count: number };
type LeadByState = { state_id: string; count: number };
type RecentAlert = { alert_id: string; title: string; severity: string; state_id: string; created_at: string };

type DashboardStats = {
  alertsBySeverity: AlertBySeverity[];
  leadsByState: LeadByState[];
  totalCases: number;
  totalSubjects: number;
  recentAlerts: RecentAlert[];
};

type Props = {
  authHeaders: () => Record<string, string>;
  isOffline: boolean;
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "var(--color-state-critical)",
  HIGH: "var(--color-warning)",
  MEDIUM: "var(--color-state-pending)",
  LOW: "var(--color-state-active)",
};

export default function Dashboard({ authHeaders, isOffline }: Props) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOffline) { setLoading(false); return; }
    const headers = authHeaders();
    fetch(`${apiBaseUrl}/api/v1/dashboard/stats`, { headers })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: DashboardStats) => setStats(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [authHeaders, isOffline]);

  if (loading) return <div className="loading-center">{t("common.loading")}</div>;

  const alertsBySeverity = stats?.alertsBySeverity || [];
  const maxSeverityCount = Math.max(1, ...alertsBySeverity.map((s) => s.count));
  const totalAlerts = alertsBySeverity.reduce((sum, s) => sum + s.count, 0);
  const leadsByState = stats?.leadsByState || [];
  const totalLeads = leadsByState.reduce((sum, s) => sum + s.count, 0);
  const recentAlerts = stats?.recentAlerts || [];

  return (
    <>
      <div className="page__header">
        <h1>{t("app.page_dashboard")}</h1>
        <p className="subtitle">{t("app.subtitle")}</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="dashboard-grid">
        <div className="stat-card">
          <p className="stat-card__label">{t("dashboard.total_alerts")}</p>
          <p className="stat-card__value">{totalAlerts}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">{t("dashboard.active_leads")}</p>
          <p className="stat-card__value">{totalLeads}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">{t("dashboard.open_cases")}</p>
          <p className="stat-card__value">{stats?.totalCases ?? 0}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">{t("dashboard.subjects_monitored")}</p>
          <p className="stat-card__value">{stats?.totalSubjects ?? 0}</p>
        </div>
      </div>

      {alertsBySeverity.length > 0 && (
        <div className="detail-section" style={{ marginTop: "var(--space-5)" }}>
          <h2 className="detail-section__title">{t("dashboard.alerts_by_severity")}</h2>
          <div className="chart-bar-group">
            {alertsBySeverity.map((s) => (
              <div className="chart-bar" key={s.severity}>
                <span className="chart-bar__label">{s.severity}</span>
                <div className="chart-bar__track">
                  <div
                    className="chart-bar__fill"
                    style={{
                      width: `${(s.count / maxSeverityCount) * 100}%`,
                      background: SEVERITY_COLORS[s.severity] || "var(--color-text-muted)",
                    }}
                  />
                </div>
                <span className="chart-bar__value">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="detail-section" style={{ marginTop: "var(--space-5)" }}>
        <h2 className="detail-section__title">{t("dashboard.recent_activity")}</h2>
        {recentAlerts.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)" }}>{t("dashboard.no_activity")}</p>
        ) : (
          <table className="entity-table">
            <thead>
              <tr>
                <th>{t("alerts.severity")}</th>
                <th>{t("common.title")}</th>
                <th>{t("alerts.status")}</th>
                <th>{t("alerts.created")}</th>
              </tr>
            </thead>
            <tbody>
              {recentAlerts.map((a) => (
                <tr key={a.alert_id}>
                  <td data-label={t("alerts.severity")}>
                    <span className={`badge badge--${a.severity?.toLowerCase() || "default"}`}>{a.severity}</span>
                  </td>
                  <td data-label={t("common.title")}>{a.title}</td>
                  <td data-label={t("alerts.status")}>
                    <span className="badge badge--default">{a.state_id}</span>
                  </td>
                  <td data-label={t("alerts.created")}>
                    {a.created_at ? new Date(a.created_at).toLocaleDateString() : "\u2014"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
