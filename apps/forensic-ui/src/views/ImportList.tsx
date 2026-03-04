import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Select, Pagination, Field } from "@puda/shared";
import { apiBaseUrl, ImportJob } from "../types";

const LIMIT = 20;

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean; onSelect: (id: string) => void };

export default function ImportList({ authHeaders, isOffline, onSelect }: Props) {
  const { t } = useTranslation();
  const [imports, setImports] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stateFilter, setStateFilter] = useState("");

  useEffect(() => {
    if (isOffline) { setLoading(false); return; }
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(LIMIT));
    params.set("offset", String((page - 1) * LIMIT));
    if (stateFilter) params.set("state_id", stateFilter);

    fetch(`${apiBaseUrl}/api/v1/imports?${params}`, { headers: authHeaders() })
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => {
        setImports(data.imports || data || []);
        if (typeof data.total === "number") setTotal(data.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load imports"))
      .finally(() => setLoading(false));
  }, [authHeaders, isOffline, page, stateFilter]);

  return (
    <>
      <div className="page__header"><h1>{t("imports.title")}</h1></div>

      <div className="filter-bar">
        <Field label={t("filter.state")} htmlFor="filter-state">
          <Select id="filter-state" value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}>
            <option value="">{t("filter.all")}</option>
            <option value="QUEUED">QUEUED</option>
            <option value="PARSING">PARSING</option>
            <option value="NORMALIZED">NORMALIZED</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="COMPLETED_WITH_WARNINGS">COMPLETED_WITH_WARNINGS</option>
            <option value="FAILED">FAILED</option>
            <option value="CANCELLED">CANCELLED</option>
          </Select>
        </Field>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {loading ? <div className="loading-center">{t("common.loading")}</div> : imports.length === 0 ? (
        <div className="empty-state"><h3>{t("imports.no_imports")}</h3></div>
      ) : (
        <>
          <table className="entity-table">
            <thead><tr><th>{t("imports.job_type")}</th><th>{t("imports.progress")}</th><th>{t("imports.status")}</th><th>{t("detail.created_at")}</th></tr></thead>
            <tbody>
              {imports.map((j) => (
                <tr key={j.import_job_id} className="entity-table__clickable" onClick={() => onSelect(j.import_job_id)}>
                  <td data-label={t("imports.job_type")}>{j.job_type}</td>
                  <td data-label={t("imports.progress")}>{j.progress_pct}%</td>
                  <td data-label={t("imports.status")}><span className="badge badge--default">{j.state_id}</span></td>
                  <td data-label={t("detail.created_at")}>{j.created_at ? new Date(j.created_at).toLocaleDateString() : "—"}</td>
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
