import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@puda/shared";
import { apiBaseUrl } from "../types";

type SlaStats = { on_track: number; at_risk: number; breached: number };
type SlaRule = { rule_id: string; priority: string; entity_type: string; sla_minutes: number; escalate_to_parent: boolean };

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean };

export default function SlaDashboard({ authHeaders, isOffline }: Props) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<SlaStats | null>(null);
  const [rules, setRules] = useState<SlaRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${apiBaseUrl}/api/v1/dashboard/sla`, authHeaders()).then((r) => r.ok ? r.json() : null),
      fetch(`${apiBaseUrl}/api/v1/sla/rules`, authHeaders()).then((r) => r.ok ? r.json() : { rules: [] }),
    ])
      .then(([slaData, rulesData]) => {
        if (slaData?.sla) setStats(slaData.sla);
        setRules(rulesData.rules || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authHeaders]);

  if (loading) return <div className="loading-center">{t("common.loading")}</div>;

  return (
    <>
      <div className="page__header">
        <h1>{t("sla_dashboard.title")}</h1>
        <p className="subtitle">{t("sla_dashboard.subtitle")}</p>
      </div>
      {stats && (
        <div className="dashboard-grid">
          <div className="stat-card">
            <p className="stat-card__label">{t("sla.on_track")}</p>
            <p className="stat-card__value" style={{ color: "var(--color-state-active)" }}>{stats.on_track}</p>
          </div>
          <div className="stat-card">
            <p className="stat-card__label">{t("sla.at_risk")}</p>
            <p className="stat-card__value" style={{ color: "var(--color-state-pending)" }}>{stats.at_risk}</p>
          </div>
          <div className="stat-card">
            <p className="stat-card__label">{t("sla.breached")}</p>
            <p className="stat-card__value" style={{ color: "var(--color-state-critical)" }}>{stats.breached}</p>
          </div>
        </div>
      )}
      <div className="detail-section" style={{ marginTop: "var(--space-5)" }}>
        <h2 className="detail-section__title">{t("sla_dashboard.rules")}</h2>
        {rules.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)" }}>{t("common.no_data")}</p>
        ) : (
          <div className="table-scroll">
          <table className="entity-table">
            <thead>
              <tr>
                <th>{t("alerts.priority")}</th>
                <th>{t("sla_dashboard.sla_minutes")}</th>
                <th>{t("sla_dashboard.auto_escalate")}</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.rule_id}>
                  <td data-label={t("alerts.priority")}>
                    <span className={`badge badge--${r.priority?.toLowerCase() || "default"}`}>{r.priority}</span>
                  </td>
                  <td data-label={t("sla_dashboard.sla_minutes")}>{r.sla_minutes} min</td>
                  <td data-label={t("sla_dashboard.auto_escalate")}>{r.escalate_to_parent ? t("common.yes") : t("common.no")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </>
  );
}
