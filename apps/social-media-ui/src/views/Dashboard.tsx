import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@puda/shared";
import { apiBaseUrl } from "../types";

type AlertByState = { state_id: string; count: number };
type RecentAlert = { alert_id: string; title: string; priority: string; state_id: string; created_at: string };

type RetentionStats = { totalPolicies: number; nearingExpiry: number; expired: number; legalHolds: number };

type DashboardStats = {
  alertsByState: AlertByState[];
  totalCases: number;
  totalContent: number;
  activeWatchlists: number;
  recentAlerts: RecentAlert[];
};

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean; onNavigate: (view: string) => void };

const STATE_COLORS: Record<string, string> = {
  NEW: "var(--color-state-open)",
  OPEN: "var(--color-state-pending)",
  IN_PROGRESS: "var(--color-brand)",
  ESCALATED: "var(--color-state-critical)",
  RESOLVED: "var(--color-state-active)",
  CLOSED: "var(--color-state-closed)",
};

export default function Dashboard({ authHeaders, isOffline, onNavigate }: Props) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retention, setRetention] = useState<RetentionStats | null>(null);

  useEffect(() => {
    if (isOffline) { setLoading(false); return; }
    fetch(`${apiBaseUrl}/api/v1/dashboard/stats`, authHeaders())
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: DashboardStats) => setStats(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
    fetch(`${apiBaseUrl}/api/v1/evidence/dashboard/retention`, authHeaders())
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setRetention(data); })
      .catch(() => {});
  }, [authHeaders, isOffline]);

  if (loading) return <div className="loading-center">{t("common.loading")}</div>;

  const alertsByState = stats?.alertsByState || [];
  const maxAlertCount = Math.max(1, ...alertsByState.map((s) => s.count));
  const totalAlerts = alertsByState.reduce((sum, s) => sum + s.count, 0);
  const recentAlerts = stats?.recentAlerts || [];

  return (
    <>
      <div className="page__header">
        <h1>{t("app.page_dashboard")}</h1>
        <p className="subtitle">{t("app.subtitle")}</p>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      <div className="dashboard-grid">
        <button type="button" className="stat-card stat-card--clickable" onClick={() => onNavigate("alerts")}>
          <p className="stat-card__label">{t("dashboard.alert_queue")}</p>
          <p className="stat-card__value">{totalAlerts}</p>
        </button>
        <button type="button" className="stat-card stat-card--clickable" onClick={() => onNavigate("cases")}>
          <p className="stat-card__label">{t("dashboard.open_cases")}</p>
          <p className="stat-card__value">{stats?.totalCases ?? 0}</p>
        </button>
        <button type="button" className="stat-card stat-card--clickable" onClick={() => onNavigate("content")}>
          <p className="stat-card__label">{t("dashboard.content_volume")}</p>
          <p className="stat-card__value">{stats?.totalContent ?? 0}</p>
        </button>
        <button type="button" className="stat-card stat-card--clickable" onClick={() => onNavigate("watchlists")}>
          <p className="stat-card__label">{t("dashboard.active_watchlists")}</p>
          <p className="stat-card__value">{stats?.activeWatchlists ?? 0}</p>
        </button>
      </div>

      {retention && (
        <div className="detail-section" style={{ marginTop: "var(--space-5)" }}>
          <h2 className="detail-section__title">{t("dashboard.retention_status")}</h2>
          <div className="dashboard-grid">
            <div className="stat-card">
              <p className="stat-card__label">{t("dashboard.retention_policies")}</p>
              <p className="stat-card__value">{retention.totalPolicies}</p>
            </div>
            <div className="stat-card">
              <p className="stat-card__label">{t("dashboard.nearing_expiry")}</p>
              <p className="stat-card__value" style={{ color: retention.nearingExpiry > 0 ? "var(--color-state-critical)" : undefined }}>{retention.nearingExpiry}</p>
            </div>
            <div className="stat-card">
              <p className="stat-card__label">{t("dashboard.expired_items")}</p>
              <p className="stat-card__value">{retention.expired}</p>
            </div>
            <div className="stat-card">
              <p className="stat-card__label">{t("dashboard.legal_holds")}</p>
              <p className="stat-card__value">{retention.legalHolds}</p>
            </div>
          </div>
        </div>
      )}

      {alertsByState.length > 0 && (
        <div className="detail-section" style={{ marginTop: "var(--space-5)" }}>
          <h2 className="detail-section__title">{t("dashboard.alerts_by_state")}</h2>
          <div className="chart-bar-group">
            {alertsByState.map((s) => (
              <div className="chart-bar" key={s.state_id}>
                <span className="chart-bar__label">{s.state_id}</span>
                <div className="chart-bar__track">
                  <div
                    className="chart-bar__fill"
                    style={{
                      width: `${(s.count / maxAlertCount) * 100}%`,
                      background: STATE_COLORS[s.state_id] || "var(--color-text-muted)",
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
        <h2 className="detail-section__title">{t("dashboard.recent_alerts")}</h2>
        {recentAlerts.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)" }}>{t("dashboard.no_activity")}</p>
        ) : (
          <table className="entity-table">
            <thead>
              <tr>
                <th>{t("alerts.priority")}</th>
                <th>{t("common.title")}</th>
                <th>{t("alerts.status")}</th>
                <th>{t("alerts.created")}</th>
              </tr>
            </thead>
            <tbody>
              {recentAlerts.map((a) => (
                <tr key={a.alert_id}>
                  <td data-label={t("alerts.priority")}>
                    <span className={`badge badge--${a.priority?.toLowerCase() || "default"}`}>{a.priority}</span>
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
