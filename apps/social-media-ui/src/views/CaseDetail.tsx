import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Badge, Button, Input, ProgressBar, Select, Tabs, Textarea, useToast } from "@puda/shared";
import { apiBaseUrl, CaseRecord, LinkedPost, TimelineEvent } from "../types";
import EmptyState from "../components/EmptyState";
import { renderMarkdown } from "../utils/render-markdown";

type Props = {
  id: string;
  authHeaders: () => Record<string, string>;
  isOffline: boolean;
  onBack: () => void;
  onNavigate?: (entityType: string, entityId: string) => void;
};

const STATE_COLORS: Record<string, string> = {
  OPEN: "info",
  ASSIGNED: "warning",
  UNDER_INVESTIGATION: "primary",
  AWAITING_REVIEW: "warning",
  CLOSED: "success",
  REOPENED: "danger",
};

const TRANSITION_CONFIG: Record<string, { label: string; variant: "primary" | "secondary" | "danger"; requiresRemarks: boolean }> = {
  ASSIGN: { label: "transition.assign", variant: "primary", requiresRemarks: false },
  START_INVEST: { label: "transition.start_investigation", variant: "primary", requiresRemarks: false },
  SUBMIT_REVIEW: { label: "transition.submit_review", variant: "secondary", requiresRemarks: false },
  APPROVE_CLOSE: { label: "transition.approve_close", variant: "primary", requiresRemarks: true },
  RETURN_REWORK: { label: "transition.return_rework", variant: "danger", requiresRemarks: true },
  REOPEN: { label: "transition.reopen", variant: "secondary", requiresRemarks: true },
  RESUME: { label: "transition.resume", variant: "primary", requiresRemarks: false },
};

