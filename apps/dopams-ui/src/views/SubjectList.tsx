import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Select, Field, Pagination, Button } from "@puda/shared";
import { apiBaseUrl, SubjectProfile } from "../types";

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

export default function SubjectList({ authHeaders, isOffline, onSelect }: Props) {
  const { t } = useTranslation();
  const [subjects, setSubjects] = useState<SubjectProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stateFilter, setStateFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [offenderStatusFilter, setOffenderStatusFilter] = useState("");
  const [cdrStatusFilter, setCdrStatusFilter] = useState("");
  const [threatLevelFilter, setThreatLevelFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [facets, setFacets] = useState<Facets>({});
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const activeFilterCount = useMemo(() =>
    [stateFilter, genderFilter, offenderStatusFilter, cdrStatusFilter, threatLevelFilter, districtFilter].filter(Boolean).length,
    [stateFilter, genderFilter, offenderStatusFilter, cdrStatusFilter, threatLevelFilter, districtFilter],
  );

  useEffect(() => {
    if (isOffline) return;
    fetch(`${apiBaseUrl}/api/v1/subjects/facets`, authHeaders())
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
    if (genderFilter) params.set("gender", genderFilter);
    if (offenderStatusFilter) params.set("offender_status", offenderStatusFilter);
    if (cdrStatusFilter) params.set("cdr_status", cdrStatusFilter);
    if (threatLevelFilter) params.set("threat_level", threatLevelFilter);
    if (districtFilter) params.set("district", districtFilter);

    fetch(`${apiBaseUrl}/api/v1/subjects?${params}`, authHeaders())
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => {
        setSubjects(data.subjects || data || []);
        setTotal(data.total ?? 0);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load subjects"))
      .finally(() => setLoading(false));
  }, [authHeaders, isOffline, page, stateFilter, genderFilter, offenderStatusFilter, cdrStatusFilter, threatLevelFilter, districtFilter]);

  const resetPage = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value);
    setPage(1);
  };

  const clearAllFilters = () => {
    setStateFilter("");
    setGenderFilter("");
    setOffenderStatusFilter("");
    setCdrStatusFilter("");
    setThreatLevelFilter("");
    setDistrictFilter("");
    setPage(1);
  };

  return (
    <>
      <div className="page__header">
        <h1>{t("subjects.title")}</h1>
      </div>

      {/* ── Compact Filter Section ── */}
      <div className="filter-panel">
        {/* Primary row: always visible — most-used filters + toggle */}
        <div className="filter-panel__primary">
          <Field label={t("filter.threat_level")} htmlFor="filter-threat">
            <Select id="filter-threat" value={threatLevelFilter} onChange={resetPage(setThreatLevelFilter)}>
              <option value="">{t("filter.all")}</option>
              {facetOptions(facets.threat_level, ["UNKNOWN", "LOW", "MEDIUM", "HIGH", "CRITICAL"])}
            </Select>
          </Field>
          <Field label={t("filter.offender_status")} htmlFor="filter-offender">
            <Select id="filter-offender" value={offenderStatusFilter} onChange={resetPage(setOffenderStatusFilter)}>
              <option value="">{t("filter.all")}</option>
              {facetOptions(facets.offender_status, ["UNKNOWN", "SUSPECT", "ACCUSED", "CONVICTED", "ACQUITTED", "ABSCONDING", "DECEASED"])}
            </Select>
          </Field>
          <Field label={t("filter.district")} htmlFor="filter-district">
            <Select id="filter-district" value={districtFilter} onChange={resetPage(setDistrictFilter)}>
              <option value="">{t("filter.all")}</option>
              {facetOptions(facets.district, [])}
            </Select>
          </Field>
          <div className="filter-panel__actions">
            <button
              type="button"
              className="filter-panel__toggle"
              onClick={() => setFiltersExpanded((v) => !v)}
              aria-expanded={filtersExpanded}
              aria-controls="filter-expanded"
            >
              {filtersExpanded ? t("subjects.fewer_filters") : t("subjects.more_filters")}
              {activeFilterCount > 0 && (
                <span className="filter-panel__count">{activeFilterCount}</span>
              )}
            </button>
            {activeFilterCount > 0 && (
              <button type="button" className="filter-panel__clear" onClick={clearAllFilters}>
                {t("subjects.clear_filters")}
              </button>
            )}
          </div>
        </div>

        {/* Expanded row: additional filters */}
        {filtersExpanded && (
          <div className="filter-panel__expanded" id="filter-expanded">
            <Field label={t("filter.state")} htmlFor="filter-state">
              <Select id="filter-state" value={stateFilter} onChange={resetPage(setStateFilter)}>
                <option value="">{t("filter.all")}</option>
                {facetOptions(facets.state_id, ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "CONFLICTING"])}
              </Select>
            </Field>
            <Field label={t("filter.gender")} htmlFor="filter-gender">
              <Select id="filter-gender" value={genderFilter} onChange={resetPage(setGenderFilter)}>
                <option value="">{t("filter.all")}</option>
                {facetOptions(facets.gender, ["MALE", "FEMALE", "OTHER"])}
              </Select>
            </Field>
            <Field label={t("filter.cdr_status")} htmlFor="filter-cdr">
              <Select id="filter-cdr" value={cdrStatusFilter} onChange={resetPage(setCdrStatusFilter)}>
                <option value="">{t("filter.all")}</option>
                {facetOptions(facets.cdr_status, ["NOT_REQUESTED", "REQUESTED", "RECEIVED", "UNDER_ANALYSIS", "COMPLETED"])}
              </Select>
            </Field>
          </div>
        )}
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
                <th>{t("subject.offender_status")}</th>
                <th>{t("subject.threat_level")}</th>
                <th>{t("subjects.gender")}</th>
                <th>{t("subjects.status")}</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.subject_id} className="entity-table__clickable" onClick={() => onSelect(s.subject_id)} tabIndex={0} role="link" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(s.subject_id); } }}>
                  <td data-label={t("subjects.name")}>{s.full_name}</td>
                  <td data-label={t("subjects.aliases")}>{Array.isArray(s.aliases) ? s.aliases.join(", ") : "—"}</td>
                  <td data-label={t("subjects.risk_score")}>
                    <span className={`badge badge--${s.risk_score >= 7 ? "critical" : s.risk_score >= 4 ? "warning" : "low"}`}>
                      {s.risk_score}
                    </span>
                  </td>
                  <td data-label={t("subject.offender_status")}>
                    <span className={`badge badge--${(s as any).offender_status === "CONVICTED" ? "critical" : (s as any).offender_status === "ABSCONDING" ? "warning" : "default"}`}>
                      {(s as any).offender_status || "—"}
                    </span>
                  </td>
                  <td data-label={t("subject.threat_level")}>
                    {s.threat_level ? (
                      <span className={`badge badge--${s.threat_level === "CRITICAL" || s.threat_level === "HIGH" ? "critical" : s.threat_level === "MEDIUM" ? "warning" : "default"}`}>
                        {s.threat_level}
                      </span>
                    ) : "—"}
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
