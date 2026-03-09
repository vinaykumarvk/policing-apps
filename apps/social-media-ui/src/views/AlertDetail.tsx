import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert as AlertUI, Badge, Button, Field, Input, ProgressBar, Select, Tabs, Textarea, useToast } from "@puda/shared";
import { apiBaseUrl, SMAlert } from "../types";
import EmptyState from "../components/EmptyState";

type Props = { id: string; authHeaders: () => Record<string, string>; isOffline: boolean; onBack: () => void };

export default function AlertDetail({ id, authHeaders, isOffline, onBack }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [alert, setAlert] = useState<SMAlert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTransition, setSelectedTransition] = useState("");
  const [availableTransitions, setAvailableTransitions] = useState<Array<{ transitionId: string; toStateId: string; label: string }>>([]);
  const [remarks, setRemarks] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const [notes, setNotes] = useState<Array<{ note_id: string; note_text: string; created_by: string; created_at: string }>>([]);
  const [activity, setActivity] = useState<Array<{ event_id: string; event_type: string; actor_id: string; created_at: string; payload_jsonb?: any }>>([]);
  const [newNote, setNewNote] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [classification, setClassification] = useState<any>(null);
  const [classifyLoading, setClassifyLoading] = useState(false);
  const [legalMappings, setLegalMappings] = useState<any[]>([]);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState("hi");
  const [translating, setTranslating] = useState(false);
  const [escalationReason, setEscalationReason] = useState("");
  const [escalating, setEscalating] = useState(false);
  const [generatingNarrative, setGeneratingNarrative] = useState(false);
  const [riskNarrative, setRiskNarrative] = useState<string | null>(null);
  const [narrativeProvider, setNarrativeProvider] = useState<string | null>(null);
  const [autoMapping, setAutoMapping] = useState(false);

  const fetchTransitions = () => {
    fetch(`${apiBaseUrl}/api/v1/alerts/${id}/transitions`, authHeaders())
      .then((r) => r.ok ? r.json() : { transitions: [] })
      .then((data) => setAvailableTransitions(data.transitions || []))
      .catch(() => setAvailableTransitions([]));
  };

  const fetchNotes = () => {
    fetch(`${apiBaseUrl}/api/v1/alerts/${id}/notes`, authHeaders())
      .then((r) => r.ok ? r.json() : { notes: [] })
      .then((data) => setNotes(data.notes || []))
      .catch(() => setNotes([]));
  };

  const fetchActivity = () => {
    fetch(`${apiBaseUrl}/api/v1/alerts/${id}/activity`, authHeaders())
      .then((r) => r.ok ? r.json() : { events: [] })
      .then((data) => setActivity(data.events || data.activity || []))
      .catch(() => setActivity([]));
  };

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/v1/alerts/${id}`, authHeaders())
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => { setAlert(data.alert || data); fetchTransitions(); fetchNotes(); fetchActivity(); })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  }, [id, authHeaders]);

  useEffect(() => {
    if (!id) return;
    fetch(`${apiBaseUrl}/api/v1/classify/sm_alert/${id}`, authHeaders())
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setClassification(data); })
      .catch(() => {});
    fetch(`${apiBaseUrl}/api/v1/legal/mappings/sm_alert/${id}`, authHeaders())
      .then(r => r.ok ? r.json() : { mappings: [] })
      .then(data => setLegalMappings(data.mappings || []))
      .catch(() => {});
  }, [id]);

  const handleClassify = async () => {
    setClassifyLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/classify/sm_alert/${id}`, {
        ...authHeaders(),
        method: "POST",
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setClassification(data);
      }
    } catch { /* silent */ }
    setClassifyLoading(false);
  };

  const handleTranslate = async () => {
    setTranslating(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/translate`, {
        ...authHeaders(),
        method: "POST",
        body: JSON.stringify({ entityType: "sm_alert", entityId: id, targetLanguage: targetLang }),
      });
      if (res.ok) {
        const data = await res.json();
        setTranslatedText(data.translated_text);
      }
    } catch { /* silent */ }
    setTranslating(false);
  };

  const handleGenerateNarrative = async () => {
    setGeneratingNarrative(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/llm/risk-narrative`, {
        ...authHeaders(), method: "POST",
        body: JSON.stringify({ entity_type: "sm_alert", entity_id: id, text: alert?.description || "" }),
      });
      if (res.ok) {
        const data = await res.json();
        setRiskNarrative(data.narrative || data.content);
        setNarrativeProvider(data.provider || null);
        showToast("success", t("llm.narrative_generated"));
      }
    } catch { showToast("error", t("common.error")); }
    setGeneratingNarrative(false);
  };

  const handleAutoMapLegal = async () => {
    setAutoMapping(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/legal/map`, {
        ...authHeaders(), method: "POST",
        body: JSON.stringify({ entityType: "sm_alert", entityId: id }),
      });
      if (res.ok) {
        const data = await res.json();
        setLegalMappings(data.mappings || []);
        showToast("success", t("legal.mapping_complete"));
      }
    } catch { showToast("error", t("common.error")); }
    finally { setAutoMapping(false); }
  };

  const handleReviewMapping = async (mappingId: string, decision: "APPROVED" | "REJECTED") => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/legal/mappings/${mappingId}/review`, {
        ...authHeaders(), method: "PATCH",
        body: JSON.stringify({ decision }),
      });
      if (res.ok) {
        showToast("success", t("legal.mapping_reviewed"));
        // Refresh mappings
        const mapRes = await fetch(`${apiBaseUrl}/api/v1/legal/mappings/sm_alert/${id}`, authHeaders());
        if (mapRes.ok) { const d = await mapRes.json(); setLegalMappings(d.mappings || []); }
      }
    } catch { showToast("error", t("common.error")); }
  };

  const handleEscalate = async () => {
    if (!escalationReason.trim()) return;
    setEscalating(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/alerts/${id}/escalate`, {
        ...authHeaders(), method: "POST",
        body: JSON.stringify({ reason: escalationReason }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      showToast("success", t("escalation.requested"));
      setEscalationReason("");
      const entityRes = await fetch(`${apiBaseUrl}/api/v1/alerts/${id}`, authHeaders());
      if (entityRes.ok) { const d = await entityRes.json(); setAlert(d.alert || d); }
    } catch { showToast("error", t("common.error")); }
    finally { setEscalating(false); }
  };

  const handleTransition = async () => {
    if (!selectedTransition || isOffline) return;
    setTransitioning(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/alerts/${id}/transition`, {
        ...authHeaders(), method: "POST",
        body: JSON.stringify({ transitionId: selectedTransition, remarks }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const entityRes = await fetch(`${apiBaseUrl}/api/v1/alerts/${id}`, authHeaders());
      if (entityRes.ok) { const d = await entityRes.json(); setAlert(d.alert || d); }
      setSelectedTransition(""); setRemarks("");
      fetchTransitions();
      showToast("success", t("transition.success"));
    } catch (err) { showToast("error", err instanceof Error ? err.message : t("transition.error")); }
    finally { setTransitioning(false); }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || isOffline) return;
    setSubmittingNote(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/alerts/${id}/notes`, {
        ...authHeaders(), method: "POST",
        body: JSON.stringify({ note_text: newNote }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      setNewNote("");
      fetchNotes();
      showToast("success", t("notes.added"));
    } catch { showToast("error", t("common.error")); }
    finally { setSubmittingNote(false); }
  };

  if (loading) return <div className="loading-center">{t("common.loading")}</div>;
  if (error) return <AlertUI variant="error">{error}</AlertUI>;
  if (!alert) return null;

  return (
    <>
      <div className="detail-header">
        <button className="detail-header__back" onClick={onBack} aria-label={t("detail.back")} type="button"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
        <h1>{alert.title}</h1>
        <span className={`badge badge--${alert.priority?.toLowerCase() || "default"}`}>{alert.priority}</span>
        <span className="badge badge--default">{alert.state_id}</span>
      </div>
      <Tabs tabs={[
        { key: "details", label: t("detail.tab_details"), content: (
          <>
            <div className="detail-section">
              <h2 className="detail-section__title">{t("alerts.information")}</h2>
              <div className="detail-grid">
                <div className="detail-field"><span className="detail-field__label">{t("detail.id")}</span><span className="detail-field__value">{alert.alert_id}</span></div>
                <div className="detail-field"><span className="detail-field__label">{t("alerts.type")}</span><span className="detail-field__value">{alert.alert_type}</span></div>
                <div className="detail-field"><span className="detail-field__label">{t("alerts.assigned")}</span><span className="detail-field__value">{alert.assigned_to || "—"}</span></div>
                <div className="detail-field"><span className="detail-field__label">{t("detail.created_at")}</span><span className="detail-field__value">{alert.created_at ? new Date(alert.created_at).toLocaleString() : "—"}</span></div>
              </div>
            </div>
            <div className="detail-section">
              <h2 className="detail-section__title">{t("detail.description")}</h2>
              <p style={{ color: "var(--color-text-muted)" }}>{alert.description || "—"}</p>
            </div>
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
            <div className="detail-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-2)" }}>
                <h3 className="detail-section__title">{t("legal.applicable_statutes")}</h3>
                <Button size="sm" variant="secondary" onClick={handleAutoMapLegal} disabled={isOffline || autoMapping}>
                  {autoMapping ? t("common.loading") : t("legal.auto_map_legal")}
                </Button>
              </div>
              {legalMappings.length === 0 ? (
                <p style={{ color: "var(--color-text-muted)", marginTop: "var(--space-2)" }}>{t("reports.no_legal")}</p>
              ) : (
                <div style={{ display: "grid", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
                  {legalMappings.map((m: any, i: number) => (
                    <div key={m.mapping_id || i} style={{ padding: "var(--space-3)", background: "var(--color-surface-alt)", borderRadius: "var(--radius-md)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-2)" }}>
                        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
                          <Badge variant="info">{m.act_name || m.statute_code} {m.section ? `§${m.section}` : ""}</Badge>
                          {m.rule_code && <Badge variant="default">{m.rule_code}</Badge>}
                          {m.mapping_source && <small style={{ color: "var(--color-text-muted)" }}>{m.mapping_source}</small>}
                        </div>
                        <div style={{ display: "flex", gap: "var(--space-1)", alignItems: "center" }}>
                          {m.reviewer_status && (
                            <Badge variant={m.reviewer_status === "APPROVED" ? "success" : m.reviewer_status === "REJECTED" ? "danger" : "warning"}>
                              {m.reviewer_status === "PENDING" ? t("legal.review_pending") : m.reviewer_status === "APPROVED" ? t("legal.review_approved") : t("legal.review_rejected")}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {m.description && <p style={{ fontSize: "0.875rem", marginTop: "var(--space-1)", color: "var(--color-text-muted)" }}>{m.description}</p>}
                      {(m.confidence_score != null || m.confidence != null) && (
                        <div style={{ marginTop: "var(--space-2)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                            <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{t("legal.confidence")}: {m.confidence_score ?? m.confidence}%</span>
                          </div>
                          <ProgressBar current={Math.round(m.confidence_score ?? m.confidence ?? 0)} total={100} />
                        </div>
                      )}
                      {m.rationale_text && (
                        <p style={{ fontSize: "0.8rem", marginTop: "var(--space-1)", color: "var(--color-text-muted)" }}>
                          <strong>{t("legal.rationale")}:</strong> {m.rationale_text}
                        </p>
                      )}
                      {m.reviewer_status === "PENDING" && m.mapping_id && (
                        <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                          <Button size="sm" variant="primary" onClick={() => handleReviewMapping(m.mapping_id, "APPROVED")}>{t("legal.approve")}</Button>
                          <Button size="sm" variant="danger" onClick={() => handleReviewMapping(m.mapping_id, "REJECTED")}>{t("legal.reject")}</Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="detail-section">
              <h3 className="detail-section__title">{t("translate.title")}</h3>
              <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginBottom: "var(--space-2)" }}>
                <Select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
                  <option value="hi">{t("translate.hindi")}</option>
                  <option value="te">{t("translate.telugu")}</option>
                  <option value="en">{t("translate.english")}</option>
                </Select>
                <Button onClick={() => handleTranslate()} disabled={isOffline || translating} variant="secondary">
                  {translating ? t("common.loading") : t("translate.translate")}
                </Button>
              </div>
              {translatedText && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                  <div>
                    <strong>{t("translate.original")}</strong>
                    <p style={{ marginTop: "var(--space-1)", fontSize: "0.875rem" }}>{alert?.description || ""}</p>
                  </div>
                  <div>
                    <strong>{t("translate.translated")}</strong>
                    <p style={{ marginTop: "var(--space-1)", fontSize: "0.875rem" }}>{translatedText}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="detail-section">
              <h3 className="detail-section__title">{t("escalation.title")}</h3>
              {(alert as any).escalation_level && (
                <p style={{ marginBottom: "var(--space-2)" }}>
                  <span className="badge badge--warning">{t("escalation.level")}: {(alert as any).escalation_level}</span>
                  {(alert as any).escalation_reason && <span style={{ marginLeft: "var(--space-2)", fontSize: "0.875rem", color: "var(--color-text-muted)" }}>{(alert as any).escalation_reason}</span>}
                </p>
              )}
              <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <Field label={t("escalation.reason")} htmlFor="esc-reason">
                    <Input id="esc-reason" value={escalationReason} onChange={(e) => setEscalationReason(e.target.value)} placeholder={t("escalation.reason_placeholder")} />
                  </Field>
                </div>
                <Button onClick={handleEscalate} disabled={!escalationReason.trim() || escalating || isOffline}>
                  {escalating ? t("common.loading") : t("escalation.request")}
                </Button>
              </div>
            </div>
            <div className="detail-section">
              <h3 className="detail-section__title">{t("llm.risk_narrative")}</h3>
              <Button onClick={handleGenerateNarrative} disabled={isOffline || generatingNarrative} variant="secondary">
                {generatingNarrative ? t("llm.generating_narrative") : t("llm.risk_narrative")}
              </Button>
              {riskNarrative && (
                <div style={{ marginTop: "var(--space-2)", padding: "var(--space-3)", background: "var(--color-surface-alt)", borderRadius: "var(--radius-md)" }}>
                  <strong>{t("llm.ai_result")}</strong>
                  <p style={{ marginTop: "var(--space-1)", fontSize: "0.875rem", whiteSpace: "pre-wrap" }}>{riskNarrative}</p>
                  {narrativeProvider && <small style={{ color: "var(--color-text-muted)" }}>{t("llm.powered_by")} {narrativeProvider}</small>}
                </div>
              )}
            </div>
          </>
        )},
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
                    <small style={{ color: "var(--color-text-muted)" }}>{n.created_by} — {new Date(n.created_at).toLocaleString()}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )},
        { key: "activity", label: t("detail.tab_activity"), content: (
          <div className="detail-section">
            {activity.length === 0 ? <EmptyState icon="inbox" title={t("activity.empty")} /> : (
              <ul className="activity-list">
                {activity.map((e) => (
                  <li key={e.event_id} className="activity-list__item">
                    <span className="activity-list__type">{e.event_type}</span>
                    <small style={{ color: "var(--color-text-muted)" }}>{e.actor_id} — {new Date(e.created_at).toLocaleString()}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )},
      ]} />
      {availableTransitions.length > 0 && (
        <div className="transition-bar">
          <h2 className="detail-section__title">{t("transition.title")}</h2>
          <Field label={t("transition.select_action")} htmlFor="transition-select">
            <Select id="transition-select" value={selectedTransition} onChange={(e) => setSelectedTransition(e.target.value)} disabled={isOffline}>
              <option value="">{t("transition.select_placeholder")}</option>
              {availableTransitions.map((tr) => (
                <option key={tr.transitionId} value={tr.transitionId}>{tr.label} → {tr.toStateId}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("transition.remarks")} htmlFor="transition-remarks">
            <Input id="transition-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder={t("transition.remarks_placeholder")} disabled={isOffline} />
          </Field>
          <div className="transition-bar__actions">
            <Button onClick={handleTransition} disabled={!selectedTransition || transitioning || isOffline}>{t(transitioning ? "transition.submitting" : "transition.submit")}</Button>
          </div>
        </div>
      )}
    </>
  );
}
