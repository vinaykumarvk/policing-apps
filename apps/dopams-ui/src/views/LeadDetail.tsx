import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Badge, Button, Field, Input, ProgressBar, Select, Tabs, Textarea, useToast } from "@puda/shared";
import { apiBaseUrl, Lead } from "../types";

type Props = {
  id: string;
  authHeaders: () => Record<string, string>;
  isOffline: boolean;
  onBack: () => void;
};

export default function LeadDetail({ id, authHeaders, isOffline, onBack }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTransition, setSelectedTransition] = useState("");
  const [remarks, setRemarks] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const [availableTransitions, setAvailableTransitions] = useState<Array<{ transitionId: string; toStateId: string; label: string }>>([]);
  const [notes, setNotes] = useState<Array<{ note_id: string; note_text: string; created_by: string; created_at: string }>>([]);
  const [activity, setActivity] = useState<Array<{ event_id: string; event_type: string; actor_id: string; created_at: string; payload_jsonb?: any }>>([]);
  const [newNote, setNewNote] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [classification, setClassification] = useState<any>(null);
  const [classifyLoading, setClassifyLoading] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState("hi");
  const [translating, setTranslating] = useState(false);

  const fetchTransitions = () => {
    fetch(`${apiBaseUrl}/api/v1/leads/${id}/transitions`, authHeaders())
      .then((r) => r.ok ? r.json() : { transitions: [] })
      .then((data) => setAvailableTransitions(data.transitions || []))
      .catch(() => setAvailableTransitions([]));
  };

  const fetchNotes = () => {
    fetch(`${apiBaseUrl}/api/v1/leads/${id}/notes`, authHeaders())
      .then((r) => r.ok ? r.json() : { notes: [] })
      .then((data) => setNotes(data.notes || []))
      .catch(() => setNotes([]));
  };
  const fetchActivity = () => {
    fetch(`${apiBaseUrl}/api/v1/leads/${id}/activity`, authHeaders())
      .then((r) => r.ok ? r.json() : { events: [] })
      .then((data) => setActivity(data.events || data.activity || []))
      .catch(() => setActivity([]));
  };
  const handleAddNote = async () => {
    if (!newNote.trim() || isOffline) return;
    setSubmittingNote(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/leads/${id}/notes`, {
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

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/v1/leads/${id}`, authHeaders())
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => { setLead(data.lead || data); fetchTransitions(); fetchNotes(); fetchActivity(); })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load lead"))
      .finally(() => setLoading(false));
  }, [id, authHeaders]);

  useEffect(() => {
    if (!id) return;
    fetch(`${apiBaseUrl}/api/v1/classify/lead/${id}`, authHeaders())
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setClassification(data); })
      .catch(() => {});
  }, [id]);

  const handleClassify = async () => {
    setClassifyLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/classify/lead/${id}`, {
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

  const handleTranslate = async (sourceText: string) => {
    setTranslating(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/translate`, {
        ...authHeaders(),
        method: "POST",
        body: JSON.stringify({ text: sourceText, target_language: targetLang }),
      });
      if (res.ok) {
        const data = await res.json();
        setTranslatedText(data.translated_text);
      }
    } catch { /* silent */ }
    setTranslating(false);
  };

  const handleTransition = async () => {
    if (!selectedTransition || isOffline) return;
    setTransitioning(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/leads/${id}/transition`, {
        ...authHeaders(),
        method: "POST",
        body: JSON.stringify({ transitionId: selectedTransition, remarks }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const entityRes = await fetch(`${apiBaseUrl}/api/v1/leads/${id}`, authHeaders());
      if (entityRes.ok) { const d = await entityRes.json(); setLead(d.lead || d); }
      setSelectedTransition("");
      setRemarks("");
      fetchTransitions();
      showToast("success", t("transition.success"));
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : t("transition.error"));
    } finally {
      setTransitioning(false);
    }
  };

  if (loading) return <div className="loading-center">{t("common.loading")}</div>;
  if (error) return <Alert variant="error">{error}</Alert>;
  if (!lead) return null;

  return (
    <>
      <div className="detail-header">
        <button className="detail-header__back" onClick={onBack} aria-label={t("detail.back")} type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1>{lead.summary}</h1>
        <span className={`badge badge--${lead.priority?.toLowerCase() || "default"}`}>{lead.priority}</span>
        <span className="badge badge--default">{lead.state_id}</span>
      </div>

      <Tabs tabs={[
        { key: "details", label: t("detail.tab_details"), content: (
          <>
            <div className="detail-section">
              <h2 className="detail-section__title">{t("lead.information_title")}</h2>
              <div className="detail-grid">
                <div className="detail-field">
                  <span className="detail-field__label">{t("detail.id")}</span>
                  <span className="detail-field__value">{lead.lead_id}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-field__label">{t("leads.source")}</span>
                  <span className="detail-field__value">{lead.source_type}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-field__label">{t("leads.priority")}</span>
                  <span className="detail-field__value">{lead.priority}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-field__label">{t("leads.assigned")}</span>
                  <span className="detail-field__value">{lead.assigned_to || "—"}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-field__label">{t("detail.created_at")}</span>
                  <span className="detail-field__value">{lead.created_at ? new Date(lead.created_at).toLocaleString() : "—"}</span>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h2 className="detail-section__title">{t("lead.details_title")}</h2>
              <p style={{ color: "var(--color-text-muted)" }}>{lead.details || "—"}</p>
            </div>
            <div className="detail-section">
              <h3 className="detail-section__title">{t("classify.risk_score")}</h3>
              {classification ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                    <Badge variant={classification.risk_score >= 0.7 ? "danger" : classification.risk_score >= 0.4 ? "warning" : "success"}>
                      {classification.category || t("classify.uncategorized")}
                    </Badge>
                    <span style={{ fontWeight: 600 }}>{Math.round((classification.risk_score || 0) * 100)}%</span>
                  </div>
                  <ProgressBar current={Math.round((classification.risk_score || 0) * 100)} total={100} />
                  {classification.factors && classification.factors.length > 0 && (
                    <ul style={{ marginTop: "var(--space-2)", paddingLeft: "var(--space-4)", fontSize: "0.875rem" }}>
                      {classification.factors.map((f: string, i: number) => <li key={i}>{f}</li>)}
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
              <h3 className="detail-section__title">{t("translate.title")}</h3>
              <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginBottom: "var(--space-2)" }}>
                <Select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
                  <option value="hi">{t("languages.hindi")}</option>
                  <option value="te">{t("languages.telugu")}</option>
                  <option value="en">{t("languages.english")}</option>
                </Select>
                <Button onClick={() => handleTranslate(lead?.details || lead?.summary || "")} disabled={isOffline || translating} variant="secondary">
                  {translating ? t("common.loading") : t("translate.translate")}
                </Button>
              </div>
              {translatedText && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                  <div>
                    <strong>{t("translate.original")}</strong>
                    <p style={{ marginTop: "var(--space-1)", fontSize: "0.875rem" }}>{lead?.details || lead?.summary || ""}</p>
                  </div>
                  <div>
                    <strong>{t("translate.translated")}</strong>
                    <p style={{ marginTop: "var(--space-1)", fontSize: "0.875rem" }}>{translatedText}</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )},
        { key: "notes", label: t("detail.tab_notes"), content: (
          <div className="detail-section">
            <div style={{ marginBottom: "var(--space-4)" }}>
              <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder={t("notes.placeholder")} disabled={isOffline} />
              <Button size="sm" onClick={handleAddNote} disabled={!newNote.trim() || submittingNote || isOffline} style={{ marginTop: "var(--space-2)" }}>
                {t("notes.add")}
              </Button>
            </div>
            {notes.length === 0 ? <p style={{ color: "var(--color-text-muted)" }}>{t("notes.empty")}</p> : (
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
            {activity.length === 0 ? <p style={{ color: "var(--color-text-muted)" }}>{t("activity.empty")}</p> : (
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
            <Button onClick={handleTransition} disabled={!selectedTransition || transitioning || isOffline}>
              {t(transitioning ? "transition.submitting" : "transition.submit")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
