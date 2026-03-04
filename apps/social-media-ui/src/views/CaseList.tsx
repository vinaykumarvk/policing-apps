import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Select, Field, Pagination } from "@puda/shared";
import { apiBaseUrl, CaseRecord } from "../types";

const LIMIT = 20;

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean; onSelect: (id: string) => void };

export default function CaseList({ authHeaders, isOffline, onSelect }: Props) {
  const { t } = useTranslation();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stateFilter, setStateFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  useEffect(() => {
    if (isOffline) { setLoading(false); return; }
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(LIMIT));
    params.set("offset", String((page - 1) * LIMIT));
    if (stateFilter) params.set("state_id", stateFilter);
    if (priorityFilter) params.set("priority", priorityFilter);

    fetch(`${apiBaseUrl}/api/v1/cases?${params}`, { headers: authHeaders() })
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => {
        setCases(data.cases || data || []);
        if (typeof data.total === "number") setTotal(data.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  }, [authHeaders, isOffline, page, stateFilter, priorityFilter]);

  return (
    <>
      <div className="page__header"><h1>{t("cases.title")}</h1></div>
      {error && <Alert variant="error">{error}</Alert>}

      <div className="filter-bar">
        <Field label={t("filter.state")} htmlFor="filter-state">
          <Select id="filter-state" value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}>
            <option value="">{t("filter.all")}</option>
            <option value="OPEN">OPEN</option>
            <option value="ASSIGNED">ASSIGNED</option>
            <option value="UNDER_INVESTIGATION">UNDER_INVESTIGATION</option>
            <option value="PENDING_REVIEW">PENDING_REVIEW</option>
            <option value="CLOSED">CLOSED</option>
          </Select>
        </Field>
        <Field label={t("filter.priority")} htmlFor="filter-priority">
          <Select id="filter-priority" value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}>
            <option value="">{t("filter.all")}</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </Select>
        </Field>
      </div>

      {loading ? <div className="loading-center">{t("common.loading")}</div> : cases.length === 0 ? (
        <div className="empty-state"><h3>{t("cases.no_cases")}</h3></div>
      ) : (
        <>
          <table className="entity-table">
            <thead><tr><th>{t("cases.case_number")}</th><th>{t("common.title")}</th><th>{t("cases.priority")}</th><th>{t("cases.status")}</th><th>{t("cases.assigned")}</th></tr></thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.case_id} className="entity-table__clickable" onClick={() => onSelect(c.case_id)}>
                  <td data-label={t("cases.case_number")}>{c.case_number}</td>
                  <td data-label={t("common.title")}>{c.title}</td>
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
