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

const TERMINAL_STATES = ["CONVERTED_TO_CASE", "CLOSED_NO_ACTION", "FALSE_POSITIVE", "DISMISSED", "CLOSED"];

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
  const [capturingIds, setCapturingIds] = useState<Set<string>>(new Set());
  const [capturedIds, setCapturedIds] = useState<Set<string>>(new Set());
  const [convertingIds, setConvertingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (isOffline) return;
    fetch(`${apiBaseUrl}/api/v1/alerts/facets`, authHeaders())
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

    fetch(`${apiBaseUrl}/api/v1/alerts?${params}`, authHeaders())
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => {
        setAlerts(data.alerts || data || []);
        if (typeof data.total === "number") setTotal(data.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  }, [authHeaders, isOffline, page, stateFilter, priorityFilter, typeFilter]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleScreenshot = async (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (capturingIds.has(alertId) || capturedIds.has(alertId)) return;
    setCapturingIds((prev) => new Set(prev).add(alertId));
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/alerts/${alertId}/screenshot`, {
        ...authHeaders(),
        method: "POST",
        body: "{}",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `API ${res.status}`);
      }
      setCapturedIds((prev) => new Set(prev).add(alertId));
      setToast(t("alerts.capture_success"));
    } catch (err) {
      setToast(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setCapturingIds((prev) => { const s = new Set(prev); s.delete(alertId); return s; });
    }
  };

  const handleConvertToCase = async (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (convertingIds.has(alertId)) return;
    setConvertingIds((prev) => new Set(prev).add(alertId));
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/alerts/${alertId}/convert-to-case`, {
        ...authHeaders(),
        method: "POST",
        body: "{}",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `API ${res.status}`);
      }
      setAlerts((prev) => prev.map((a) =>
        a.alert_id === alertId ? { ...a, state_id: "CONVERTED_TO_CASE" } : a
      ));
      setToast(t("alerts.convert_success"));
    } catch (err) {
      setToast(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setConvertingIds((prev) => { const s = new Set(prev); s.delete(alertId); return s; });
    }
  };

  return (
    <>
      <div className="page__header"><h1>{t("alerts.title")}</h1></div>
      {error && <AlertUI variant="error">{error}</AlertUI>}
      {toast && <AlertUI variant="success">{toast}</AlertUI>}

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
          <div className="table-scroll">
            <table className="entity-table entity-table--compact">
              <thead><tr>
                <th style={{ width: "7%" }}>{t("alerts.priority")}</th>
                <th style={{ width: "10%" }}>{t("alerts.type")}</th>
                <th style={{ width: "28%" }}>{t("common.title")}</th>
                <th style={{ width: "12%" }}>{t("alerts.status")}</th>
                <th style={{ width: "10%" }}>{t("alerts.assigned")}</th>
                <th style={{ width: "9%" }}>{t("alerts.created")}</th>
                <th style={{ width: "5%" }}>{t("alerts.screenshot")}</th>
                <th style={{ width: "19%" }}>{t("alerts.actions")}</th>
              </tr></thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.alert_id} className="entity-table__clickable" onClick={() => onSelect(a.alert_id)}>
                    <td data-label={t("alerts.priority")}><span className={`badge badge--${a.priority?.toLowerCase() || "default"}`}>{a.priority}</span></td>
                    <td data-label={t("alerts.type")}>{a.alert_type}</td>
                    <td data-label={t("common.title")}>{a.title}</td>
                    <td data-label={t("alerts.status")}><span className="badge badge--default">{a.state_id}</span></td>
                    <td data-label={t("alerts.assigned")}>{a.assigned_to || "—"}</td>
                    <td data-label={t("alerts.created")}>{a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}</td>
                    <td data-label={t("alerts.screenshot")}>
                      <button
                        className="btn btn--icon"
                        disabled={isOffline || capturingIds.has(a.alert_id)}
                        aria-label={t("alerts.screenshot")}
                        onClick={(e) => handleScreenshot(a.alert_id, e)}
                      >
                        {capturingIds.has(a.alert_id) ? (
                          <span className="spinner spinner--sm" />
                        ) : capturedIds.has(a.alert_id) ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        )}
                      </button>
                    </td>
                    <td data-label={t("alerts.actions")}>
                      <button
                        className="btn btn--sm btn--primary"
                        disabled={isOffline || convertingIds.has(a.alert_id) || TERMINAL_STATES.includes(a.state_id)}
                        onClick={(e) => handleConvertToCase(a.alert_id, e)}
                      >
                        {convertingIds.has(a.alert_id)
                          ? t("alerts.converting")
                          : TERMINAL_STATES.includes(a.state_id)
                            ? t("alerts.converted")
                            : t("alerts.convert_case")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={total} limit={LIMIT} onPageChange={setPage} />
        </>
      )}
    </>
  );
}
