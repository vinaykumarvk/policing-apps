import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Field, Input, Modal, useToast } from "@puda/shared";
import { apiBaseUrl, MonitoringProfile, JurisdictionLocation } from "../types";

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean; isAdmin: boolean };
type Tab = "profiles" | "locations";

const PLATFORMS = ["facebook", "instagram", "twitter", "x", "telegram", "whatsapp", "youtube"] as const;
const ENTRY_TYPES = ["PROFILE", "GROUP", "PAGE"] as const;
const PRIORITIES = ["HIGH", "NORMAL", "LOW"] as const;
const SOURCES = ["MANUAL", "NIDAAN", "TEF", "PRIVATE", "BULK_CSV", "UNODC", "EUROPOL", "INTERPOL", "NCB", "DEA", "FATF"] as const;
const LIMIT = 20;

const sourceBadgeClass = (source: string) => {
  switch (source) {
    case "NIDAAN": return "badge--error";
    case "UNODC": case "EUROPOL": case "INTERPOL": case "DEA": case "FATF": return "badge--error";
    case "TEF": case "NCB": return "badge--warning";
    case "PRIVATE": return "badge--info";
    case "BULK_CSV": return "badge--success";
    default: return "badge--default";
  }
};

export default function MonitoringConfig({ authHeaders, isOffline, isAdmin }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [tab, setTab] = useState<Tab>("profiles");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Profiles state ───────────────────────────────────────────────
  const [profiles, setProfiles] = useState<MonitoringProfile[]>([]);
  const [profileTotal, setProfileTotal] = useState(0);
  const [profileOffset, setProfileOffset] = useState(0);
  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterEntryType, setFilterEntryType] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Profile create form
  const [showCreateProfile, setShowCreateProfile] = useState(false);
  const [fpPlatform, setFpPlatform] = useState<string>("facebook");
  const [fpEntryType, setFpEntryType] = useState<string>("PROFILE");
  const [fpHandle, setFpHandle] = useState("");
  const [fpUrl, setFpUrl] = useState("");
  const [fpPriority, setFpPriority] = useState<string>("NORMAL");
  const [fpSource, setFpSource] = useState<string>("MANUAL");
  const [fpSourceRef, setFpSourceRef] = useState("");
  const [fpSuspectName, setFpSuspectName] = useState("");
  const [fpNotes, setFpNotes] = useState("");
  const [creating, setCreating] = useState(false);

  // Profile edit modal
  const [editProfile, setEditProfile] = useState<MonitoringProfile | null>(null);
  const [epPlatform, setEpPlatform] = useState("");
  const [epEntryType, setEpEntryType] = useState("");
  const [epHandle, setEpHandle] = useState("");
  const [epUrl, setEpUrl] = useState("");
  const [epPriority, setEpPriority] = useState("");
  const [epSource, setEpSource] = useState("");
  const [epSourceRef, setEpSourceRef] = useState("");
  const [epSuspectName, setEpSuspectName] = useState("");
  const [epNotes, setEpNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // CSV import
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<"profile" | "location">("profile");
  const [deleting, setDeleting] = useState(false);

  // ─── Locations state ──────────────────────────────────────────────
  const [locations, setLocations] = useState<JurisdictionLocation[]>([]);
  const [locationTotal, setLocationTotal] = useState(0);
  const [locationOffset, setLocationOffset] = useState(0);
  const [locSearchText, setLocSearchText] = useState("");
  const [debouncedLocSearch, setDebouncedLocSearch] = useState("");
  const locSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Location create form
  const [showCreateLocation, setShowCreateLocation] = useState(false);
  const [flDistrict, setFlDistrict] = useState("");
  const [flCities, setFlCities] = useState("");
  const [flAreas, setFlAreas] = useState("");
  const [flAltSpellings, setFlAltSpellings] = useState("");
  const [flNotes, setFlNotes] = useState("");
  const [creatingLoc, setCreatingLoc] = useState(false);

  // Location edit modal
  const [editLocation, setEditLocation] = useState<JurisdictionLocation | null>(null);
  const [elDistrict, setElDistrict] = useState("");
  const [elCities, setElCities] = useState("");
  const [elAreas, setElAreas] = useState("");
  const [elAltSpellings, setElAltSpellings] = useState("");
  const [elNotes, setElNotes] = useState("");
  const [savingLoc, setSavingLoc] = useState(false);

  // Debounce profile search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => { setDebouncedSearch(searchText); setProfileOffset(0); }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchText]);

  // Debounce location search
  useEffect(() => {
    if (locSearchTimerRef.current) clearTimeout(locSearchTimerRef.current);
    locSearchTimerRef.current = setTimeout(() => { setDebouncedLocSearch(locSearchText); setLocationOffset(0); }, 300);
    return () => { if (locSearchTimerRef.current) clearTimeout(locSearchTimerRef.current); };
  }, [locSearchText]);

  // ─── Load profiles ────────────────────────────────────────────────
  const loadProfiles = useCallback(() => {
    if (isOffline) { setLoading(false); return; }
    setLoading(true); setError(null);
    const params = new URLSearchParams();
    params.set("limit", String(LIMIT));
    params.set("offset", String(profileOffset));
    if (filterPlatform) params.set("platform", filterPlatform);
    if (filterEntryType) params.set("entryType", filterEntryType);
    if (filterSource) params.set("source", filterSource);
    if (debouncedSearch) params.set("search", debouncedSearch);

    fetch(`${apiBaseUrl}/api/v1/monitoring/profiles?${params}`, authHeaders())
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => { setProfiles(data.profiles || []); setProfileTotal(data.total || 0); })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  }, [authHeaders, isOffline, profileOffset, filterPlatform, filterEntryType, filterSource, debouncedSearch]);

  // ─── Load locations ───────────────────────────────────────────────
  const loadLocations = useCallback(() => {
    if (isOffline) { setLoading(false); return; }
    setLoading(true); setError(null);
    const params = new URLSearchParams();
    params.set("limit", String(LIMIT));
    params.set("offset", String(locationOffset));
    if (debouncedLocSearch) params.set("search", debouncedLocSearch);

    fetch(`${apiBaseUrl}/api/v1/monitoring/locations?${params}`, authHeaders())
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => { setLocations(data.locations || []); setLocationTotal(data.total || 0); })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  }, [authHeaders, isOffline, locationOffset, debouncedLocSearch]);

  useEffect(() => {
    if (tab === "profiles") loadProfiles(); else loadLocations();
  }, [tab, loadProfiles, loadLocations]);

  // ─── Profile CRUD ─────────────────────────────────────────────────
  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fpHandle && !fpUrl) { showToast("error", t("monitoring.handle_or_url_required")); return; }
    setCreating(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/monitoring/profiles`, {
        ...authHeaders(), method: "POST",
        body: JSON.stringify({
          platform: fpPlatform, entryType: fpEntryType, handle: fpHandle || undefined, url: fpUrl || undefined,
          priority: fpPriority, source: fpSource, sourceRef: fpSourceRef || undefined,
          suspectName: fpSuspectName || undefined, notes: fpNotes || undefined,
        }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      showToast("success", t("monitoring.profile_created"));
      setShowCreateProfile(false);
      setFpHandle(""); setFpUrl(""); setFpPriority("NORMAL"); setFpSource("MANUAL");
      setFpSourceRef(""); setFpSuspectName(""); setFpNotes("");
      loadProfiles();
    } catch (err) { showToast("error", err instanceof Error ? err.message : "Failed"); }
    finally { setCreating(false); }
  };

  const openEditProfile = (p: MonitoringProfile) => {
    setEditProfile(p);
    setEpPlatform(p.platform); setEpEntryType(p.entry_type);
    setEpHandle(p.handle || ""); setEpUrl(p.url || ""); setEpPriority(p.priority);
    setEpSource(p.source || "MANUAL"); setEpSourceRef(p.source_ref || "");
    setEpSuspectName(p.suspect_name || ""); setEpNotes(p.notes || "");
  };

  const handleSaveProfile = async () => {
    if (!editProfile) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/monitoring/profiles/${editProfile.profile_id}`, {
        ...authHeaders(), method: "PATCH",
        body: JSON.stringify({
          platform: epPlatform, entryType: epEntryType, handle: epHandle || undefined, url: epUrl || undefined,
          priority: epPriority, source: epSource, sourceRef: epSourceRef || undefined,
          suspectName: epSuspectName || undefined, notes: epNotes || undefined,
        }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      showToast("success", t("monitoring.profile_saved"));
      setEditProfile(null); loadProfiles();
    } catch (err) { showToast("error", err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  };

  // ─── CSV Import ─────────────────────────────────────────────────
  const handleCsvImport = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const stored = JSON.parse(localStorage.getItem("sm_auth") || "{}");
      const res = await fetch(`${apiBaseUrl}/api/v1/monitoring/profiles/import`, {
        method: "POST",
        headers: { "Content-Type": "text/csv", ...(stored.token ? { Authorization: `Bearer ${stored.token}` } : {}) },
        body: text,
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json() as { imported: number; skipped: number; errors: string[] };
      showToast("success", t("monitoring.import_success", { imported: data.imported, skipped: data.skipped }));
      loadProfiles();
    } catch (err) {
      showToast("error", t("monitoring.import_failed"));
    } finally {
      setImporting(false);
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  };

  // ─── Location CRUD ────────────────────────────────────────────────
  const csvToArray = (s: string) => s.split(",").map((v) => v.trim()).filter(Boolean);

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingLoc(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/monitoring/locations`, {
        ...authHeaders(), method: "POST",
        body: JSON.stringify({
          districtName: flDistrict,
          cityNames: csvToArray(flCities),
          areaNames: csvToArray(flAreas),
          altSpellings: csvToArray(flAltSpellings),
          notes: flNotes || undefined,
        }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      showToast("success", t("monitoring.location_created"));
      setShowCreateLocation(false);
      setFlDistrict(""); setFlCities(""); setFlAreas(""); setFlAltSpellings(""); setFlNotes("");
      loadLocations();
    } catch (err) { showToast("error", err instanceof Error ? err.message : "Failed"); }
    finally { setCreatingLoc(false); }
  };

  const openEditLocation = (loc: JurisdictionLocation) => {
    setEditLocation(loc);
    setElDistrict(loc.district_name);
    setElCities(Array.isArray(loc.city_names) ? loc.city_names.join(", ") : "");
    setElAreas(Array.isArray(loc.area_names) ? loc.area_names.join(", ") : "");
    setElAltSpellings(Array.isArray(loc.alt_spellings) ? loc.alt_spellings.join(", ") : "");
    setElNotes(loc.notes || "");
  };

  const handleSaveLocation = async () => {
    if (!editLocation) return;
    setSavingLoc(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/monitoring/locations/${editLocation.location_id}`, {
        ...authHeaders(), method: "PATCH",
        body: JSON.stringify({
          districtName: elDistrict,
          cityNames: csvToArray(elCities),
          areaNames: csvToArray(elAreas),
          altSpellings: csvToArray(elAltSpellings),
          notes: elNotes || undefined,
        }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      showToast("success", t("monitoring.location_saved"));
      setEditLocation(null); loadLocations();
    } catch (err) { showToast("error", err instanceof Error ? err.message : "Failed"); }
    finally { setSavingLoc(false); }
  };

  // ─── Delete ───────────────────────────────────────────────────────
  const confirmDelete = (id: string, type: "profile" | "location") => {
    setDeleteId(id); setDeleteType(type);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const endpoint = deleteType === "profile"
      ? `${apiBaseUrl}/api/v1/monitoring/profiles/${deleteId}`
      : `${apiBaseUrl}/api/v1/monitoring/locations/${deleteId}`;
    try {
      const res = await fetch(endpoint, { ...authHeaders(), method: "DELETE" });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      showToast("success", t(deleteType === "profile" ? "monitoring.profile_deleted" : "monitoring.location_deleted"));
      setDeleteId(null);
      if (deleteType === "profile") loadProfiles(); else loadLocations();
    } catch (err) { showToast("error", err instanceof Error ? err.message : "Failed"); }
    finally { setDeleting(false); }
  };

  const tabClass = (v: Tab) => `tab-btn ${tab === v ? "tab-btn--active" : ""}`;

  return (
    <>
      <div className="page__header"><h1>{t("monitoring.title")}</h1></div>

      <div className="tab-bar" role="tablist">
        <button className={tabClass("profiles")} onClick={() => { setTab("profiles"); setProfileOffset(0); }} role="tab" aria-selected={tab === "profiles"} type="button">{t("monitoring.tab_profiles")}</button>
        <button className={tabClass("locations")} onClick={() => { setTab("locations"); setLocationOffset(0); }} role="tab" aria-selected={tab === "locations"} type="button">{t("monitoring.tab_locations")}</button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* ═══ PROFILES TAB ═══ */}
      {tab === "profiles" && (
        <div className="admin-section">
          <div className="admin-section__header">
            <h2>{t("monitoring.profiles_heading")}</h2>
            {isAdmin && (
              <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv"
                  style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvImport(f); }}
                />
                <Button onClick={() => csvInputRef.current?.click()} disabled={isOffline || importing}>
                  {importing ? t("common.loading") : t("monitoring.import_csv")}
                </Button>
                <Button onClick={() => setShowCreateProfile(!showCreateProfile)} disabled={isOffline}>
                  {showCreateProfile ? t("common.cancel") : t("monitoring.add_profile")}
                </Button>
              </div>
            )}
          </div>

          {/* Filter bar */}
          <div className="filter-bar" style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "var(--space-3)" }}>
            <Field label={t("slang.search")} htmlFor="mp-search">
              <Input id="mp-search" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder={t("slang.search_placeholder")} />
            </Field>
            <Field label={t("monitoring.platform")} htmlFor="mp-platform">
              <select id="mp-platform" className="input" value={filterPlatform} onChange={(e) => { setFilterPlatform(e.target.value); setProfileOffset(0); }}>
                <option value="">{t("filter.all")}</option>
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label={t("monitoring.entry_type")} htmlFor="mp-type">
              <select id="mp-type" className="input" value={filterEntryType} onChange={(e) => { setFilterEntryType(e.target.value); setProfileOffset(0); }}>
                <option value="">{t("filter.all")}</option>
                {ENTRY_TYPES.map((et) => <option key={et} value={et}>{et}</option>)}
              </select>
            </Field>
            <Field label={t("monitoring.source")} htmlFor="mp-source">
              <select id="mp-source" className="input" value={filterSource} onChange={(e) => { setFilterSource(e.target.value); setProfileOffset(0); }}>
                <option value="">{t("filter.all")}</option>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          {/* Create form */}
          {showCreateProfile && (
            <form onSubmit={handleCreateProfile} className="detail-section" style={{ marginBottom: "var(--space-4)" }}>
              <div className="detail-grid">
                <Field label={t("monitoring.platform")} htmlFor="cp-plat" required>
                  <select id="cp-plat" className="input" value={fpPlatform} onChange={(e) => setFpPlatform(e.target.value)} required>
                    {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label={t("monitoring.entry_type")} htmlFor="cp-type" required>
                  <select id="cp-type" className="input" value={fpEntryType} onChange={(e) => setFpEntryType(e.target.value)} required>
                    {ENTRY_TYPES.map((et) => <option key={et} value={et}>{et}</option>)}
                  </select>
                </Field>
                <Field label={t("monitoring.handle")} htmlFor="cp-handle">
                  <Input id="cp-handle" value={fpHandle} onChange={(e) => setFpHandle(e.target.value)} />
                </Field>
                <Field label={t("monitoring.url")} htmlFor="cp-url">
                  <Input id="cp-url" value={fpUrl} onChange={(e) => setFpUrl(e.target.value)} />
                </Field>
                <Field label={t("monitoring.priority")} htmlFor="cp-prio">
                  <select id="cp-prio" className="input" value={fpPriority} onChange={(e) => setFpPriority(e.target.value)}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label={t("monitoring.source")} htmlFor="cp-source">
                  <select id="cp-source" className="input" value={fpSource} onChange={(e) => setFpSource(e.target.value)}>
                    {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label={t("monitoring.source_ref")} htmlFor="cp-sref">
                  <Input id="cp-sref" value={fpSourceRef} onChange={(e) => setFpSourceRef(e.target.value)} />
                </Field>
                <Field label={t("monitoring.suspect_name")} htmlFor="cp-suspect">
                  <Input id="cp-suspect" value={fpSuspectName} onChange={(e) => setFpSuspectName(e.target.value)} />
                </Field>
                <Field label={t("monitoring.notes")} htmlFor="cp-notes">
                  <Input id="cp-notes" value={fpNotes} onChange={(e) => setFpNotes(e.target.value)} />
                </Field>
              </div>
              <div style={{ marginTop: "var(--space-3)" }}>
                <Button type="submit" disabled={creating}>{creating ? t("common.loading") : t("common.create")}</Button>
              </div>
            </form>
          )}

          {/* Table */}
          {loading ? <div className="loading-center">{t("common.loading")}</div> : profiles.length === 0 ? (
            <div className="empty-state"><h3>{t("monitoring.no_profiles")}</h3></div>
          ) : (
            <>
              <div className="table-scroll">
              <table className="entity-table">
                <thead>
                  <tr>
                    <th>{t("monitoring.platform")}</th>
                    <th>{t("monitoring.handle")}</th>
                    <th>{t("monitoring.source")}</th>
                    <th>{t("monitoring.suspect")}</th>
                    <th>{t("monitoring.priority")}</th>
                    <th>{t("monitoring.last_scraped")}</th>
                    {isAdmin && <th>{t("models.actions")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => (
                    <tr key={p.profile_id}>
                      <td data-label={t("monitoring.platform")}><span className="badge badge--default">{p.platform}</span></td>
                      <td data-label={t("monitoring.handle")}>{p.handle || "—"}</td>
                      <td data-label={t("monitoring.source")}>
                        <span className={`badge ${sourceBadgeClass(p.source)}`}>{p.source}</span>
                      </td>
                      <td data-label={t("monitoring.suspect")}>{p.suspect_name || "—"}</td>
                      <td data-label={t("monitoring.priority")}>
                        <span className={`badge badge--${p.priority === "HIGH" ? "error" : p.priority === "LOW" ? "success" : "warning"}`}>{p.priority}</span>
                      </td>
                      <td data-label={t("monitoring.last_scraped")}>{p.last_scraped_at ? new Date(p.last_scraped_at).toLocaleString() : "—"}</td>
                      {isAdmin && (
                        <td data-label={t("models.actions")}>
                          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                            <Button onClick={() => openEditProfile(p)} disabled={isOffline}>{t("slang.edit")}</Button>
                            <Button onClick={() => confirmDelete(p.profile_id, "profile")} disabled={isOffline}>{t("slang.delete")}</Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              {profileTotal > LIMIT && (
                <div className="pagination" style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", justifyContent: "center", marginTop: "var(--space-3)" }}>
                  <Button onClick={() => setProfileOffset(Math.max(0, profileOffset - LIMIT))} disabled={profileOffset === 0}>{t("audit.prev_page")}</Button>
                  <span>{t("monitoring.page_info", { from: profileOffset + 1, to: Math.min(profileOffset + LIMIT, profileTotal), total: profileTotal })}</span>
                  <Button onClick={() => setProfileOffset(profileOffset + LIMIT)} disabled={profileOffset + LIMIT >= profileTotal}>{t("audit.next_page")}</Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══ LOCATIONS TAB ═══ */}
      {tab === "locations" && (
        <div className="admin-section">
          <div className="admin-section__header">
            <h2>{t("monitoring.locations_heading")}</h2>
            {isAdmin && (
              <Button onClick={() => setShowCreateLocation(!showCreateLocation)} disabled={isOffline}>
                {showCreateLocation ? t("common.cancel") : t("monitoring.add_location")}
              </Button>
            )}
          </div>

          {/* Search */}
          <div className="filter-bar" style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "var(--space-3)" }}>
            <Field label={t("slang.search")} htmlFor="ml-search">
              <Input id="ml-search" value={locSearchText} onChange={(e) => setLocSearchText(e.target.value)} placeholder={t("slang.search_placeholder")} />
            </Field>
          </div>

          {/* Create form */}
          {showCreateLocation && (
            <form onSubmit={handleCreateLocation} className="detail-section" style={{ marginBottom: "var(--space-4)" }}>
              <div className="detail-grid">
                <Field label={t("monitoring.district_name")} htmlFor="cl-dist" required>
                  <Input id="cl-dist" value={flDistrict} onChange={(e) => setFlDistrict(e.target.value)} required />
                </Field>
                <Field label={t("monitoring.city_names")} htmlFor="cl-cities">
                  <Input id="cl-cities" value={flCities} onChange={(e) => setFlCities(e.target.value)} placeholder={t("monitoring.comma_separated")} />
                </Field>
                <Field label={t("monitoring.area_names")} htmlFor="cl-areas">
                  <Input id="cl-areas" value={flAreas} onChange={(e) => setFlAreas(e.target.value)} placeholder={t("monitoring.comma_separated")} />
                </Field>
                <Field label={t("monitoring.alt_spellings")} htmlFor="cl-alt">
                  <Input id="cl-alt" value={flAltSpellings} onChange={(e) => setFlAltSpellings(e.target.value)} placeholder={t("monitoring.comma_separated")} />
                </Field>
                <Field label={t("monitoring.notes")} htmlFor="cl-notes">
                  <Input id="cl-notes" value={flNotes} onChange={(e) => setFlNotes(e.target.value)} />
                </Field>
              </div>
              <div style={{ marginTop: "var(--space-3)" }}>
                <Button type="submit" disabled={creatingLoc}>{creatingLoc ? t("common.loading") : t("common.create")}</Button>
              </div>
            </form>
          )}

          {/* Table */}
          {loading ? <div className="loading-center">{t("common.loading")}</div> : locations.length === 0 ? (
            <div className="empty-state"><h3>{t("monitoring.no_locations")}</h3></div>
          ) : (
            <>
              <div className="table-scroll">
              <table className="entity-table">
                <thead>
                  <tr>
                    <th>{t("monitoring.district_name")}</th>
                    <th>{t("monitoring.city_names")}</th>
                    <th>{t("monitoring.area_names")}</th>
                    {isAdmin && <th>{t("models.actions")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {locations.map((loc) => (
                    <tr key={loc.location_id}>
                      <td data-label={t("monitoring.district_name")}><strong>{loc.district_name}</strong></td>
                      <td data-label={t("monitoring.city_names")} style={{ wordBreak: "break-word" }}>
                        {Array.isArray(loc.city_names) ? loc.city_names.join(", ") : "—"}
                      </td>
                      <td data-label={t("monitoring.area_names")} style={{ wordBreak: "break-word" }}>
                        {Array.isArray(loc.area_names) ? loc.area_names.join(", ") : "—"}
                      </td>
                      {isAdmin && (
                        <td data-label={t("models.actions")}>
                          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                            <Button onClick={() => openEditLocation(loc)} disabled={isOffline}>{t("slang.edit")}</Button>
                            <Button onClick={() => confirmDelete(loc.location_id, "location")} disabled={isOffline}>{t("slang.delete")}</Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              {locationTotal > LIMIT && (
                <div className="pagination" style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", justifyContent: "center", marginTop: "var(--space-3)" }}>
                  <Button onClick={() => setLocationOffset(Math.max(0, locationOffset - LIMIT))} disabled={locationOffset === 0}>{t("audit.prev_page")}</Button>
                  <span>{t("monitoring.page_info", { from: locationOffset + 1, to: Math.min(locationOffset + LIMIT, locationTotal), total: locationTotal })}</span>
                  <Button onClick={() => setLocationOffset(locationOffset + LIMIT)} disabled={locationOffset + LIMIT >= locationTotal}>{t("audit.next_page")}</Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══ EDIT PROFILE MODAL ═══ */}
      <Modal
        open={!!editProfile}
        title={t("monitoring.edit_profile")}
        onClose={() => setEditProfile(null)}
        actions={
          <>
            <Button onClick={() => setEditProfile(null)}>{t("common.cancel")}</Button>
            <Button onClick={handleSaveProfile} disabled={saving}>{saving ? t("common.loading") : t("common.save")}</Button>
          </>
        }
      >
        {editProfile && (
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <Field label={t("monitoring.platform")} htmlFor="ep-plat">
              <select id="ep-plat" className="input" value={epPlatform} onChange={(e) => setEpPlatform(e.target.value)}>
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label={t("monitoring.entry_type")} htmlFor="ep-type">
              <select id="ep-type" className="input" value={epEntryType} onChange={(e) => setEpEntryType(e.target.value)}>
                {ENTRY_TYPES.map((et) => <option key={et} value={et}>{et}</option>)}
              </select>
            </Field>
            <Field label={t("monitoring.handle")} htmlFor="ep-handle">
              <Input id="ep-handle" value={epHandle} onChange={(e) => setEpHandle(e.target.value)} />
            </Field>
            <Field label={t("monitoring.url")} htmlFor="ep-url">
              <Input id="ep-url" value={epUrl} onChange={(e) => setEpUrl(e.target.value)} />
            </Field>
            <Field label={t("monitoring.priority")} htmlFor="ep-prio">
              <select id="ep-prio" className="input" value={epPriority} onChange={(e) => setEpPriority(e.target.value)}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label={t("monitoring.source")} htmlFor="ep-source">
              <select id="ep-source" className="input" value={epSource} onChange={(e) => setEpSource(e.target.value)}
                disabled={["NIDAAN","TEF","UNODC","EUROPOL","INTERPOL","NCB","DEA","FATF"].includes(epSource)}>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label={t("monitoring.source_ref")} htmlFor="ep-sref">
              <Input id="ep-sref" value={epSourceRef} onChange={(e) => setEpSourceRef(e.target.value)} />
            </Field>
            <Field label={t("monitoring.suspect_name")} htmlFor="ep-suspect">
              <Input id="ep-suspect" value={epSuspectName} onChange={(e) => setEpSuspectName(e.target.value)} />
            </Field>
            <Field label={t("monitoring.notes")} htmlFor="ep-notes">
              <Input id="ep-notes" value={epNotes} onChange={(e) => setEpNotes(e.target.value)} />
            </Field>
          </div>
        )}
      </Modal>

      {/* ═══ EDIT LOCATION MODAL ═══ */}
      <Modal
        open={!!editLocation}
        title={t("monitoring.edit_location")}
        onClose={() => setEditLocation(null)}
        actions={
          <>
            <Button onClick={() => setEditLocation(null)}>{t("common.cancel")}</Button>
            <Button onClick={handleSaveLocation} disabled={savingLoc}>{savingLoc ? t("common.loading") : t("common.save")}</Button>
          </>
        }
      >
        {editLocation && (
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <Field label={t("monitoring.district_name")} htmlFor="el-dist">
              <Input id="el-dist" value={elDistrict} onChange={(e) => setElDistrict(e.target.value)} />
            </Field>
            <Field label={t("monitoring.city_names")} htmlFor="el-cities">
              <Input id="el-cities" value={elCities} onChange={(e) => setElCities(e.target.value)} placeholder={t("monitoring.comma_separated")} />
            </Field>
            <Field label={t("monitoring.area_names")} htmlFor="el-areas">
              <Input id="el-areas" value={elAreas} onChange={(e) => setElAreas(e.target.value)} placeholder={t("monitoring.comma_separated")} />
            </Field>
            <Field label={t("monitoring.alt_spellings")} htmlFor="el-alt">
              <Input id="el-alt" value={elAltSpellings} onChange={(e) => setElAltSpellings(e.target.value)} placeholder={t("monitoring.comma_separated")} />
            </Field>
            <Field label={t("monitoring.notes")} htmlFor="el-notes">
              <Input id="el-notes" value={elNotes} onChange={(e) => setElNotes(e.target.value)} />
            </Field>
          </div>
        )}
      </Modal>

      {/* ═══ DELETE CONFIRMATION MODAL ═══ */}
      <Modal
        open={!!deleteId}
        title={t("monitoring.confirm_delete")}
        onClose={() => setDeleteId(null)}
        actions={
          <>
            <Button onClick={() => setDeleteId(null)}>{t("common.cancel")}</Button>
            <Button onClick={handleDelete} disabled={deleting}>{deleting ? t("common.loading") : t("slang.delete")}</Button>
          </>
        }
      >
        <p>{t(deleteType === "profile" ? "monitoring.delete_profile_warning" : "monitoring.delete_location_warning")}</p>
      </Modal>
    </>
  );
}
