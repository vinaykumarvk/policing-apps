import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert as AlertUI, Select, Field, Pagination } from "@puda/shared";
import { apiBaseUrl, SMAlert } from "../types";

const LIMIT = 20;

type FacetEntry = { value: string; label?: string; count: number };
type Facets = Record<string, FacetEntry[]>;

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean; onSelect: (id: string) => void };

function facetOptions(entries: FacetEntry[] | undefined, fallback: string[]) {
  if (entries && entries.length > 0) {
    return entries.map((f) => <option key={f.value} value={f.value}>{f.label || f.value} ({f.count})</option>);
  }
  return fallback.map((v) => <option key={v} value={v}>{v}</option>);
}

export default function AlertList({ authHeaders, isOffline, onSelect }: Props) {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<SMAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stateFilter, setStateFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [facets, setFacets] = useState<Facets>({});

  useEffect(() => {
    if (isOffline) return;
    fetch(`${apiBaseUrl}/api/v1/alerts/facets`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setFacets(data.facets || {}); })
      .catch(() => {});
  }, [authHeaders, isOffline]);

  useEffect(() => {
    if (isOffline) { setLoading(false); return; }
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(LIMIT));
    params.set("offset", String((page - 1) * LIMIT));
    if (stateFilter) params.set("state_id", stateFilter);
    if (priorityFilter) params.set("priority", priorityFilter);
    if (typeFilter) params.set("alert_type", typeFilter);

    fetch(`${apiBaseUrl}/api/v1/alerts?${params}`, { headers: authHeaders() })
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => {
        setAlerts(data.alerts || data || []);
        if (typeof data.total === "number") setTotal(data.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  }, [authHeaders, isOffline, page, stateFilter, priorityFilter, typeFilter]);

  return (
    <>
      <div className="page__header"><h1>{t("alerts.title")}</h1></div>
      {error && <AlertUI variant="error">{error}</AlertUI>}

      <div className="filter-bar">
        <Field label={t("filter.state")} htmlFor="filter-state">
          <Select id="filter-state" value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}>
            <option value="">{t("filter.all")}</option>
            {facetOptions(facets.state_id, ["NEW", "IN_REVIEW", "ESCALATED_SUPERVISOR", "ESCALATED_LEGAL", "CLOSED", "DISMISSED"])}
          </Select>
        </Field>
        <Field label={t("filter.priority")} htmlFor="filter-priority">
          <Select id="filter-priority" value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}>
            <option value="">{t("filter.all")}</option>
            {facetOptions(facets.priority, ["HIGH", "MEDIUM", "LOW"])}
          </Select>
        </Field>
        <Field label={t("filter.type")} htmlFor="filter-type">
          <Select id="filter-type" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
            <option value="">{t("filter.all")}</option>
            {facetOptions(facets.alert_type, ["KEYWORD_MATCH", "THREAT_SCORE", "MANUAL"])}
          </Select>
        </Field>
      </div>

      {loading ? <div className="loading-center">{t("common.loading")}</div> : alerts.length === 0 ? (
        <div className="empty-state"><h3>{t("alerts.no_alerts")}</h3></div>
      ) : (
        <>
          <table className="entity-table">
            <thead><tr><th>{t("alerts.priority")}</th><th>{t("alerts.type")}</th><th>{t("common.title")}</th><th>{t("alerts.status")}</th><th>{t("alerts.assigned")}</th><th>{t("alerts.created")}</th></tr></thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.alert_id} className="entity-table__clickable" onClick={() => onSelect(a.alert_id)}>
                  <td data-label={t("alerts.priority")}><span className={`badge badge--${a.priority?.toLowerCase() || "default"}`}>{a.priority}</span></td>
                  <td data-label={t("alerts.type")}>{a.alert_type}</td>
                  <td data-label={t("common.title")}>{a.title}</td>
                  <td data-label={t("alerts.status")}><span className="badge badge--default">{a.state_id}</span></td>
                  <td data-label={t("alerts.assigned")}>{a.assigned_to || "—"}</td>
                  <td data-label={t("alerts.created")}>{a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} total={total} limit={LIMIT} onPageChange={setPage} />
        </>
      )}
    </>
  );
}
