import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Field, Input, Modal, Select, useToast } from "@puda/shared";
import { apiBaseUrl } from "../types";

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean; isAdmin: boolean };
type Tab = "all" | "keywords" | "slang" | "emoji";
type SortCol = "term" | "normalized_form" | "category" | "language" | "risk_weight" | "submission_status" | "created_at";
type SortDir = "asc" | "desc";

type SlangEntry = {
  slang_id: string; term: string; normalized_form: string; category: string;
  language: string; risk_weight: number; submission_status: string; term_type?: string;
};

type EmojiDrugCode = {
  emoji_id: string; emoji: string; drug_category: string;
  signal_type: string; risk_weight: number; description: string;
};

export default function DetectionDictionary({ authHeaders, isOffline, isAdmin }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [tab, setTab] = useState<Tab>("all");

  // Data
  const [entries, setEntries] = useState<SlangEntry[]>([]);
  const [emojiCodes, setEmojiCodes] = useState<EmojiDrugCode[]>([]);
  const [total, setTotal] = useState(0);
  // Tab counts
  const [countAll, setCountAll] = useState(0);
  const [countKeywords, setCountKeywords] = useState(0);
  const [countSlang, setCountSlang] = useState(0);
  const [countEmoji, setCountEmoji] = useState(0);
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

  // Bulk selection (admin only)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState(false);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [formTerm, setFormTerm] = useState("");
  const [formNormalized, setFormNormalized] = useState("");
  const [formCategory, setFormCategory] = useState("DRUGS");
  const [formLanguage, setFormLanguage] = useState("en");
  const [formRiskWeight, setFormRiskWeight] = useState("1.0");
  const [formTermType, setFormTermType] = useState<string>("SLANG");
  // Emoji-specific create fields
  const [formEmoji, setFormEmoji] = useState("");
  const [formDrugCategory, setFormDrugCategory] = useState("");
  const [formSignalType, setFormSignalType] = useState("SUBSTANCE");
  const [formDescription, setFormDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit modal
  const [editEntry, setEditEntry] = useState<SlangEntry | null>(null);
  const [editTerm, setEditTerm] = useState("");
  const [editNormalized, setEditNormalized] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editLanguage, setEditLanguage] = useState("");
  const [editRiskWeight, setEditRiskWeight] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit emoji modal
  const [editEmoji, setEditEmoji] = useState<EmojiDrugCode | null>(null);
  const [editEmojiChar, setEditEmojiChar] = useState("");
  const [editEmojiDrugCat, setEditEmojiDrugCat] = useState("");
  const [editEmojiSignal, setEditEmojiSignal] = useState("");
  const [editEmojiWeight, setEditEmojiWeight] = useState("");
  const [editEmojiDesc, setEditEmojiDesc] = useState("");
  const [savingEmoji, setSavingEmoji] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<"slang" | "emoji">("slang");
  const [deleting, setDeleting] = useState(false);

  // Debounce search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => { setDebouncedSearch(searchText); setOffset(0); }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchText]);

  // Load facets + tab counts
  const loadTabCounts = useCallback(() => {
    if (isOffline) return;
    const fetchCount = (termType?: string) => {
      const p = new URLSearchParams(); p.set("limit", "1"); p.set("offset", "0");
      if (termType) p.set("termType", termType);
      return fetch(`${apiBaseUrl}/api/v1/slang?${p}`, authHeaders())
        .then((r) => r.ok ? r.json() : { total: 0 })
        .then((d) => d.total || 0)
        .catch(() => 0);
    };
    Promise.all([
      fetchCount(),
      fetchCount("KEYWORD"),
      fetchCount("SLANG"),
      fetch(`${apiBaseUrl}/api/v1/emoji-codes`, authHeaders())
        .then((r) => r.ok ? r.json() : { entries: [] })
        .then((d) => (d.entries || []).length)
        .catch(() => 0),
    ]).then(([all, kw, sl, em]) => { setCountAll(all); setCountKeywords(kw); setCountSlang(sl); setCountEmoji(em); });
  }, [authHeaders, isOffline]);

  useEffect(() => {
    if (isOffline) return;
    fetch(`${apiBaseUrl}/api/v1/slang/facets`, authHeaders())
      .then((r) => r.ok ? r.json() : { categories: [], languages: [] })
      .then((data) => { setFacetCategories(data.categories || []); setFacetLanguages(data.languages || []); })
      .catch(() => {});
    loadTabCounts();
  }, [authHeaders, isOffline, loadTabCounts]);

  // Load slang/keyword entries
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
    if (tab === "keywords") params.set("termType", "KEYWORD");
    else if (tab === "slang") params.set("termType", "SLANG");

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

  // Sort
  const handleSort = (col: SortCol) => {
    if (sortBy === col) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortOrder("asc"); }
    setOffset(0);
  };
  const sortIcon = (col: SortCol) => { if (sortBy !== col) return " \u21D5"; return sortOrder === "asc" ? " \u2191" : " \u2193"; };

  // Bulk select (admin only)
  const toggleSelect = (id: string) => {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const toggleSelectAll = () => {
    if (selected.size === entries.length) setSelected(new Set());
    else setSelected(new Set(entries.map((e) => e.slang_id)));
  };

  // Batch action
  const handleBatchAction = async (action: "approve" | "reject" | "delete") => {
    if (selected.size === 0) return;
    setBatchAction(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/slang/batch`, { ...authHeaders(), method: "POST", body: JSON.stringify({ ids: Array.from(selected), action }) });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      showToast("success", t("slang.batch_success", { count: data.affected }));
      setSelected(new Set());
      loadEntries(); loadTabCounts();
    } catch (err) { showToast("error", err instanceof Error ? err.message : "Failed"); }
    finally { setBatchAction(false); }
  };

  // Create
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOffline) return;
    setCreating(true);
    try {
      if (formTermType === "EMOJI") {
        const res = await fetch(`${apiBaseUrl}/api/v1/emoji-codes`, {
          ...authHeaders(), method: "POST",
          body: JSON.stringify({ emoji: formEmoji, drugCategory: formDrugCategory, riskWeight: parseFloat(formRiskWeight) || 1.0, signalType: formSignalType, description: formDescription }),
        });
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        showToast("success", t("slang.created_success"));
        setShowCreate(false);
        setFormEmoji(""); setFormDrugCategory(""); setFormSignalType("SUBSTANCE"); setFormDescription(""); setFormRiskWeight("1.0");
        loadEmojiCodes(); loadTabCounts();
      } else {
        const res = await fetch(`${apiBaseUrl}/api/v1/slang`, {
          ...authHeaders(), method: "POST",
          body: JSON.stringify({ term: formTerm, normalizedForm: formNormalized, category: formCategory, language: formLanguage, riskWeight: parseFloat(formRiskWeight) || 1.0, termType: formTermType }),
        });
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        showToast("success", t("slang.created_success"));
        setShowCreate(false);
        setFormTerm(""); setFormNormalized(""); setFormCategory("DRUGS"); setFormLanguage("en"); setFormRiskWeight("1.0");
        loadEntries(); loadTabCounts();
      }
    } catch (err) { showToast("error", err instanceof Error ? err.message : "Failed"); }
    finally { setCreating(false); }
  };

  // Edit slang entry
  const openEdit = (entry: SlangEntry) => {
    setEditEntry(entry);
    setEditTerm(entry.term); setEditNormalized(entry.normalized_form);
    setEditCategory(entry.category); setEditLanguage(entry.language); setEditRiskWeight(String(entry.risk_weight));
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

  // Edit emoji entry
  const openEmojiEdit = (entry: EmojiDrugCode) => {
    setEditEmoji(entry);
    setEditEmojiChar(entry.emoji); setEditEmojiDrugCat(entry.drug_category);
    setEditEmojiSignal(entry.signal_type); setEditEmojiWeight(String(entry.risk_weight)); setEditEmojiDesc(entry.description);
  };
  const handleSaveEmojiEdit = async () => {
    if (!editEmoji) return;
    setSavingEmoji(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/emoji-codes/${editEmoji.emoji_id}`, {
        ...authHeaders(), method: "PATCH",
        body: JSON.stringify({ emoji: editEmojiChar, drugCategory: editEmojiDrugCat, riskWeight: parseFloat(editEmojiWeight) || 1.0, signalType: editEmojiSignal, description: editEmojiDesc }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      showToast("success", t("slang.saved_success"));
      setEditEmoji(null);
      loadEmojiCodes();
    } catch (err) { showToast("error", err instanceof Error ? err.message : "Failed"); }
    finally { setSavingEmoji(false); }
  };

  // Approve / Reject
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

  // Delete
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const url = deleteType === "emoji" ? `${apiBaseUrl}/api/v1/emoji-codes/${deleteId}` : `${apiBaseUrl}/api/v1/slang/${deleteId}`;
      const res = await fetch(url, { ...authHeaders(), method: "DELETE" });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      showToast("success", t("slang.deleted_success"));
      setDeleteId(null);
      if (deleteType === "emoji") loadEmojiCodes(); else loadEntries();
      loadTabCounts();
    } catch (err) { showToast("error", err instanceof Error ? err.message : "Failed"); }
    finally { setDeleting(false); }
  };

  const tabClass = (v: Tab) => `tab-btn ${tab === v ? "tab-btn--active" : ""}`;
  const hasPendingSelected = Array.from(selected).some((id) => entries.find((e) => e.slang_id === id)?.submission_status === "PENDING");

  return (
    <>
      <div className="page__header"><h1>{t("detection.title")}</h1></div>

      <div className="tab-bar" role="tablist">
        <button className={tabClass("all")} onClick={() => { setTab("all"); setOffset(0); setSelected(new Set()); }} role="tab" aria-selected={tab === "all"} type="button">
          {t("detection.tab_all")}{countAll > 0 && <span className="tab-btn__count">{countAll}</span>}
        </button>
        <button className={tabClass("keywords")} onClick={() => { setTab("keywords"); setOffset(0); setSelected(new Set()); }} role="tab" aria-selected={tab === "keywords"} type="button">
          {t("detection.tab_keywords")}{countKeywords > 0 && <span className="tab-btn__count">{countKeywords}</span>}
        </button>
        <button className={tabClass("slang")} onClick={() => { setTab("slang"); setOffset(0); setSelected(new Set()); }} role="tab" aria-selected={tab === "slang"} type="button">
          {t("detection.tab_slang")}{countSlang > 0 && <span className="tab-btn__count">{countSlang}</span>}
        </button>
        <button className={tabClass("emoji")} onClick={() => { setTab("emoji"); setOffset(0); setSelected(new Set()); }} role="tab" aria-selected={tab === "emoji"} type="button">
          {t("detection.tab_emoji")}{countEmoji > 0 && <span className="tab-btn__count">{countEmoji}</span>}
        </button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Slang / Keywords / All tabs */}
      {tab !== "emoji" && (
        <div className="admin-section">
          <div className="admin-section__header">
            <h2>{t("detection.title")}</h2>
            {isAdmin && (
              <Button onClick={() => setShowCreate(!showCreate)} disabled={isOffline}>
                {showCreate ? t("common.cancel") : t("detection.add_entry")}
              </Button>
            )}
          </div>

          {/* Filters */}
          <div className="filter-bar">
            <Field label={t("slang.search")} htmlFor="dd-search">
              <Input id="dd-search" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder={t("slang.search_placeholder")} />
            </Field>
            <Field label={t("filter.category")} htmlFor="dd-cat">
              <Select id="dd-cat" value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setOffset(0); }}>
                <option value="">{t("filter.all")}</option>
                {facetCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label={t("content.language")} htmlFor="dd-lang">
              <Select id="dd-lang" value={filterLanguage} onChange={(e) => { setFilterLanguage(e.target.value); setOffset(0); }}>
                <option value="">{t("filter.all")}</option>
                {facetLanguages.map((l) => <option key={l} value={l}>{l}</option>)}
              </Select>
            </Field>
          </div>

          {/* Bulk action bar (admin only) */}
          {isAdmin && selected.size > 0 && (
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

          {/* Create form (admin only) */}
          {isAdmin && showCreate && (
            <form onSubmit={handleCreate} className="detail-section" style={{ marginBottom: "var(--space-4)" }}>
              <div className="detail-grid">
                <Field label={t("detection.entry_type")} htmlFor="dd-type">
                  <Select id="dd-type" value={formTermType} onChange={(e) => setFormTermType(e.target.value)}>
                    <option value="SLANG">{t("detection.type_slang")}</option>
                    <option value="KEYWORD">{t("detection.type_keyword")}</option>
                    <option value="EMOJI">{t("detection.type_emoji")}</option>
                  </Select>
                </Field>
                {formTermType !== "EMOJI" ? (
                  <>
                    <Field label={t("slang.term")} htmlFor="dd-term" required>
                      <Input id="dd-term" value={formTerm} onChange={(e) => setFormTerm(e.target.value)} required />
                    </Field>
                    <Field label={t("slang.normalized_form")} htmlFor="dd-norm" required>
                      <Input id="dd-norm" value={formNormalized} onChange={(e) => setFormNormalized(e.target.value)} required />
                    </Field>
                    <Field label={t("filter.category")} htmlFor="dd-fcat" required>
                      <Input id="dd-fcat" value={formCategory} onChange={(e) => setFormCategory(e.target.value)} required />
                    </Field>
                    <Field label={t("content.language")} htmlFor="dd-flang">
                      <Input id="dd-flang" value={formLanguage} onChange={(e) => setFormLanguage(e.target.value)} />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label={t("detection.emoji_char")} htmlFor="dd-emoji" required>
                      <Input id="dd-emoji" value={formEmoji} onChange={(e) => setFormEmoji(e.target.value)} required />
                    </Field>
                    <Field label={t("slang.drug_category")} htmlFor="dd-dcat" required>
                      <Input id="dd-dcat" value={formDrugCategory} onChange={(e) => setFormDrugCategory(e.target.value)} required />
                    </Field>
                    <Field label={t("slang.signal_type")} htmlFor="dd-sig">
                      <Select id="dd-sig" value={formSignalType} onChange={(e) => setFormSignalType(e.target.value)}>
                        <option value="SUBSTANCE">SUBSTANCE</option>
                        <option value="TRANSACTION">TRANSACTION</option>
                        <option value="QUALITY">QUALITY</option>
                      </Select>
                    </Field>
                    <Field label={t("detail.description")} htmlFor="dd-desc">
                      <Input id="dd-desc" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
                    </Field>
                  </>
                )}
                <Field label={t("slang.risk_weight")} htmlFor="dd-rw">
                  <Input id="dd-rw" type="number" step="0.1" min="0" max="10" value={formRiskWeight} onChange={(e) => setFormRiskWeight(e.target.value)} />
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
              <table className="entity-table entity-table--compact">
                <thead>
                  <tr>
                    {isAdmin && (
                      <th style={{ width: "2.5rem" }}>
                        <input type="checkbox" checked={selected.size === entries.length && entries.length > 0} onChange={toggleSelectAll} aria-label={t("slang.select_all")} />
                      </th>
                    )}
                    <th className="sortable-th" onClick={() => handleSort("term")} style={{ cursor: "pointer" }}>{t("slang.term")}{sortIcon("term")}</th>
                    <th className="sortable-th" onClick={() => handleSort("normalized_form")} style={{ cursor: "pointer" }}>{t("slang.normalized_form")}{sortIcon("normalized_form")}</th>
                    {tab === "all" && <th>{t("detection.entry_type")}</th>}
                    <th className="sortable-th" onClick={() => handleSort("category")} style={{ cursor: "pointer" }}>{t("filter.category")}{sortIcon("category")}</th>
                    <th className="sortable-th" onClick={() => handleSort("language")} style={{ cursor: "pointer" }}>{t("content.language")}{sortIcon("language")}</th>
                    <th className="sortable-th" onClick={() => handleSort("risk_weight")} style={{ cursor: "pointer" }}>{t("slang.risk_weight")}{sortIcon("risk_weight")}</th>
                    <th className="sortable-th" onClick={() => handleSort("submission_status")} style={{ cursor: "pointer" }}>{t("slang.status")}{sortIcon("submission_status")}</th>
                    {isAdmin && <th>{t("models.actions")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.slang_id} className={selected.has(e.slang_id) ? "row--selected" : ""}>
                      {isAdmin && (
                        <td data-label="">
                          <input type="checkbox" checked={selected.has(e.slang_id)} onChange={() => toggleSelect(e.slang_id)} aria-label={`Select ${e.term}`} />
                        </td>
                      )}
                      <td data-label={t("slang.term")}><strong>{e.term}</strong></td>
                      <td data-label={t("slang.normalized_form")}>{e.normalized_form}</td>
                      {tab === "all" && <td data-label={t("detection.entry_type")}><span className="badge badge--default">{e.term_type || "SLANG"}</span></td>}
                      <td data-label={t("filter.category")}><span className="badge badge--default">{e.category}</span></td>
                      <td data-label={t("content.language")}>{e.language}</td>
                      <td data-label={t("slang.risk_weight")}>{e.risk_weight}</td>
                      <td data-label={t("slang.status")}>
                        <span className={`badge badge--${e.submission_status === "APPROVED" ? "success" : e.submission_status === "REJECTED" ? "critical" : "warning"}`}>
                          {e.submission_status}
                        </span>
                      </td>
                      {isAdmin && (
                        <td data-label={t("models.actions")}>
                          <div className="action-btns">
                            <button className="icon-btn" onClick={() => openEdit(e)} disabled={isOffline} title={t("slang.edit")} aria-label={t("slang.edit")}>&#9998;</button>
                            {e.submission_status === "PENDING" && (
                              <>
                                <button className="icon-btn icon-btn--success" onClick={() => handleApprove(e.slang_id)} disabled={isOffline} title={t("slang.approve")} aria-label={t("slang.approve")}>&#10003;</button>
                                <button className="icon-btn icon-btn--danger" onClick={() => handleReject(e.slang_id)} disabled={isOffline} title={t("slang.reject")} aria-label={t("slang.reject")}>&#10007;</button>
                              </>
                            )}
                            <button className="icon-btn icon-btn--danger" onClick={() => { setDeleteId(e.slang_id); setDeleteType("slang"); }} disabled={isOffline} title={t("slang.delete")} aria-label={t("slang.delete")}>&#128465;</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

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
            {isAdmin && (
              <Button onClick={() => { setFormTermType("EMOJI"); setShowCreate(!showCreate); }} disabled={isOffline}>
                {showCreate ? t("common.cancel") : t("detection.add_entry")}
              </Button>
            )}
          </div>

          {isAdmin && showCreate && (
            <form onSubmit={handleCreate} className="detail-section" style={{ marginBottom: "var(--space-4)" }}>
              <div className="detail-grid">
                <Field label={t("detection.emoji_char")} htmlFor="dd-emoji2" required>
                  <Input id="dd-emoji2" value={formEmoji} onChange={(e) => setFormEmoji(e.target.value)} required />
                </Field>
                <Field label={t("slang.drug_category")} htmlFor="dd-dcat2" required>
                  <Input id="dd-dcat2" value={formDrugCategory} onChange={(e) => setFormDrugCategory(e.target.value)} required />
                </Field>
                <Field label={t("slang.signal_type")} htmlFor="dd-sig2">
                  <Select id="dd-sig2" value={formSignalType} onChange={(e) => setFormSignalType(e.target.value)}>
                    <option value="SUBSTANCE">SUBSTANCE</option>
                    <option value="TRANSACTION">TRANSACTION</option>
                    <option value="QUALITY">QUALITY</option>
                  </Select>
                </Field>
                <Field label={t("slang.risk_weight")} htmlFor="dd-rw2">
                  <Input id="dd-rw2" type="number" step="0.1" min="0" max="10" value={formRiskWeight} onChange={(e) => setFormRiskWeight(e.target.value)} />
                </Field>
                <Field label={t("detail.description")} htmlFor="dd-desc2">
                  <Input id="dd-desc2" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
                </Field>
              </div>
              <div style={{ marginTop: "var(--space-3)" }}>
                <Button type="submit" disabled={creating}>{creating ? t("common.loading") : t("common.create")}</Button>
              </div>
            </form>
          )}

          {loading ? <div className="loading-center">{t("common.loading")}</div> : emojiCodes.length === 0 ? (
            <div className="empty-state"><h3>{t("slang.no_emoji")}</h3></div>
          ) : (
            <div className="table-scroll">
            <table className="entity-table entity-table--compact">
              <thead>
                <tr>
                  <th>{t("slang.emoji")}</th>
                  <th>{t("slang.drug_category")}</th>
                  <th>{t("slang.signal_type")}</th>
                  <th>{t("slang.risk_weight")}</th>
                  <th>{t("detail.description")}</th>
                  {isAdmin && <th>{t("models.actions")}</th>}
                </tr>
              </thead>
              <tbody>
                {emojiCodes.map((e) => (
                  <tr key={e.emoji_id}>
                    <td data-label={t("slang.emoji")}><span style={{ fontSize: "1.5rem" }}>{e.emoji}</span></td>
                    <td data-label={t("slang.drug_category")}><span className="badge badge--default">{e.drug_category}</span></td>
                    <td data-label={t("slang.signal_type")}><span className={`badge badge--${e.signal_type === "SUBSTANCE" ? "critical" : e.signal_type === "TRANSACTION" ? "warning" : "success"}`}>{e.signal_type}</span></td>
                    <td data-label={t("slang.risk_weight")}>{e.risk_weight}</td>
                    <td data-label={t("detail.description")}>{e.description}</td>
                    {isAdmin && (
                      <td data-label={t("models.actions")}>
                        <div className="action-btns">
                          <button className="icon-btn" onClick={() => openEmojiEdit(e)} disabled={isOffline} title={t("slang.edit")} aria-label={t("slang.edit")}>&#9998;</button>
                          <button className="icon-btn icon-btn--danger" onClick={() => { setDeleteId(e.emoji_id); setDeleteType("emoji"); }} disabled={isOffline} title={t("slang.delete")} aria-label={t("slang.delete")}>&#128465;</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {/* Edit slang entry modal */}
      <Modal
        open={!!editEntry}
        title={t("detection.edit_entry")}
        onClose={() => setEditEntry(null)}
        actions={<><Button onClick={() => setEditEntry(null)}>{t("common.cancel")}</Button><Button onClick={handleSaveEdit} disabled={saving}>{saving ? t("common.loading") : t("common.save")}</Button></>}
      >
        {editEntry && (
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <Field label={t("slang.term")} htmlFor="ed-term"><Input id="ed-term" value={editTerm} onChange={(e) => setEditTerm(e.target.value)} /></Field>
            <Field label={t("slang.normalized_form")} htmlFor="ed-norm"><Input id="ed-norm" value={editNormalized} onChange={(e) => setEditNormalized(e.target.value)} /></Field>
            <Field label={t("filter.category")} htmlFor="ed-cat"><Input id="ed-cat" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} /></Field>
            <Field label={t("content.language")} htmlFor="ed-lang"><Input id="ed-lang" value={editLanguage} onChange={(e) => setEditLanguage(e.target.value)} /></Field>
            <Field label={t("slang.risk_weight")} htmlFor="ed-rw"><Input id="ed-rw" type="number" step="0.1" min="0" max="10" value={editRiskWeight} onChange={(e) => setEditRiskWeight(e.target.value)} /></Field>
          </div>
        )}
      </Modal>

      {/* Edit emoji modal */}
      <Modal
        open={!!editEmoji}
        title={t("detection.edit_entry")}
        onClose={() => setEditEmoji(null)}
        actions={<><Button onClick={() => setEditEmoji(null)}>{t("common.cancel")}</Button><Button onClick={handleSaveEmojiEdit} disabled={savingEmoji}>{savingEmoji ? t("common.loading") : t("common.save")}</Button></>}
      >
        {editEmoji && (
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <Field label={t("detection.emoji_char")} htmlFor="ede-emoji"><Input id="ede-emoji" value={editEmojiChar} onChange={(e) => setEditEmojiChar(e.target.value)} /></Field>
            <Field label={t("slang.drug_category")} htmlFor="ede-dcat"><Input id="ede-dcat" value={editEmojiDrugCat} onChange={(e) => setEditEmojiDrugCat(e.target.value)} /></Field>
            <Field label={t("slang.signal_type")} htmlFor="ede-sig">
              <Select id="ede-sig" value={editEmojiSignal} onChange={(e) => setEditEmojiSignal(e.target.value)}>
                <option value="SUBSTANCE">SUBSTANCE</option>
                <option value="TRANSACTION">TRANSACTION</option>
                <option value="QUALITY">QUALITY</option>
              </Select>
            </Field>
            <Field label={t("slang.risk_weight")} htmlFor="ede-rw"><Input id="ede-rw" type="number" step="0.1" min="0" max="10" value={editEmojiWeight} onChange={(e) => setEditEmojiWeight(e.target.value)} /></Field>
            <Field label={t("detail.description")} htmlFor="ede-desc"><Input id="ede-desc" value={editEmojiDesc} onChange={(e) => setEditEmojiDesc(e.target.value)} /></Field>
          </div>
        )}
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteId}
        title={t("slang.confirm_delete")}
        onClose={() => setDeleteId(null)}
        actions={<><Button onClick={() => setDeleteId(null)}>{t("common.cancel")}</Button><Button onClick={handleDelete} disabled={deleting}>{deleting ? t("common.loading") : t("slang.delete")}</Button></>}
      >
        <p>{t("slang.delete_warning")}</p>
      </Modal>
    </>
  );
}
