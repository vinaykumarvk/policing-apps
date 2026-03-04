import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Select, Pagination, Field } from "@puda/shared";
import { apiBaseUrl, ForensicCase } from "../types";

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

export default function CaseList({ authHeaders, isOffline, onSelect }: Props) {
  const { t } = useTranslation();
  const [cases, setCases] = useState<ForensicCase[]>([]);
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
    fetch(`${apiBaseUrl}/api/v1/cases/facets`, { headers: authHeaders() })
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
    if (typeFilter) params.set("case_type", typeFilter);

    fetch(`${apiBaseUrl}/api/v1/cases?${params}`, { headers: authHeaders() })
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => {
        setCases(data.cases || data || []);
        if (typeof data.total === "number") setTotal(data.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load cases"))
      .finally(() => setLoading(false));
  }, [authHeaders, isOffline, page, stateFilter, priorityFilter, typeFilter]);

  return (
    <>
      <div className="page__header"><h1>{t("cases.title")}</h1></div>

      <div className="filter-bar">
        <Field label={t("filter.state")} htmlFor="filter-state">
          <Select id="filter-state" value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}>
            <option value="">{t("filter.all")}</option>
            {facetOptions(facets.state_id, ["DRAFT", "ACTIVE", "INGESTION_IN_PROGRESS", "UNDER_REVIEW", "REPORT_READY", "SUBMITTED", "CLOSED", "REOPENED"])}
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
            {facetOptions(facets.case_type, [])}
          </Select>
        </Field>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {loading ? <div className="loading-center">{t("common.loading")}</div> : cases.length === 0 ? (
        <div className="empty-state"><h3>{t("cases.no_cases")}</h3></div>
      ) : (
        <>
          <table className="entity-table">
            <thead><tr><th>{t("cases.case_number")}</th><th>{t("common.title")}</th><th>{t("cases.type")}</th><th>{t("cases.priority")}</th><th>{t("cases.status")}</th><th>{t("cases.assigned")}</th></tr></thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.case_id} className="entity-table__clickable" onClick={() => onSelect(c.case_id)}>
                  <td data-label={t("cases.case_number")}>{c.case_number}</td>
                  <td data-label={t("common.title")}>{c.title}</td>
                  <td data-label={t("cases.type")}>{c.case_type}</td>
                  <td data-label={t("cases.priority")}><span className={`badge badge--${c.priority?.toLowerCase() || "default"}`}>{c.priority}</span></td>
                  <td data-label={t("cases.status")}><span className="badge badge--default">{c.state_id}</span></td>
                  <td data-label={t("cases.assigned")}>{c.assigned_to || "—"}</td>
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
