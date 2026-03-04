import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@puda/shared";
import { apiBaseUrl } from "../types";

type CaseByState = { state_id: string; count: number };
type CaseByType = { case_type: string | null; count: number };
type RecentCase = {
  case_id: string;
  case_number: string | null;
  title: string;
  case_type: string | null;
  state_id: string;
  priority: string;
  created_at: string;
};

type DashboardStats = {
  casesByState: CaseByState[];
  casesByType: CaseByType[];
  totalEvidence: number;
  pendingFindings: number;
  draftReports: number;
  recentCases: RecentCase[];
};

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean; onNavigate: (view: string) => void };

const TYPE_COLORS: Record<string, string> = {
  MOBILE_FORENSICS: "var(--color-state-open)",
  COMPUTER_FORENSICS: "var(--color-brand)",
  NETWORK_FORENSICS: "var(--color-state-active)",
  MALWARE_ANALYSIS: "var(--color-state-critical)",
  CLOUD_FORENSICS: "var(--color-state-pending)",
  MEMORY_FORENSICS: "var(--color-success)",
};

export default function Dashboard({ authHeaders, isOffline, onNavigate }: Props) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOffline) { setLoading(false); return; }
    const h = authHeaders();
    fetch(`${apiBaseUrl}/api/v1/dashboard/stats`, { headers: h })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: DashboardStats) => setStats(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [authHeaders, isOffline]);

  if (loading) return <div className="loading-center">{t("common.loading")}</div>;

  const casesByState = stats?.casesByState || [];
  const totalCases = casesByState.reduce((sum, s) => sum + s.count, 0);
  const casesByType = stats?.casesByType || [];
  const maxTypeCount = Math.max(1, ...casesByType.map((c) => c.count));
  const recentCases = stats?.recentCases || [];

  return (
    <>
      <div className="page__header">
        <h1>{t("app.page_dashboard")}</h1>
        <p className="subtitle">{t("app.subtitle")}</p>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      <div className="dashboard-grid">
        <button type="button" className="stat-card stat-card--clickable" onClick={() => onNavigate("cases")}>
          <p className="stat-card__label">{t("dashboard.total_cases")}</p>
          <p className="stat-card__value">{totalCases}</p>
        </button>
        <button type="button" className="stat-card stat-card--clickable" onClick={() => onNavigate("cases")}>
          <p className="stat-card__label">{t("dashboard.total_evidence")}</p>
          <p className="stat-card__value">{stats?.totalEvidence ?? 0}</p>
        </button>
        <button type="button" className="stat-card stat-card--clickable" onClick={() => onNavigate("cases")}>
          <p className="stat-card__label">{t("dashboard.pending_findings")}</p>
          <p className="stat-card__value">{stats?.pendingFindings ?? 0}</p>
        </button>
        <button type="button" className="stat-card stat-card--clickable" onClick={() => onNavigate("cases")}>
          <p className="stat-card__label">{t("dashboard.draft_reports")}</p>
          <p className="stat-card__value">{stats?.draftReports ?? 0}</p>
        </button>
      </div>

      {casesByType.length > 0 && (
        <div className="detail-section" style={{ marginTop: "var(--space-5)" }}>
          <h2 className="detail-section__title">{t("dashboard.cases_by_type")}</h2>
          <div className="chart-bar-group">
            {casesByType.map((c) => {
              const label = c.case_type || t("common.unspecified");
              return (
                <div className="chart-bar" key={label}>
                  <span className="chart-bar__label">{label}</span>
                  <div className="chart-bar__track">
                    <div
                      className="chart-bar__fill"
                      style={{
                        width: `${(c.count / maxTypeCount) * 100}%`,
                        background: TYPE_COLORS[label] || "var(--color-text-muted)",
                      }}
                    />
                  </div>
                  <span className="chart-bar__value">{c.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="detail-section" style={{ marginTop: "var(--space-5)" }}>
        <h2 className="detail-section__title">{t("dashboard.recent_cases")}</h2>
        {recentCases.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)" }}>{t("dashboard.no_activity")}</p>
        ) : (
          <table className="entity-table">
            <thead>
              <tr>
                <th>{t("cases.case_number")}</th>
                <th>{t("cases.type")}</th>
                <th>{t("cases.priority")}</th>
                <th>{t("cases.status")}</th>
                <th>{t("detail.created_at")}</th>
              </tr>
            </thead>
            <tbody>
              {recentCases.map((c) => (
                <tr key={c.case_id}>
                  <td data-label={t("cases.case_number")}>{c.case_number || "\u2014"}</td>
                  <td data-label={t("cases.type")}>{c.case_type || "\u2014"}</td>
                  <td data-label={t("cases.priority")}>
                    <span className={`badge badge--${c.priority?.toLowerCase() || "default"}`}>{c.priority}</span>
                  </td>
                  <td data-label={t("cases.status")}>
                    <span className="badge badge--default">{c.state_id}</span>
                  </td>
                  <td data-label={t("detail.created_at")}>
                    {c.created_at ? new Date(c.created_at).toLocaleDateString() : "\u2014"}
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
