import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Select, Field, Pagination } from "@puda/shared";
import { apiBaseUrl, ContentItem } from "../types";

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

export default function ContentList({ authHeaders, isOffline, onSelect }: Props) {
  const { t } = useTranslation();
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [platformFilter, setPlatformFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [facets, setFacets] = useState<Facets>({});

  useEffect(() => {
    if (isOffline) return;
    fetch(`${apiBaseUrl}/api/v1/content/facets`, { headers: authHeaders() })
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
    if (platformFilter) params.set("platform", platformFilter);
    if (categoryFilter) params.set("category_id", categoryFilter);

    fetch(`${apiBaseUrl}/api/v1/content?${params}`, { headers: authHeaders() })
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => {
        setContent(data.content || data || []);
        if (typeof data.total === "number") setTotal(data.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  }, [authHeaders, isOffline, page, platformFilter, categoryFilter]);

  return (
    <>
      <div className="page__header"><h1>{t("content.title")}</h1></div>
      {error && <Alert variant="error">{error}</Alert>}

      <div className="filter-bar">
        <Field label={t("filter.platform")} htmlFor="filter-platform">
          <Select id="filter-platform" value={platformFilter} onChange={(e) => { setPlatformFilter(e.target.value); setPage(1); }}>
            <option value="">{t("filter.all")}</option>
            {facetOptions(facets.platform, ["TWITTER", "FACEBOOK", "INSTAGRAM", "YOUTUBE", "TELEGRAM", "WHATSAPP"])}
          </Select>
        </Field>
        <Field label={t("filter.category")} htmlFor="filter-category">
          <Select id="filter-category" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
            <option value="">{t("filter.all")}</option>
            {facetOptions(facets.category_id, [])}
          </Select>
        </Field>
      </div>

      {loading ? <div className="loading-center">{t("common.loading")}</div> : content.length === 0 ? (
        <div className="empty-state"><h3>{t("content.no_content")}</h3></div>
      ) : (
        <>
          <table className="entity-table">
            <thead><tr><th>{t("content.platform")}</th><th>{t("content.author")}</th><th>{t("content.content_heading")}</th><th>{t("filter.category")}</th><th>{t("content.threat_score")}</th><th>{t("content.published")}</th></tr></thead>
            <tbody>
              {content.map((c) => (
                <tr key={c.content_id} className="entity-table__clickable" onClick={() => onSelect(c.content_id)}>
                  <td data-label={t("content.platform")}>{c.platform}</td>
                  <td data-label={t("content.author")}>{c.author_handle}</td>
                  <td data-label={t("content.content_heading")}>{c.content_text?.slice(0, 80)}{c.content_text?.length > 80 ? "..." : ""}</td>
                  <td data-label={t("filter.category")}><span className="badge badge--default">{c.category_name || "—"}</span></td>
                  <td data-label={t("content.threat_score")}><span className={`badge badge--${Number(c.threat_score) >= 70 ? "critical" : Number(c.threat_score) >= 40 ? "warning" : "low"}`}>{c.threat_score}</span></td>
                  <td data-label={t("content.published")}>{c.published_at ? new Date(c.published_at).toLocaleDateString() : "—"}</td>
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
