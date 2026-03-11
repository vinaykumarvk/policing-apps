import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, Alert, SkeletonBlock, Badge } from "@puda/shared";
import { apiBaseUrl } from "../types";

type Props = {
  authHeaders: () => Record<string, string>;
  isOffline: boolean;
};

type DistEntry = { role: string; count: number };
type Recidivist = { subject_id: string; full_name: string; offense_count: number; risk_score: number };

export default function DrugDashboard({ authHeaders, isOffline }: Props) {
  const { t } = useTranslation();
  const [distribution, setDistribution] = useState<DistEntry[]>([]);
  const [recidivists, setRecidivists] = useState<Recidivist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOffline) { setLoading(false); return; }
    Promise.all([
      fetch(`${apiBaseUrl}/api/v1/drug-classify/distribution`, authHeaders()).then(r => r.ok ? r.json() : { distribution: [] }),
      fetch(`${apiBaseUrl}/api/v1/drug-classify/recidivists`, authHeaders()).then(r => r.ok ? r.json() : { recidivists: [] }),
    ]).then(([distData, recData]) => {
      setDistribution(distData.distribution || []);
      setRecidivists(recData.recidivists || []);
    }).catch(() => setError(t("common.error"))).finally(() => setLoading(false));
  }, [authHeaders, isOffline]);

  const maxCount = Math.max(...distribution.map(d => d.count), 1);

  if (loading) return <div className="loading-center"><SkeletonBlock height="20rem" /></div>;

  return (
    <div>
      <div className="page__header">
        <h1>{t("drug.dashboard_title")}</h1>
        <p className="subtitle">{t("drug.dashboard_subtitle")}</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div style={{ display: "grid", gap: "var(--space-4)" }}>
        <Card>
          <h2 style={{ marginBottom: "var(--space-3)", fontSize: "1.125rem" }}>{t("drug.role_distribution")}</h2>
          <div className="chart-bar-group">
            {distribution.map((d) => (
              <div key={d.role} className="chart-bar">
                <span className="chart-bar__label">{d.role}</span>
                <div className="chart-bar__track">
                  <div className="chart-bar__fill" style={{ width: `${(d.count / maxCount) * 100}%`, background: "var(--color-primary)" }} />
                </div>
                <span className="chart-bar__value">{d.count}</span>
              </div>
            ))}
            {distribution.length === 0 && <p style={{ color: "var(--color-text-secondary)" }}>{t("common.no_data")}</p>}
          </div>
        </Card>

        <Card>
          <h2 style={{ marginBottom: "var(--space-3)", fontSize: "1.125rem" }}>{t("drug.recidivists")}</h2>
          {recidivists.length > 0 ? (
            <table className="entity-table">
              <thead>
                <tr>
                  <th>{t("drug.subject_name")}</th>
                  <th>{t("drug.offense_count")}</th>
                  <th>{t("drug.risk_score")}</th>
                </tr>
              </thead>
              <tbody>
                {recidivists.map((r) => (
                  <tr key={r.subject_id}>
                    <td data-label={t("drug.subject_name")}>{r.full_name}</td>
                    <td data-label={t("drug.offense_count")}>{r.offense_count}</td>
                    <td data-label={t("drug.risk_score")}>
                      <Badge variant={r.risk_score >= 0.7 ? "danger" : r.risk_score >= 0.4 ? "warning" : "success"}>
                        {Math.round(r.risk_score * 100)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: "var(--color-text-secondary)" }}>{t("common.no_data")}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
