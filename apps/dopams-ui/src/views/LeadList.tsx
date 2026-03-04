import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Select, Field, Pagination } from "@puda/shared";
import { apiBaseUrl, Lead } from "../types";

const LIMIT = 20;

type FacetEntry = { value: string; label?: string; count: number };
type Facets = Record<string, FacetEntry[]>;

type Props = {
  authHeaders: () => Record<string, string>;
  isOffline: boolean;
  onSelect: (id: string) => void;
};

function facetOptions(entries: FacetEntry[] | undefined, fallback: string[]) {
  if (entries && entries.length > 0) {
    return entries.map((f) => <option key={f.value} value={f.value}>{f.label || f.value} ({f.count})</option>);
  }
  return fallback.map((v) => <option key={v} value={v}>{v}</option>);
}

export default function LeadList({ authHeaders, isOffline, onSelect }: Props) {
  const { t } = useTranslation();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stateFilter, setStateFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [facets, setFacets] = useState<Facets>({});

  useEffect(() => {
    if (isOffline) return;
    fetch(`${apiBaseUrl}/api/v1/leads/facets`, { headers: authHeaders() })
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
    if (sourceFilter) params.set("source_type", sourceFilter);

    fetch(`${apiBaseUrl}/api/v1/leads?${params}`, { headers: authHeaders() })
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => {
        setLeads(data.leads || data || []);
        setTotal(data.total ?? 0);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load leads"))
      .finally(() => setLoading(false));
  }, [authHeaders, isOffline, page, stateFilter, priorityFilter, sourceFilter]);

  return (
    <>
      <div className="page__header">
        <h1>{t("leads.title")}</h1>
      </div>

      <div className="filter-bar">
        <Field label={t("filter.state")} htmlFor="filter-state">
          <Select id="filter-state" value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}>
            <option value="">{t("filter.all")}</option>
            {facetOptions(facets.state_id, ["NEW", "VALIDATED", "MEMO_GENERATED", "APPROVAL_PENDING", "ROUTED", "IN_ACTION", "CLOSED", "REJECTED"])}
          </Select>
        </Field>
        <Field label={t("filter.priority")} htmlFor="filter-priority">
          <Select id="filter-priority" value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}>
            <option value="">{t("filter.all")}</option>
            {facetOptions(facets.priority, ["HIGH", "MEDIUM", "LOW"])}
          </Select>
        </Field>
        <Field label={t("filter.source")} htmlFor="filter-source">
          <Select id="filter-source" value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}>
            <option value="">{t("filter.all")}</option>
            {facetOptions(facets.source_type, [])}
          </Select>
        </Field>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {loading ? (
        <div className="loading-center">{t("common.loading")}</div>
      ) : leads.length === 0 ? (
        <div className="empty-state"><h3>{t("leads.no_leads")}</h3></div>
      ) : (
        <>
          <table className="entity-table">
            <thead>
              <tr>
                <th>{t("leads.priority")}</th>
                <th>{t("leads.source")}</th>
                <th>{t("leads.summary")}</th>
                <th>{t("leads.status")}</th>
                <th>{t("leads.assigned")}</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.lead_id} className="entity-table__clickable" onClick={() => onSelect(l.lead_id)}>
                  <td data-label={t("leads.priority")}><span className={`badge badge--${l.priority?.toLowerCase() || "default"}`}>{l.priority}</span></td>
                  <td data-label={t("leads.source")}>{l.source_type}</td>
                  <td data-label={t("leads.summary")}>{l.summary}</td>
                  <td data-label={t("leads.status")}><span className="badge badge--default">{l.state_id}</span></td>
                  <td data-label={t("leads.assigned")}>{l.assigned_to || "—"}</td>
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
