import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Field, Input, Select, Modal, Pagination, useToast } from "@puda/shared";
import { apiBaseUrl, Watchlist } from "../types";

const LIMIT = 20;

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean; isAdmin?: boolean };

export default function WatchlistManager({ authHeaders, isOffline, isAdmin = false }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [activeFilter, setActiveFilter] = useState("");

  // Edit modal state
  const [editWatchlist, setEditWatchlist] = useState<Watchlist | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editKeywords, setEditKeywords] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadWatchlists = () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(LIMIT));
    params.set("offset", String((page - 1) * LIMIT));
    if (activeFilter) params.set("is_active", activeFilter);

    fetch(`${apiBaseUrl}/api/v1/watchlists?${params}`, authHeaders())
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => {
        setWatchlists(data.watchlists || data || []);
        if (typeof data.total === "number") setTotal(data.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (isOffline) { setLoading(false); return; } loadWatchlists(); }, [authHeaders, isOffline, page, activeFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOffline) return;
    setCreating(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/watchlists`, {
        ...authHeaders(), method: "POST",
        body: JSON.stringify({ name: newName, description: newDesc, keywords: newKeywords.split(",").map((k) => k.trim()).filter(Boolean), platforms: [], is_active: true }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      showToast("success", t("watchlists.created_success"));
      setShowForm(false); setNewName(""); setNewDesc(""); setNewKeywords("");
      loadWatchlists();
    } catch (err) { showToast("error", err instanceof Error ? err.message : "Failed"); }
    finally { setCreating(false); }
  };

  const openEdit = (w: Watchlist) => {
    setEditWatchlist(w);
    setEditName(w.name);
    setEditDesc(w.description || "");
    setEditKeywords(Array.isArray(w.keywords) ? w.keywords.join(", ") : "");
    setEditActive(w.is_active);
  };

  const handleSaveEdit = async () => {
    if (!editWatchlist) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/watchlists/${editWatchlist.watchlist_id}`, {
        ...authHeaders(), method: "PUT",
        body: JSON.stringify({ name: editName, description: editDesc, keywords: editKeywords.split(",").map((k) => k.trim()).filter(Boolean), is_active: editActive }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      showToast("success", t("watchlists.saved_success"));
      setEditWatchlist(null);
      loadWatchlists();
    } catch (err) { showToast("error", err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="page__header"><h1>{t("watchlists.title")}</h1></div>
      {error && <Alert variant="error">{error}</Alert>}
      <div className="admin-section">
        <div className="admin-section__header">
          <h2>{t("watchlists.title")}</h2>
          {isAdmin && <Button onClick={() => setShowForm(!showForm)} disabled={isOffline}>{showForm ? t("common.cancel") : t("watchlists.create")}</Button>}
        </div>
        {isAdmin && showForm && (
          <form onSubmit={handleCreate} className="detail-section" style={{ marginBottom: "var(--space-4)" }}>
            <div className="detail-grid">
              <Field label={t("watchlists.name")} htmlFor="wl-name" required><Input id="wl-name" value={newName} onChange={(e) => setNewName(e.target.value)} required /></Field>
              <Field label={t("detail.description")} htmlFor="wl-desc"><Input id="wl-desc" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} /></Field>
              <Field label={t("watchlists.keywords")} htmlFor="wl-keywords"><Input id="wl-keywords" value={newKeywords} onChange={(e) => setNewKeywords(e.target.value)} placeholder="Comma-separated keywords" /></Field>
            </div>
            <div style={{ marginTop: "var(--space-3)" }}><Button type="submit" disabled={creating}>{creating ? t("common.loading") : t("common.create")}</Button></div>
          </form>
        )}

        <div className="filter-bar">
          <Field label={t("filter.active")} htmlFor="filter-active">
            <Select id="filter-active" value={activeFilter} onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}>
              <option value="">{t("filter.all")}</option>
              <option value="true">{t("common.yes")}</option>
              <option value="false">{t("common.no")}</option>
            </Select>
          </Field>
        </div>

        {loading ? <div className="loading-center">{t("common.loading")}</div> : watchlists.length === 0 ? (
          <div className="empty-state"><h3>{t("watchlists.no_watchlists")}</h3></div>
        ) : (
          <>
            <table className="entity-table">
              <thead>
                <tr>
                  <th>{t("watchlists.name")}</th>
                  <th>{t("watchlists.keywords")}</th>
                  <th>{t("watchlists.platforms")}</th>
                  <th>{t("watchlists.active")}</th>
                  {isAdmin && <th>{t("models.actions")}</th>}
                </tr>
              </thead>
              <tbody>
                {watchlists.map((w) => (
                  <tr key={w.watchlist_id}>
                    <td data-label={t("watchlists.name")}>{w.name}</td>
                    <td data-label={t("watchlists.keywords")}>{Array.isArray(w.keywords) ? w.keywords.join(", ") : "—"}</td>
                    <td data-label={t("watchlists.platforms")}>{Array.isArray(w.platforms) ? w.platforms.join(", ") : t("filter.all")}</td>
                    <td data-label={t("watchlists.active")}><span className={`badge badge--${w.is_active ? "success" : "default"}`}>{w.is_active ? t("common.yes") : t("common.no")}</span></td>
                    {isAdmin && (
                      <td data-label={t("models.actions")}>
                        <Button onClick={() => openEdit(w)} disabled={isOffline}>{t("watchlists.edit")}</Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} total={total} limit={LIMIT} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Edit watchlist modal */}
      <Modal
        open={!!editWatchlist}
        title={t("watchlists.edit_title")}
        onClose={() => setEditWatchlist(null)}
        actions={<><Button onClick={() => setEditWatchlist(null)}>{t("common.cancel")}</Button><Button onClick={handleSaveEdit} disabled={saving}>{saving ? t("common.loading") : t("common.save")}</Button></>}
      >
        {editWatchlist && (
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <Field label={t("watchlists.name")} htmlFor="ew-name"><Input id="ew-name" value={editName} onChange={(e) => setEditName(e.target.value)} /></Field>
            <Field label={t("detail.description")} htmlFor="ew-desc"><Input id="ew-desc" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} /></Field>
            <Field label={t("watchlists.keywords")} htmlFor="ew-kw"><Input id="ew-kw" value={editKeywords} onChange={(e) => setEditKeywords(e.target.value)} placeholder="Comma-separated keywords" /></Field>
            <Field label={t("watchlists.active")} htmlFor="ew-active">
              <Select id="ew-active" value={editActive ? "true" : "false"} onChange={(e) => setEditActive(e.target.value === "true")}>
                <option value="true">{t("common.yes")}</option>
                <option value="false">{t("common.no")}</option>
              </Select>
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
