import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Select, Field, Pagination } from "@puda/shared";
import { apiBaseUrl, SubjectProfile } from "../types";

const LIMIT = 20;

type Props = {
  authHeaders: () => Record<string, string>;
  isOffline: boolean;
  onSelect: (id: string) => void;
};

export default function SubjectList({ authHeaders, isOffline, onSelect }: Props) {
  const { t } = useTranslation();
  const [subjects, setSubjects] = useState<SubjectProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stateFilter, setStateFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");

  useEffect(() => {
    if (isOffline) { setLoading(false); return; }
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(LIMIT));
    params.set("offset", String((page - 1) * LIMIT));
    if (stateFilter) params.set("state_id", stateFilter);
    if (genderFilter) params.set("gender", genderFilter);

    fetch(`${apiBaseUrl}/api/v1/subjects?${params}`, { headers: authHeaders() })
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => {
        setSubjects(data.subjects || data || []);
        setTotal(data.total ?? 0);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load subjects"))
      .finally(() => setLoading(false));
  }, [authHeaders, isOffline, page, stateFilter, genderFilter]);

  return (
    <>
      <div className="page__header">
        <h1>{t("subjects.title")}</h1>
      </div>

      <div className="filter-bar">
        <Field label={t("filter.state")} htmlFor="filter-state">
          <Select id="filter-state" value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}>
            <option value="">{t("filter.all")}</option>
            <option value="DRAFT">DRAFT</option>
            <option value="PENDING_REVIEW">PENDING_REVIEW</option>
            <option value="PUBLISHED">PUBLISHED</option>
            <option value="CONFLICTING">CONFLICTING</option>
          </Select>
        </Field>
        <Field label={t("filter.gender")} htmlFor="filter-gender">
          <Select id="filter-gender" value={genderFilter} onChange={(e) => { setGenderFilter(e.target.value); setPage(1); }}>
            <option value="">{t("filter.all")}</option>
            <option value="MALE">MALE</option>
            <option value="FEMALE">FEMALE</option>
            <option value="OTHER">OTHER</option>
          </Select>
        </Field>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {loading ? (
        <div className="loading-center">{t("common.loading")}</div>
      ) : subjects.length === 0 ? (
        <div className="empty-state"><h3>{t("subjects.no_subjects")}</h3></div>
      ) : (
        <>
          <table className="entity-table">
            <thead>
              <tr>
                <th>{t("subjects.name")}</th>
                <th>{t("subjects.aliases")}</th>
                <th>{t("subjects.risk_score")}</th>
                <th>{t("subjects.gender")}</th>
                <th>{t("subjects.status")}</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.subject_id} className="entity-table__clickable" onClick={() => onSelect(s.subject_id)}>
                  <td data-label={t("subjects.name")}>{s.full_name}</td>
                  <td data-label={t("subjects.aliases")}>{Array.isArray(s.aliases) ? s.aliases.join(", ") : "—"}</td>
                  <td data-label={t("subjects.risk_score")}>
                    <span className={`badge badge--${s.risk_score >= 7 ? "critical" : s.risk_score >= 4 ? "warning" : "low"}`}>
                      {s.risk_score}
                    </span>
                  </td>
                  <td data-label={t("subjects.gender")}>{s.gender || "—"}</td>
                  <td data-label={t("subjects.status")}><span className="badge badge--default">{s.state_id}</span></td>
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
