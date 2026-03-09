import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Field, Pagination } from "@puda/shared";
import { apiBaseUrl, ContentItem } from "../types";

const LIMIT = 20;

type FacetEntry = { value: string; label?: string; count: number };
type Facets = Record<string, FacetEntry[]>;
type MultiSelectOption = { value: string; label: string; count?: number };

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean; onSelect: (id: string) => void };

/* ── Inline Multi-Select ─────────────────────────────────────────────────────── */
function MultiSelect({ id, options, selected, onChange, placeholder }: {
  id: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  };

  const allSelected = options.length > 0 && selected.length === options.length;
  const toggleAll = () => onChange(allSelected ? [] : options.map(o => o.value));

  const label = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? (options.find(o => o.value === selected[0])?.label || selected[0])
      : `${selected.length} selected`;

  return (
    <div className="multi-select" ref={ref}>
      <button
        type="button"
        id={id}
        className="multi-select__trigger"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="multi-select__label">{label}</span>
        <span className="multi-select__arrow">{open ? "\u25B2" : "\u25BC"}</span>
      </button>
      {open && (
        <div className="multi-select__dropdown">
          {options.length > 1 && (
            <label className="multi-select__option multi-select__option--all">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              <span>Select All</span>
            </label>
          )}
          {options.map(opt => (
            <label key={opt.value} className="multi-select__option">
              <input type="checkbox" checked={selected.includes(opt.value)} onChange={() => toggle(opt.value)} />
              <span>{opt.label}{opt.count != null ? ` (${opt.count})` : ""}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Language label helper ───────────────────────────────────────────────────── */
const LANG_LABELS: Record<string, string> = { en: "English", te: "Telugu", hi: "Hindi", pa: "Punjabi", ur: "Urdu" };

export default function ContentList({ authHeaders, isOffline, onSelect }: Props) {
  const { t } = useTranslation();
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<Facets>({});
  const [reloadKey, setReloadKey] = useState(0);

  // Filters
  const [platformFilter, setPlatformFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [languageFilter, setLanguageFilter] = useState<string[]>([]);
  const [authorInput, setAuthorInput] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [threatScoreMin, setThreatScoreMin] = useState(0);
  const [dateRange, setDateRange] = useState<"" | "today" | "7d" | "30d">("");

  // Fetch demo state
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState<string | null>(null);

  // Debounce author input
  useEffect(() => {
    const timer = setTimeout(() => { setAuthorFilter(authorInput); setPage(1); }, 400);
    return () => clearTimeout(timer);
  }, [authorInput]);

  // Load facets
  useEffect(() => {
    if (isOffline) return;
    fetch(`${apiBaseUrl}/api/v1/content/facets`, authHeaders())
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setFacets(data.facets || {}); })
      .catch(() => {});
  }, [authHeaders, isOffline, reloadKey]);

  // Load content
  useEffect(() => {
    if (isOffline) { setLoading(false); return; }
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(LIMIT));
    params.set("offset", String((page - 1) * LIMIT));
    if (platformFilter.length) params.set("platform", platformFilter.join(","));
    if (categoryFilter.length) params.set("category_id", categoryFilter.join(","));
    if (languageFilter.length) params.set("language", languageFilter.join(","));
    if (authorFilter.trim()) params.set("author", authorFilter.trim());
    if (threatScoreMin > 0) params.set("threat_score_min", String(threatScoreMin));
    if (dateRange) params.set("date_range", dateRange);

    fetch(`${apiBaseUrl}/api/v1/content?${params}`, authHeaders())
      .then(r => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then(data => {
        setContent(data.content || data || []);
        if (typeof data.total === "number") setTotal(data.total);
      })
      .catch(err => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  }, [authHeaders, isOffline, page, platformFilter, categoryFilter, languageFilter, authorFilter, threatScoreMin, dateRange, reloadKey]);

  // Fetch demo posts
  const handleFetch = async () => {
    setFetching(true);
    setFetchMsg(null);
    setError(null);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/v1/content/fetch-demo`, {
        ...authHeaders(),
        method: "POST",
        body: JSON.stringify({}),
      });
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      const data = await resp.json();
      setFetchMsg(t("content.fetch_success", { count: data.inserted || 25 }));
      setPage(1);
      setReloadKey(k => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      setFetching(false);
    }
  };

  // Build multi-select options from facets
  const platformOptions: MultiSelectOption[] = (facets.platform || []).map(f => ({
    value: f.value, label: f.label || f.value, count: f.count,
  }));
  if (platformOptions.length === 0) {
    ["TWITTER", "FACEBOOK", "INSTAGRAM", "YOUTUBE", "TELEGRAM"].forEach(p =>
      platformOptions.push({ value: p, label: p }),
    );
  }

  const categoryOptions: MultiSelectOption[] = (facets.category_id || []).map(f => ({
    value: f.value, label: f.label || f.value, count: f.count,
  }));

  const languageOptions: MultiSelectOption[] = (facets.language || []).map(f => ({
    value: f.value, label: f.label || LANG_LABELS[f.value] || f.value, count: f.count,
  }));
  if (languageOptions.length === 0) {
    (["en", "te", "hi", "pa"] as const).forEach(l =>
      languageOptions.push({ value: l, label: LANG_LABELS[l] }),
    );
  }

  return (
    <>
      <div className="page__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-3)" }}>
        <h1>{t("content.title")}</h1>
        <Button variant="primary" onClick={handleFetch} disabled={fetching || isOffline}>
          {fetching ? t("content.fetching") : t("content.fetch_posts")}
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {fetchMsg && <Alert variant="success">{fetchMsg}</Alert>}

      {/* Row 1: Platform, Category, Language, Author */}
      <div className="filter-bar">
        <Field label={t("filter.platform")} htmlFor="filter-platform">
          <MultiSelect
            id="filter-platform"
            options={platformOptions}
            selected={platformFilter}
            onChange={v => { setPlatformFilter(v); setPage(1); }}
            placeholder={t("filter.all")}
          />
        </Field>
        <Field label={t("filter.category")} htmlFor="filter-category">
          <MultiSelect
            id="filter-category"
            options={categoryOptions}
            selected={categoryFilter}
            onChange={v => { setCategoryFilter(v); setPage(1); }}
            placeholder={t("filter.all")}
          />
        </Field>
        <Field label={t("content.language")} htmlFor="filter-language">
          <MultiSelect
            id="filter-language"
            options={languageOptions}
            selected={languageFilter}
            onChange={v => { setLanguageFilter(v); setPage(1); }}
            placeholder={t("filter.all")}
          />
        </Field>
        <Field label={t("content.author")} htmlFor="filter-author">
          <input
            id="filter-author"
            type="text"
            className="ui-input"
            placeholder={t("content.author_placeholder")}
            value={authorInput}
            onChange={e => setAuthorInput(e.target.value)}
          />
        </Field>
      </div>

      {/* Row 2: Threat Score slider + Date Range chips */}
      <div className="filter-bar">
        <Field label={`${t("content.threat_score")} \u2265 ${threatScoreMin}`} htmlFor="filter-threat">
          <input
            id="filter-threat"
            type="range"
            min="0"
            max="100"
            value={threatScoreMin}
            onChange={e => { setThreatScoreMin(Number(e.target.value)); setPage(1); }}
            className="threat-slider"
          />
        </Field>
        <div className="ui-field" style={{ minWidth: "10rem", flex: "1 1 10rem" }}>
          <label className="ui-field__label">{t("content.date_range")}</label>
          <div className="filter-bar__chips">
            {(["", "today", "7d", "30d"] as const).map(v => (
              <button
                key={v}
                type="button"
                className={`filter-chip${dateRange === v ? " filter-chip--active" : ""}`}
                onClick={() => { setDateRange(v); setPage(1); }}
              >
                {v === "" ? t("filter.all") : v === "today" ? t("dashboard.preset_today") : v === "7d" ? t("dashboard.preset_7d") : t("dashboard.preset_30d")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? <div className="loading-center">{t("common.loading")}</div> : content.length === 0 ? (
        <div className="empty-state"><h3>{t("content.no_content")}</h3></div>
      ) : (
        <>
          <div className="table-scroll">
            <table className="entity-table entity-table--compact">
              <thead>
                <tr>
                  <th>{t("content.platform")}</th>
                  <th>{t("content.author")}</th>
                  <th>{t("content.content_heading")}</th>
                  <th>{t("content.language")}</th>
                  <th>{t("filter.category")}</th>
                  <th>{t("content.threat_score")}</th>
                  <th>{t("content.published")}</th>
                </tr>
              </thead>
              <tbody>
                {content.map(c => (
                  <tr key={c.content_id} className="entity-table__clickable" onClick={() => onSelect(c.content_id)}>
                    <td data-label={t("content.platform")}>{c.platform}</td>
                    <td data-label={t("content.author")} className="content-cell--author">{c.author_handle}</td>
                    <td data-label={t("content.content_heading")} className="content-cell">{c.content_text?.slice(0, 80)}{c.content_text?.length > 80 ? "\u2026" : ""}</td>
                    <td data-label={t("content.language")}>
                      <span className="badge badge--default">{LANG_LABELS[c.language] || c.language || "\u2014"}</span>
                    </td>
                    <td data-label={t("filter.category")}>
                      <span className="badge badge--default">{c.effective_category || c.category_name || t("content.unclassified")}</span>
                      {c.review_status === "NEEDS_REVIEW" && (
                        <span className="badge badge--warning" style={{ marginLeft: "var(--space-1)", fontSize: "0.7rem" }}>
                          {t("classify.needs_review")}
                        </span>
                      )}
                    </td>
                    <td data-label={t("content.threat_score")}>
                      <span className={`badge badge--${Number(c.threat_score) >= 70 ? "critical" : Number(c.threat_score) >= 40 ? "warning" : "low"}`}>
                        {c.threat_score}
                      </span>
                    </td>
                    <td data-label={t("content.published")}>{c.published_at ? new Date(c.published_at).toLocaleDateString() : "\u2014"}</td>
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