const TIMELINE_ICONS: Record<string, string> = {
  STATE_CHANGE: "M5 12h14M12 5l7 7-7 7",
  NOTE: "M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z",
  EVIDENCE_ADDED: "M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48",
  ALERT_LINKED: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9",
  REPORT_CREATED: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

function ThreatBadge({ score }: { score: string | null }) {
  if (!score) return null;
  const n = parseFloat(score);
  const variant = n >= 80 ? "danger" : n >= 50 ? "warning" : "success";
  return <Badge variant={variant}>{Math.round(n)}%</Badge>;
}

export default function CaseDetail({ id, authHeaders, isOffline, onBack, onNavigate }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [caseData, setCaseData] = useState<CaseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableTransitions, setAvailableTransitions] = useState<Array<{ transitionId: string; toStateId: string; label: string }>>([]);
  const [activeTransition, setActiveTransition] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");
  const [transitioning, setTransitioning] = useState(false);

  // Notes
  const [notes, setNotes] = useState<Array<{ note_id: string; note_text: string; created_by: string; created_at: string }>>([]);
  const [newNote, setNewNote] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  // Timeline
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

  // Linked posts
  const [linkedPosts, setLinkedPosts] = useState<LinkedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  // Classification & legal
  const [classification, setClassification] = useState<any>(null);
  const [classifyLoading, setClassifyLoading] = useState(false);
  const [legalMappings, setLegalMappings] = useState<any[]>([]);

  // Officer picker for ASSIGN
  const [officers, setOfficers] = useState<Array<{ user_id: string; full_name: string; designation: string }>>([]);
  const [selectedOfficer, setSelectedOfficer] = useState("");
  const [officersLoading, setOfficersLoading] = useState(false);

  // AI summary
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [investigationSummary, setInvestigationSummary] = useState<string | null>(null);
  const [summaryProvider, setSummaryProvider] = useState<string | null>(null);

  const fetchCase = useCallback(() => {
    return fetch(`${apiBaseUrl}/api/v1/cases/${id}`, authHeaders())
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => setCaseData(data.case || data));
  }, [id, authHeaders]);

  const fetchTransitions = useCallback(() => {
    fetch(`${apiBaseUrl}/api/v1/cases/${id}/transitions`, authHeaders())
      .then((r) => r.ok ? r.json() : { transitions: [] })
      .then((data) => setAvailableTransitions(data.transitions || []))
      .catch(() => setAvailableTransitions([]));
  }, [id, authHeaders]);

  const fetchNotes = useCallback(() => {
    fetch(`${apiBaseUrl}/api/v1/cases/${id}/notes`, authHeaders())
      .then((r) => r.ok ? r.json() : { notes: [] })
      .then((data) => setNotes(data.notes || []))
      .catch(() => setNotes([]));
  }, [id, authHeaders]);

  const fetchTimeline = useCallback(() => {
    fetch(`${apiBaseUrl}/api/v1/cases/${id}/timeline`, authHeaders())
      .then((r) => r.ok ? r.json() : { timeline: [] })
      .then((data) => setTimeline(data.timeline || []))
      .catch(() => setTimeline([]));
  }, [id, authHeaders]);

  const fetchLinkedPosts = useCallback(() => {
    setPostsLoading(true);
    fetch(`${apiBaseUrl}/api/v1/cases/${id}/linked-posts`, authHeaders())
      .then((r) => r.ok ? r.json() : { posts: [] })
      .then((data) => setLinkedPosts(data.posts || []))
      .catch(() => setLinkedPosts([]))
      .finally(() => setPostsLoading(false));
  }, [id, authHeaders]);

  useEffect(() => {
    setLoading(true);
    fetchCase()
      .then(() => { fetchTransitions(); fetchNotes(); fetchTimeline(); fetchLinkedPosts(); })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  }, [fetchCase, fetchTransitions, fetchNotes, fetchTimeline, fetchLinkedPosts]);

  useEffect(() => {
    if (!id) return;
    fetch(`${apiBaseUrl}/api/v1/classify/sm_case/${id}`, authHeaders())
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setClassification(data); })
      .catch(() => {});
    fetch(`${apiBaseUrl}/api/v1/legal/mappings/sm_case/${id}`, authHeaders())
      .then(r => r.ok ? r.json() : { mappings: [] })
      .then(data => setLegalMappings(data.mappings || []))
      .catch(() => {});
  }, [id, authHeaders]);

  const handleClassify = async () => {
    setClassifyLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/classify/sm_case/${id}`, {
        ...authHeaders(), method: "POST", body: JSON.stringify({}),
      });
      if (res.ok) setClassification(await res.json());
    } catch { /* silent */ }
    setClassifyLoading(false);
  };

  const handleGenerateSummary = async () => {
    setGeneratingSummary(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/llm/investigation-summary`, {
        ...authHeaders(), method: "POST",
        body: JSON.stringify({ entity_type: "sm_case", entity_id: id, text: caseData?.description || "" }),
      });
      if (res.ok) {
        const data = await res.json();
        setInvestigationSummary(data.summary || data.content);
        setSummaryProvider(data.provider || null);
        showToast("success", t("llm.summary_generated"));
      }
    } catch { showToast("error", t("common.error")); }
    setGeneratingSummary(false);
  };

  const fetchOfficers = useCallback(() => {
    setOfficersLoading(true);
    fetch(`${apiBaseUrl}/api/v1/cases/assignable-officers`, authHeaders())
      .then((r) => r.ok ? r.json() : { officers: [] })
      .then((data) => setOfficers(data.officers || []))
      .catch(() => setOfficers([]))
      .finally(() => setOfficersLoading(false));
  }, [authHeaders]);

  const handleTransition = async (transitionId: string) => {
    if (isOffline) return;
    const config = TRANSITION_CONFIG[transitionId];
    if (config?.requiresRemarks && !remarks.trim()) {
      showToast("error", t("transition.reason_required"));
      return;
    }
    if (transitionId === "ASSIGN" && !selectedOfficer) {
      showToast("error", t("transition.select_officer"));
      return;
    }
    setTransitioning(true);
    try {
      const body: Record<string, string | undefined> = { transitionId, remarks: remarks || undefined };
      if (transitionId === "ASSIGN" && selectedOfficer) body.assignedTo = selectedOfficer;
      const res = await fetch(`${apiBaseUrl}/api/v1/cases/${id}/transition`, {
        ...authHeaders(), method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      setActiveTransition(null);
      setRemarks("");
      setSelectedOfficer("");
      await fetchCase();
      fetchTransitions();
      fetchTimeline();
      showToast("success", t("transition.success"));
    } catch (err) { showToast("error", err instanceof Error ? err.message : t("transition.error")); }
    finally { setTransitioning(false); }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || isOffline) return;
    setSubmittingNote(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/cases/${id}/notes`, {
        ...authHeaders(), method: "POST",
        body: JSON.stringify({ note_text: newNote }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      setNewNote("");
      fetchNotes();
      fetchTimeline();
      showToast("success", t("notes.added"));
    } catch { showToast("error", t("common.error")); }
    finally { setSubmittingNote(false); }
  };

  if (loading) return <div className="loading-center">{t("common.loading")}</div>;
  if (error) return <Alert variant="error">{error}</Alert>;
  if (!caseData) return null;

  const stateColor = STATE_COLORS[caseData.state_id] || "default";

  // Sort timeline chronologically (oldest first)
  const sortedTimeline = [...timeline].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return (
    <>
      {/* Header */}
      <div className="detail-header">
        <button className="detail-header__back" onClick={onBack} aria-label={t("detail.back")} type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", fontFamily: "monospace" }}>{caseData.case_ref || caseData.case_number || ""}</span>
            <span className={`badge badge--${caseData.priority?.toLowerCase() || "default"}`}>{caseData.priority}</span>
            <span className={`badge badge--${stateColor}`}>{caseData.state_id}</span>
          </div>
          <h1 style={{ margin: "var(--space-1) 0 0", fontSize: "clamp(1.125rem, 3vw, 1.5rem)", lineHeight: 1.2 }}>{caseData.title}</h1>
        </div>
      </div>

      {/* Action Buttons */}
      {availableTransitions.length > 0 && (
        <div className="transition-bar" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
            {availableTransitions.map((tr) => {
              const config = TRANSITION_CONFIG[tr.transitionId] || { label: tr.label || tr.transitionId, variant: "secondary" as const, requiresRemarks: false };
              const needsExpansion = config.requiresRemarks || tr.transitionId === "ASSIGN";
              return (
                <Button
                  key={tr.transitionId}
                  variant={config.variant}
                  size="sm"
                  onClick={() => {
                    if (needsExpansion) {
                      const toggling = activeTransition === tr.transitionId;
                      setActiveTransition(toggling ? null : tr.transitionId);
                      if (!toggling && tr.transitionId === "ASSIGN" && officers.length === 0) fetchOfficers();
                    } else {
                      handleTransition(tr.transitionId);
                    }
                  }}
                  disabled={transitioning || isOffline}
                >
                  {t(config.label)}
                </Button>
              );
            })}
          </div>
          {activeTransition === "ASSIGN" && (
            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "12rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", marginBottom: "var(--space-1)", fontWeight: 600 }}>
                  {t("transition.select_officer")}
                </label>
                {officersLoading ? (
                  <span style={{ color: "var(--color-text-muted)" }}>{t("common.loading")}</span>
                ) : (
                  <Select value={selectedOfficer} onChange={(e) => setSelectedOfficer(e.target.value)}>
                    <option value="">{t("transition.select_officer")}</option>
                    {officers.map((o) => (
                      <option key={o.user_id} value={o.user_id}>
                        {o.full_name}{o.designation ? ` — ${o.designation}` : ""}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
              <div style={{ flex: 1, minWidth: "12rem" }}>
                <Input
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder={t("transition.remarks_placeholder")}
                  disabled={isOffline}
                />
              </div>
              <Button
                size="sm"
                onClick={() => handleTransition("ASSIGN")}
                disabled={transitioning || isOffline || !selectedOfficer}
              >
                {t(transitioning ? "transition.submitting" : "transition.submit")}
              </Button>
            </div>
          )}
          {activeTransition && activeTransition !== "ASSIGN" && (
            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <Input
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder={t("transition.remarks_placeholder")}
                  disabled={isOffline}
                />
              </div>
              <Button
                size="sm"
                onClick={() => handleTransition(activeTransition)}
                disabled={transitioning || isOffline || !remarks.trim()}
              >
                {t(transitioning ? "transition.submitting" : "transition.submit")}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs tabs={[
        /* ── Tab 1: Details ── */
        { key: "details", label: t("detail.tab_details"), content: (
          <>
            <div className="detail-section">
              <h2 className="detail-section__title">{t("cases.case_information")}</h2>
              <div className="detail-grid">
                <div className="detail-field">
                  <span className="detail-field__label">{t("cases.case_ref")}</span>
                  <span className="detail-field__value" style={{ fontFamily: "monospace" }}>{caseData.case_ref || caseData.case_number || "—"}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-field__label">{t("cases.assigned_officer")}</span>
                  <span className="detail-field__value">
                    {caseData.assigned_to_name ? (
                      <>
                        {caseData.assigned_to_name}
                        {caseData.assigned_to_designation && (
                          <small style={{ display: "block", color: "var(--color-text-muted)", fontSize: "0.75rem" }}>{caseData.assigned_to_designation}</small>
                        )}
                      </>
                    ) : "—"}
                  </span>
                </div>
                <div className="detail-field">
                  <span className="detail-field__label">{t("cases.created_by")}</span>
                  <span className="detail-field__value">{caseData.created_by_name || caseData.created_by || "—"}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-field__label">{t("cases.priority")}</span>
                  <span className="detail-field__value"><span className={`badge badge--${caseData.priority?.toLowerCase() || "default"}`}>{caseData.priority}</span></span>
                </div>
                <div className="detail-field">
                  <span className="detail-field__label">{t("cases.status")}</span>
                  <span className="detail-field__value"><span className={`badge badge--${stateColor}`}>{caseData.state_id}</span></span>
                </div>
                <div className="detail-field">
                  <span className="detail-field__label">{t("detail.created_at")}</span>
                  <span className="detail-field__value">{caseData.created_at ? formatDate(caseData.created_at) : "—"}</span>
                </div>
                {caseData.due_at && (
                  <div className="detail-field">
                    <span className="detail-field__label">{t("cases.due_date")}</span>
                    <span className="detail-field__value">{formatDate(caseData.due_at)}</span>
                  </div>
                )}
                {caseData.state_id === "CLOSED" && (
                  <>
                    <div className="detail-field">
                      <span className="detail-field__label">{t("cases.closed_at")}</span>
                      <span className="detail-field__value">{caseData.closed_at ? formatDate(caseData.closed_at) : "—"}</span>
                    </div>
                    <div className="detail-field">
                      <span className="detail-field__label">{t("cases.closure_reason")}</span>
                      <span className="detail-field__value">{caseData.closure_reason || "—"}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Source Alert */}
            {caseData.source_alert_id && caseData.source_alert_ref && (
              <div className="detail-section">
                <h2 className="detail-section__title">{t("cases.source_alert")}</h2>
                <div
                  className="card card--clickable"
                  style={{ padding: "var(--space-3)", cursor: onNavigate ? "pointer" : "default" }}
                  onClick={() => onNavigate?.("alert", caseData.source_alert_id!)}
                  role={onNavigate ? "button" : undefined}
                  tabIndex={onNavigate ? 0 : undefined}
                  onKeyDown={(e) => { if (e.key === "Enter" && onNavigate) onNavigate("alert", caseData.source_alert_id!); }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "monospace", fontSize: "0.875rem" }}>{caseData.source_alert_ref}</span>
                    {caseData.source_alert_priority && <span className={`badge badge--${caseData.source_alert_priority.toLowerCase()}`}>{caseData.source_alert_priority}</span>}
                    {caseData.source_alert_state && <span className="badge badge--default">{caseData.source_alert_state}</span>}
                  </div>
                  {caseData.source_alert_title && <p style={{ margin: "var(--space-1) 0 0", fontSize: "0.875rem" }}>{caseData.source_alert_title}</p>}
                  {onNavigate && <small style={{ color: "var(--color-primary)" }}>{t("cases.view_alert")} →</small>}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="detail-section">
              <h2 className="detail-section__title">{t("detail.description")}</h2>
              <p style={{ color: "var(--color-text-muted)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{caseData.description || "—"}</p>
            </div>

            {/* Classification */}
            <div className="detail-section">
              <h3 className="detail-section__title">{t("classify.risk_score")}</h3>
              {classification ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                    <Badge variant={parseFloat(classification.risk_score) >= 70 ? "danger" : parseFloat(classification.risk_score) >= 40 ? "warning" : "success"}>
                      {classification.category || t("classify.uncategorized")}
                    </Badge>
                    <span style={{ fontWeight: 600 }}>{Math.round(parseFloat(classification.risk_score) || 0)}%</span>
                  </div>
                  <ProgressBar current={Math.round(parseFloat(classification.risk_score) || 0)} total={100} />
                  {classification.risk_factors && classification.risk_factors.length > 0 && (
                    <ul style={{ marginTop: "var(--space-2)", paddingLeft: "var(--space-4)", fontSize: "0.875rem" }}>
                      {classification.risk_factors.map((f: any, i: number) => <li key={i}>{f.detail || f.factor}</li>)}
                    </ul>
                  )}
                </div>
              ) : (
                <Button onClick={handleClassify} disabled={isOffline || classifyLoading} variant="secondary">
                  {classifyLoading ? t("common.loading") : t("classify.run")}
                </Button>
              )}
            </div>

            {/* Legal mappings */}
            {legalMappings.length > 0 && (
              <div className="detail-section">
                <h3 className="detail-section__title">{t("legal.applicable_statutes")}</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                  {legalMappings.map((m: any, i: number) => (
                    <Badge key={i} variant="info">{m.statute_code} — {m.statute_name}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* AI summary */}
            <div className="detail-section">
              <h3 className="detail-section__title">{t("llm.investigation_summary")}</h3>
              <Button onClick={handleGenerateSummary} disabled={isOffline || generatingSummary} variant="secondary">
                {generatingSummary ? t("llm.generating_summary") : t("llm.investigation_summary")}
              </Button>
              {investigationSummary && (
                <div style={{ marginTop: "var(--space-2)", padding: "var(--space-3)", background: "var(--color-surface-alt)", borderRadius: "var(--radius-md)" }}>
                  <strong>{t("llm.ai_result")}</strong>
                  <div
                    className="markdown-content"
                    style={{ marginTop: "var(--space-1)", fontSize: "0.875rem" }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(investigationSummary) }}
                  />
                  {summaryProvider && <small style={{ color: "var(--color-text-muted)" }}>{t("llm.powered_by")} {summaryProvider}</small>}
                </div>
              )}
            </div>
          </>
        )},

        /* ── Tab 2: Linked Posts ── */
        { key: "linked-posts", label: t("cases.linked_posts"), content: (
          <div className="detail-section">
            {postsLoading ? (
              <div className="loading-center">{t("common.loading")}</div>
            ) : linkedPosts.length === 0 ? (
              <EmptyState icon="search" title={t("cases.no_linked_posts")} />
            ) : (
              <div style={{ display: "grid", gap: "var(--space-3)" }}>
                {linkedPosts.map((post) => (
                  <div
                    key={post.content_id}
                    className="card card--clickable"
                    style={{ padding: "var(--space-3)", cursor: onNavigate ? "pointer" : "default" }}
                    onClick={() => onNavigate?.("content", post.content_id)}
                    role={onNavigate ? "button" : undefined}
                    tabIndex={onNavigate ? 0 : undefined}
                    onKeyDown={(e) => { if (e.key === "Enter" && onNavigate) onNavigate("content", post.content_id); }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-2)" }}>
                      <Badge variant="info">{post.platform}</Badge>
                      <span style={{ fontWeight: 600 }}>{post.author_handle}</span>
                      {post.author_name && post.author_name !== post.author_handle && (
                        <small style={{ color: "var(--color-text-muted)" }}>({post.author_name})</small>
                      )}
                      <ThreatBadge score={post.threat_score} />
                      {post.language && <Badge variant="default">{post.language}</Badge>}
                    </div>
                    <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", wordBreak: "break-word", margin: 0 }}>
                      {post.content_text && post.content_text.length > 200 ? post.content_text.slice(0, 200) + "…" : post.content_text}
                    </p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--space-2)" }}>
                      <small style={{ color: "var(--color-text-muted)" }}>{post.published_at ? relativeDate(post.published_at) : ""}</small>
                      {onNavigate && <small style={{ color: "var(--color-primary)" }}>{t("cases.view_post")} →</small>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )},

        /* ── Tab 3: Workflow History ── */
        { key: "workflow-history", label: t("cases.workflow_history"), content: (
          <div className="detail-section">
            {sortedTimeline.length === 0 ? (
              <EmptyState icon="inbox" title={t("activity.empty")} />
            ) : (
              <div className="case-timeline">
                {sortedTimeline.map((ev) => {
                  const iconPath = TIMELINE_ICONS[ev.event_type] || TIMELINE_ICONS.NOTE;
                  return (
                    <div key={ev.event_id} className="case-timeline__item">
                      <div className="case-timeline__dot">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d={iconPath} />
                        </svg>
                      </div>
                      <div className="case-timeline__content">
                        <div className="case-timeline__header">
                          {ev.event_type === "STATE_CHANGE" && (
                            <span>
                              {t("timeline.state_change")}:{" "}
                              <span className={`badge badge--${STATE_COLORS[ev.from_state || ""] || "default"}`} style={{ fontSize: "0.75rem" }}>{ev.from_state}</span>
                              {" → "}
                              <span className={`badge badge--${STATE_COLORS[ev.to_state || ""] || "default"}`} style={{ fontSize: "0.75rem" }}>{ev.to_state}</span>
                            </span>
                          )}
                          {ev.event_type === "NOTE" && <span>{t("timeline.note_added")}</span>}
                          {ev.event_type === "EVIDENCE_ADDED" && <span>{t("timeline.evidence_added")}: {ev.detail}</span>}
                          {ev.event_type === "ALERT_LINKED" && <span>{t("timeline.alert_linked")}: {ev.detail}</span>}
                          {ev.event_type === "REPORT_CREATED" && <span>{t("timeline.report_created")}: {ev.detail}</span>}
                        </div>
                        {ev.detail && ev.event_type === "STATE_CHANGE" && (
                          <p className="case-timeline__detail">{ev.detail}</p>
                        )}
                        {ev.detail && ev.event_type === "NOTE" && (
                          <p className="case-timeline__detail">{ev.detail}</p>
                        )}
                        <div className="case-timeline__meta">
                          {ev.actor_name && <span>{ev.actor_name}</span>}
                          <span>{formatDate(ev.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )},

        /* ── Tab 4: Notes ── */
        { key: "notes", label: t("detail.tab_notes"), content: (
          <div className="detail-section">
            <div className="notes-form" style={{ marginBottom: "var(--space-4)" }}>
              <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder={t("notes.placeholder")} disabled={isOffline} />
              <Button size="sm" onClick={handleAddNote} disabled={!newNote.trim() || submittingNote || isOffline} style={{ marginTop: "var(--space-2)" }}>
                {t("notes.add")}
              </Button>
            </div>
            {notes.length === 0 ? <EmptyState icon="inbox" title={t("notes.empty")} /> : (
              <ul className="notes-list">
                {notes.map((n) => (
                  <li key={n.note_id} className="notes-list__item">
                    <p>{n.note_text}</p>
                    <small style={{ color: "var(--color-text-muted)" }}>{n.created_by} — {formatDate(n.created_at)}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )},
      ]} />
    </>
  );
}
