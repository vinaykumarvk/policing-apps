import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Field, Input, Modal, useToast } from "@puda/shared";
import { apiBaseUrl, SlangEntry, EmojiDrugCode } from "../types";

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean };
type Tab = "dictionary" | "pending" | "emoji";
type SortCol = "term" | "normalized_form" | "category" | "language" | "risk_weight" | "submission_status" | "created_at";
type SortDir = "asc" | "desc";

export default function SlangAdmin({ authHeaders, isOffline }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  // Tab
  const [tab, setTab] = useState<Tab>("dictionary");

  // Data
  const [entries, setEntries] = useState<SlangEntry[]>([]);
  const [emojiCodes, setEmojiCodes] = useState<EmojiDrugCode[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  // Filters
  const [filterCategory, setFilterCategory] = useState("");
  const [filterLanguage, setFilterLanguage] = useState("");
  const [searchText, setSearchText] = useState("");
  const [facetCategories, setFacetCategories] = useState<string[]>([]);
  const [facetLanguages, setFacetLanguages] = useState<string[]>([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Sort
  const [sortBy, setSortBy] = useState<SortCol>("term");
  const [sortOrder, setSortOrder] = useState<SortDir>("asc");

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState(false);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [formTerm, setFormTerm] = useState("");
  const [formNormalized, setFormNormalized] = useState("");
  const [formCategory, setFormCategory] = useState("DRUGS");
  const [formLanguage, setFormLanguage] = useState("en");
  const [formRiskWeight, setFormRiskWeight] = useState("1.0");
  const [creating, setCreating] = useState(false);

  // Edit modal
  const [editEntry, setEditEntry] = useState<SlangEntry | null>(null);
  const [editTerm, setEditTerm] = useState("");
  const [editNormalized, setEditNormalized] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editLanguage, setEditLanguage] = useState("");
  const [editRiskWeight, setEditRiskWeight] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Debounce search input
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchText);
      setOffset(0);
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchText]);

  // Load facets (distinct categories/languages for dropdowns)
  useEffect(() => {
    if (isOffline) return;
    fetch(`${apiBaseUrl}/api/v1/slang/facets`, authHeaders())
      .then((r) => r.ok ? r.json() : { categories: [], languages: [] })
      .then((data) => {
        setFacetCategories(data.categories || []);
        setFacetLanguages(data.languages || []);
      })
      .catch(() => {});
  }, [authHeaders, isOffline]);

  // Load entries
  const loadEntries = useCallback(() => {
    if (isOffline) { setLoading(false); return; }
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("limit", String(LIMIT));
    params.set("offset", String(offset));
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);
    if (filterCategory) params.set("category", filterCategory);
    if (filterLanguage) params.set("language", filterLanguage);
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (tab === "pending") params.set("submissionStatus", "PENDING");

    fetch(`${apiBaseUrl}/api/v1/slang?${params}`, authHeaders())
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => { setEntries(data.entries || []); setTotal(data.total || 0); setSelected(new Set()); })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  }, [authHeaders, isOffline, offset, filterCategory, filterLanguage, debouncedSearch, sortBy, sortOrder, tab]);

  const loadEmojiCodes = useCallback(() => {
    if (isOffline) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    fetch(`${apiBaseUrl}/api/v1/emoji-codes`, authHeaders())
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => setEmojiCodes(data.entries || []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  }, [authHeaders, isOffline]);

  useEffect(() => {
    if (tab === "emoji") loadEmojiCodes();
    else loadEntries();
  }, [tab, loadEntries, loadEmojiCodes]);

  // Sort handler
  const handleSort = (col: SortCol) => {
    if (sortBy === col) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortOrder("asc");
    }
    setOffset(0);
  };

  const sortIcon = (col: SortCol) => {
    if (sortBy !== col) return " \u2195";
    return sortOrder === "asc" ? " \u2191" : " \u2193";
  };

  // Bulk select
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === entries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(entries.map((e) => e.slang_id)));
    }
  };

  // Batch action
  const handleBatchAction = async (action: "approve" | "reject" | "delete") => {
    if (selected.size === 0) return;
    setBatchAction(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/slang/batch`, {
        ...authHeaders(), method: "POST",
        body: JSON.stringify({ ids: Array.from(selected), action }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      showToast("success", t("slang.batch_success", { count: data.affected }));
      setSelected(new Set());
      loadEntries();
    } catch (err) { showToast("error", err instanceof Error ? err.message : "Failed"); }
    finally { setBatchAction(false); }
  };

  // Create
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOffline) return;
    setCreating(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/slang`, {
        ...authHeaders(), method: "POST",
        body: JSON.stringify({ term: formTerm, normalizedForm: formNormalized, category: formCategory, language: formLanguage, riskWeight: parseFloat(formRiskWeight) || 1.0 }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      showToast("success", t("slang.created_success"));
      setShowCreate(false);
      setFormTerm(""); setFormNormalized(""); setFormCategory("DRUGS"); setFormLanguage("en"); setFormRiskWeight("1.0");
      loadEntries();
    } catch (err) { showToast("error", err instanceof Error ? err.message : "Failed"); }
    finally { setCreating(false); }
  };

  // Edit
  const openEdit = (entry: SlangEntry) => {
    setEditEntry(entry);
    setEditTerm(entry.term);
    setEditNormalized(entry.normalized_form);
    setEditCategory(entry.category);
    setEditLanguage(entry.language);
    setEditRiskWeight(String(entry.risk_weight));
  };

  const handleSaveEdit = async () => {
    if (!editEntry) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/slang/${editEntry.slang_id}`, {
        ...authHeaders(), method: "PATCH",
        body: JSON.stringify({ term: editTerm, normalizedForm: editNormalized, category: editCategory, language: editLanguage, riskWeight: parseFloat(editRiskWeight) || 1.0 }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      showToast("success", t("slang.saved_success"));
      setEditEntry(null);
      loadEntries();
    } catch (err) { showToast("error", err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  };

  // Single actions
  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/slang/${id}/approve`, { ...authHeaders(), method: "POST", body: "{}" });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      showToast("success", t("slang.approved_success"));
      loadEntries();
    } catch (err) { showToast("error", err instanceof Error ? err.message : "Failed"); }
  };

  const handleReject = async (id: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/slang/${id}/reject`, { ...authHeaders(), method: "POST", body: "{}" });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      showToast("success", t("slang.rejected_success"));
      loadEntries();
    } catch (err) { showToast("error", err instanceof Error ? err.message : "Failed"); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/slang/${deleteId}`, { ...authHeaders(), method: "DELETE" });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      showToast("success", t("slang.deleted_success"));
      setDeleteId(null);
      loadEntries();
    } catch (err) { showToast("error", err instanceof Error ? err.message : "Failed"); }
    finally { setDeleting(false); }
  };

  const tabClass = (v: Tab) => `tab-btn ${tab === v ? "tab-btn--active" : ""}`;

  const hasPendingSelected = Array.from(selected).some((id) => entries.find((e) => e.slang_id === id)?.submission_status === "PENDING");

  return (
    <>
      <div className="page__header"><h1>{t("slang.title")}</h1></div>

      <div className="tab-bar" role="tablist">
        <button className={tabClass("dictionary")} onClick={() => { setTab("dictionary"); setOffset(0); setSelected(new Set()); }} role="tab" aria-selected={tab === "dictionary"} type="button">{t("slang.tab_dictionary")}</button>
        <button className={tabClass("pending")} onClick={() => { setTab("pending"); setOffset(0); setSelected(new Set()); }} role="tab" aria-selected={tab === "pending"} type="button">{t("slang.tab_pending")}</button>
        <button className={tabClass("emoji")} onClick={() => setTab("emoji")} role="tab" aria-selected={tab === "emoji"} type="button">{t("slang.tab_emoji")}</button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Dictionary / Pending tabs */}
      {tab !== "emoji" && (
        <div className="admin-section">
          <div className="admin-section__header">
            <h2>{tab === "pending" ? t("slang.pending_review") : t("slang.dictionary_heading")}</h2>
            {tab === "dictionary" && (
              <Button onClick={() => setShowCreate(!showCreate)} disabled={isOffline}>
                {showCreate ? t("common.cancel") : t("slang.add_entry")}
              </Button>
            )}
          </div>

          {/* Filters bar */}
          <div className="filter-bar" style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "var(--space-3)" }}>
            <Field label={t("slang.search")} htmlFor="slang-search">
              <Input id="slang-search" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder={t("slang.search_placeholder")} />
            </Field>
            <Field label={t("filter.category")} htmlFor="slang-cat">
              <select id="slang-cat" className="input" value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setOffset(0); }}>
                <option value="">{t("filter.all")}</option>
                {facetCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label={t("content.language")} htmlFor="slang-lang">
              <select id="slang-lang" className="input" value={filterLanguage} onChange={(e) => { setFilterLanguage(e.target.value); setOffset(0); }}>
                <option value="">{t("filter.all")}</option>
                {facetLanguages.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
          </div>

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="bulk-bar" style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", padding: "var(--space-2) var(--space-3)", background: "var(--color-surface-alt, var(--color-bg-alt, #f0f4f8))", borderRadius: "var(--radius-md)", marginBottom: "var(--space-3)" }}>
              <span style={{ fontWeight: 600 }}>{t("slang.selected_count", { count: selected.size })}</span>
              {hasPendingSelected && (
                <>
                  <Button onClick={() => handleBatchAction("approve")} disabled={batchAction || isOffline}>{t("slang.approve")}</Button>
                  <Button onClick={() => handleBatchAction("reject")} disabled={batchAction || isOffline}>{t("slang.reject")}</Button>
                </>
              )}
              <Button onClick={() => handleBatchAction("delete")} disabled={batchAction || isOffline}>{t("slang.delete")}</Button>
              <Button onClick={() => setSelected(new Set())}>{t("slang.clear_selection")}</Button>
            </div>
          )}

          {/* Create form */}
          {showCreate && (
            <form onSubmit={handleCreate} className="detail-section" style={{ marginBottom: "var(--space-4)" }}>
              <div className="detail-grid">
                <Field label={t("slang.term")} htmlFor="s-term" required>
                  <Input id="s-term" value={formTerm} onChange={(e) => setFormTerm(e.target.value)} required />
                </Field>
                <Field label={t("slang.normalized_form")} htmlFor="s-norm" required>
                  <Input id="s-norm" value={formNormalized} onChange={(e) => setFormNormalized(e.target.value)} required />
                </Field>
                <Field label={t("filter.category")} htmlFor="s-cat" required>
                  <Input id="s-cat" value={formCategory} onChange={(e) => setFormCategory(e.target.value)} required />
                </Field>
                <Field label={t("content.language")} htmlFor="s-lang">
                  <Input id="s-lang" value={formLanguage} onChange={(e) => setFormLanguage(e.target.value)} />
                </Field>
                <Field label={t("slang.risk_weight")} htmlFor="s-rw">
                  <Input id="s-rw" type="number" step="0.1" min="0" max="10" value={formRiskWeight} onChange={(e) => setFormRiskWeight(e.target.value)} />
                </Field>
              </div>
              <div style={{ marginTop: "var(--space-3)" }}>
                <Button type="submit" disabled={creating}>{creating ? t("common.loading") : t("common.create")}</Button>
              </div>
            </form>
          )}

          {/* Entries table */}
          {loading ? <div className="loading-center">{t("common.loading")}</div> : entries.length === 0 ? (
            <div className="empty-state"><h3>{t("slang.no_entries")}</h3></div>
          ) : (
            <>
              <div className="table-scroll">
              <table className="entity-table">
                <thead>
                  <tr>
                    <th style={{ width: "2.75rem" }}>
                      <input type="checkbox" checked={selected.size === entries.length && entries.length > 0} onChange={toggleSelectAll} aria-label={t("slang.select_all")} />
                    </th>
                    <th className="sortable-th" onClick={() => handleSort("term")} style={{ cursor: "pointer" }}>{t("slang.term")}{sortIcon("term")}</th>
                    <th className="sortable-th" onClick={() => handleSort("normalized_form")} style={{ cursor: "pointer" }}>{t("slang.normalized_form")}{sortIcon("normalized_form")}</th>
                    <th className="sortable-th" onClick={() => handleSort("category")} style={{ cursor: "pointer" }}>{t("filter.category")}{sortIcon("category")}</th>
                    <th className="sortable-th" onClick={() => handleSort("language")} style={{ cursor: "pointer" }}>{t("content.language")}{sortIcon("language")}</th>
                    <th className="sortable-th" onClick={() => handleSort("risk_weight")} style={{ cursor: "pointer" }}>{t("slang.risk_weight")}{sortIcon("risk_weight")}</th>
                    <th className="sortable-th" onClick={() => handleSort("submission_status")} style={{ cursor: "pointer" }}>{t("slang.status")}{sortIcon("submission_status")}</th>
                    <th>{t("models.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.slang_id} className={selected.has(e.slang_id) ? "row--selected" : ""}>
                      <td data-label="">
                        <input type="checkbox" checked={selected.has(e.slang_id)} onChange={() => toggleSelect(e.slang_id)} aria-label={`Select ${e.term}`} />
                      </td>
                      <td data-label={t("slang.term")}><strong>{e.term}</strong></td>
                      <td data-label={t("slang.normalized_form")}>{e.normalized_form}</td>
                      <td data-label={t("filter.category")}><span className="badge badge--default">{e.category}</span></td>
                      <td data-label={t("content.language")}>{e.language}</td>
                      <td data-label={t("slang.risk_weight")}>{e.risk_weight}</td>
                      <td data-label={t("slang.status")}>
                        <span className={`badge badge--${e.submission_status === "APPROVED" ? "success" : e.submission_status === "REJECTED" ? "error" : "warning"}`}>
                          {e.submission_status}
                        </span>
                      </td>
                      <td data-label={t("models.actions")}>
                        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                          <Button onClick={() => openEdit(e)} disabled={isOffline}>{t("slang.edit")}</Button>
                          {e.submission_status === "PENDING" && (
                            <>
                              <Button onClick={() => handleApprove(e.slang_id)} disabled={isOffline}>{t("slang.approve")}</Button>
                              <Button onClick={() => handleReject(e.slang_id)} disabled={isOffline}>{t("slang.reject")}</Button>
                            </>
                          )}
                          <Button onClick={() => setDeleteId(e.slang_id)} disabled={isOffline}>{t("slang.delete")}</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              {/* Pagination */}
              {total > LIMIT && (
                <div className="pagination" style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", justifyContent: "center", marginTop: "var(--space-3)" }}>
                  <Button onClick={() => setOffset(Math.max(0, offset - LIMIT))} disabled={offset === 0}>{t("audit.prev_page")}</Button>
                  <span>{t("slang.page_info", { from: offset + 1, to: Math.min(offset + LIMIT, total), total })}</span>
                  <Button onClick={() => setOffset(offset + LIMIT)} disabled={offset + LIMIT >= total}>{t("audit.next_page")}</Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Emoji codes tab */}
      {tab === "emoji" && (
        <div className="admin-section">
          <div className="admin-section__header">
            <h2>{t("slang.emoji_heading")}</h2>
          </div>
          {loading ? <div className="loading-center">{t("common.loading")}</div> : emojiCodes.length === 0 ? (
            <div className="empty-state"><h3>{t("slang.no_emoji")}</h3></div>
          ) : (
            <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>{t("slang.emoji")}</th>
                  <th>{t("slang.drug_category")}</th>
                  <th>{t("slang.signal_type")}</th>
                  <th>{t("slang.risk_weight")}</th>
                  <th>{t("detail.description")}</th>
                </tr>
              </thead>
              <tbody>
                {emojiCodes.map((e) => (
                  <tr key={e.emoji_id}>
                    <td data-label={t("slang.emoji")}><span style={{ fontSize: "1.5rem" }}>{e.emoji}</span></td>
                    <td data-label={t("slang.drug_category")}><span className="badge badge--default">{e.drug_category}</span></td>
                    <td data-label={t("slang.signal_type")}><span className={`badge badge--${e.signal_type === "SUBSTANCE" ? "error" : e.signal_type === "TRANSACTION" ? "warning" : "success"}`}>{e.signal_type}</span></td>
                    <td data-label={t("slang.risk_weight")}>{e.risk_weight}</td>
                    <td data-label={t("detail.description")}>{e.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {/* Edit modal */}
      <Modal
        open={!!editEntry}
        title={t("slang.edit_entry")}
        onClose={() => setEditEntry(null)}
        actions={
          <>
            <Button onClick={() => setEditEntry(null)}>{t("common.cancel")}</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>{saving ? t("common.loading") : t("common.save")}</Button>
          </>
        }
      >
        {editEntry && (
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <Field label={t("slang.term")} htmlFor="ed-term">
              <Input id="ed-term" value={editTerm} onChange={(e) => setEditTerm(e.target.value)} />
            </Field>
            <Field label={t("slang.normalized_form")} htmlFor="ed-norm">
              <Input id="ed-norm" value={editNormalized} onChange={(e) => setEditNormalized(e.target.value)} />
            </Field>
            <Field label={t("filter.category")} htmlFor="ed-cat">
              <Input id="ed-cat" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} />
            </Field>
            <Field label={t("content.language")} htmlFor="ed-lang">
              <Input id="ed-lang" value={editLanguage} onChange={(e) => setEditLanguage(e.target.value)} />
            </Field>
            <Field label={t("slang.risk_weight")} htmlFor="ed-rw">
              <Input id="ed-rw" type="number" step="0.1" min="0" max="10" value={editRiskWeight} onChange={(e) => setEditRiskWeight(e.target.value)} />
            </Field>
          </div>
        )}
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteId}
        title={t("slang.confirm_delete")}
        onClose={() => setDeleteId(null)}
        actions={
          <>
            <Button onClick={() => setDeleteId(null)}>{t("common.cancel")}</Button>
            <Button onClick={handleDelete} disabled={deleting}>{deleting ? t("common.loading") : t("slang.delete")}</Button>
          </>
        }
      >
        <p>{t("slang.delete_warning")}</p>
      </Modal>
    </>
  );
}
