import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Select, Field, Input, Pagination } from "@puda/shared";
import { apiBaseUrl, ContentItem } from "../types";

const LIMIT = 20;

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean; onSelect: (id: string) => void };

export default function ContentList({ authHeaders, isOffline, onSelect }: Props) {
  const { t } = useTranslation();
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [platformFilter, setPlatformFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

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
            <option value="TWITTER">TWITTER</option>
            <option value="FACEBOOK">FACEBOOK</option>
            <option value="INSTAGRAM">INSTAGRAM</option>
            <option value="YOUTUBE">YOUTUBE</option>
            <option value="TELEGRAM">TELEGRAM</option>
            <option value="WHATSAPP">WHATSAPP</option>
          </Select>
        </Field>
        <Field label={t("filter.category")} htmlFor="filter-category">
          <Input id="filter-category" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} placeholder={t("filter.category")} />
        </Field>
      </div>

      {loading ? <div className="loading-center">{t("common.loading")}</div> : content.length === 0 ? (
        <div className="empty-state"><h3>{t("content.no_content")}</h3></div>
      ) : (
        <>
          <table className="entity-table">
            <thead><tr><th>{t("content.platform")}</th><th>{t("content.author")}</th><th>{t("content.content_heading")}</th><th>{t("content.threat_score")}</th><th>{t("content.published")}</th></tr></thead>
            <tbody>
              {content.map((c) => (
                <tr key={c.content_id} className="entity-table__clickable" onClick={() => onSelect(c.content_id)}>
                  <td data-label={t("content.platform")}>{c.platform}</td>
                  <td data-label={t("content.author")}>{c.author_handle}</td>
                  <td data-label={t("content.content_heading")}>{c.content_text?.slice(0, 80)}{c.content_text?.length > 80 ? "..." : ""}</td>
                  <td data-label={t("content.threat_score")}><span className={`badge badge--${c.threat_score >= 7 ? "critical" : c.threat_score >= 4 ? "warning" : "low"}`}>{c.threat_score}</span></td>
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
