import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button, Field, Input } from "@puda/shared";
import { apiBaseUrl } from "../types";

type AuditStat = {
  user_id: string; full_name: string; username: string;
  total_accesses: number; unique_entities: number; last_access: string;
  emergency_count: number; accesses_24h: number;
};

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean };

export default function SupervisorAudit({ authHeaders, isOffline }: Props) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<AuditStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchStats = (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("dateFrom", from);
    if (to) params.set("dateTo", to);
    fetch(`${apiBaseUrl}/api/v1/supervisor/audit-stats?${params}`, authHeaders())
      .then((r) => r.ok ? r.json() : { stats: [] })
      .then((data) => setStats(data.stats || []))
      .catch(() => setStats([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStats(); }, [authHeaders]);

  const handleFilter = () => { setLoading(true); fetchStats(dateFrom, dateTo); };

  if (loading) return <div className="loading-center">{t("common.loading")}</div>;

  return (
    <>
      <div className="page__header">
        <h1>{t("supervisor_audit.title")}</h1>
        <p className="subtitle">{t("supervisor_audit.subtitle")}</p>
      </div>
      <div className="filter-bar">
        <Field label={t("audit.date_from")} htmlFor="sa-from">
          <Input id="sa-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </Field>
        <Field label={t("audit.date_to")} htmlFor="sa-to">
          <Input id="sa-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </Field>
        <Button onClick={handleFilter} disabled={isOffline}>{t("audit.apply_filters")}</Button>
      </div>
      {stats.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", padding: "var(--space-4)" }}>{t("common.no_data")}</p>
      ) : (
        <table className="entity-table">
          <thead>
            <tr>
              <th>{t("admin.full_name")}</th>
              <th>{t("supervisor_audit.total_accesses")}</th>
              <th>{t("supervisor_audit.unique_entities")}</th>
              <th>{t("supervisor_audit.accesses_24h")}</th>
              <th>{t("supervisor_audit.emergency_count")}</th>
              <th>{t("supervisor_audit.last_access")}</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.user_id} className={Number(s.emergency_count) > 3 ? "row--highlight" : ""}>
                <td data-label={t("admin.full_name")}>{s.full_name} ({s.username})</td>
                <td data-label={t("supervisor_audit.total_accesses")}>{s.total_accesses}</td>
                <td data-label={t("supervisor_audit.unique_entities")}>{s.unique_entities}</td>
                <td data-label={t("supervisor_audit.accesses_24h")}>{s.accesses_24h}</td>
                <td data-label={t("supervisor_audit.emergency_count")}>
                  <span className={Number(s.emergency_count) > 3 ? "badge badge--critical" : ""}>{s.emergency_count}</span>
                </td>
                <td data-label={t("supervisor_audit.last_access")}>{s.last_access ? new Date(s.last_access).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
