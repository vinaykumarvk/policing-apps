import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Field, Input, Select, Tabs, Textarea, useToast } from "@puda/shared";
import { apiBaseUrl, AIFinding } from "../types";

type Props = { id: string; authHeaders: () => RequestInit; isOffline: boolean; onBack: () => void };

export default function FindingDetail({ id, authHeaders, isOffline, onBack }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [finding, setFinding] = useState<AIFinding | null>(null);
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
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState("hi");
  const [translating, setTranslating] = useState(false);

  const fetchTransitions = () => {
    fetch(`${apiBaseUrl}/api/v1/findings/${id}/transitions`, authHeaders())
      .then((r) => r.ok ? r.json() : { transitions: [] })
      .then((data) => setAvailableTransitions(data.transitions || []))
      .catch(() => setAvailableTransitions([]));
  };

  const fetchNotes = () => {
    fetch(`${apiBaseUrl}/api/v1/findings/${id}/notes`, authHeaders())
      .then((r) => r.ok ? r.json() : { notes: [] })
      .then((data) => setNotes(data.notes || []))
      .catch(() => setNotes([]));
  };

  const fetchActivity = () => {
    fetch(`${apiBaseUrl}/api/v1/findings/${id}/activity`, authHeaders())
      .then((r) => r.ok ? r.json() : { events: [] })
      .then((data) => setActivity(data.events || data.activity || []))
      .catch(() => setActivity([]));
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || isOffline) return;
    setSubmittingNote(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/findings/${id}/notes`, {
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
    fetch(`${apiBaseUrl}/api/v1/findings/${id}`, authHeaders())
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => { setFinding(data.finding || data); fetchTransitions(); fetchNotes(); fetchActivity(); })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load finding"))
      .finally(() => setLoading(false));
  }, [id, authHeaders]);

  const handleTranslate = async (sourceText: string) => {
    setTranslating(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/translate`, {
        ...authHeaders(), method: "POST",
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
      const res = await fetch(`${apiBaseUrl}/api/v1/findings/${id}/transition`, {
        ...authHeaders(), method: "POST", body: JSON.stringify({ transitionId: selectedTransition, remarks }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const entityRes = await fetch(`${apiBaseUrl}/api/v1/findings/${id}`, authHeaders());
      if (entityRes.ok) { const d = await entityRes.json(); setFinding(d.finding || d); }
      setSelectedTransition(""); setRemarks("");
      fetchTransitions();
      showToast("success", t("transition.success"));
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : t("transition.error"));
    } finally { setTransitioning(false); }
  };

  if (loading) return <div className="loading-center">{t("common.loading")}</div>;
  if (error) return <Alert variant="error">{error}</Alert>;
  if (!finding) return null;

  return (
    <>
      <div className="detail-header">
        <button className="detail-header__back" onClick={onBack} aria-label={t("detail.back")} type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1>{finding.title}</h1>
        <span className={`badge badge--${finding.severity?.toLowerCase() || "default"}`}>{finding.severity}</span>
        <span className="badge badge--default">{finding.state_id}</span>
      </div>
      <Tabs tabs={[
        { key: "details", label: t("detail.tab_details"), content: (
          <>
            <div className="detail-section">
              <h2 className="detail-section__title">{t("findings.title")}</h2>
              <div className="detail-grid">
                <div className="detail-field"><span className="detail-field__label">{t("detail.id")}</span><span className="detail-field__value">{finding.finding_id}</span></div>
                <div className="detail-field"><span className="detail-field__label">{t("findings.type")}</span><span className="detail-field__value">{finding.finding_type}</span></div>
                <div className="detail-field"><span className="detail-field__label">{t("findings.confidence")}</span><span className="detail-field__value">{(finding.confidence * 100).toFixed(0)}%</span></div>
                <div className="detail-field"><span className="detail-field__label">{t("findings.reviewed_by")}</span><span className="detail-field__value">{finding.reviewed_by || "—"}</span></div>
              </div>
            </div>
            <div className="detail-section">
              <h2 className="detail-section__title">{t("detail.description")}</h2>
              <p style={{ color: "var(--color-text-muted)" }}>{finding.description || "—"}</p>
            </div>
            {finding.evidence_refs && finding.evidence_refs.length > 0 && (
              <div className="detail-section">
                <h2 className="detail-section__title">{t("findings.evidence_refs")}</h2>
                <ul>{finding.evidence_refs.map((ref, i) => <li key={i}>{ref}</li>)}</ul>
              </div>
            )}
            <div className="detail-section">
              <h3 className="detail-section__title">{t("translate.title")}</h3>
              <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginBottom: "var(--space-2)" }}>
                <Select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
                  <option value="hi">{t("translate.lang_hindi")}</option>
                  <option value="te">{t("translate.lang_telugu")}</option>
                  <option value="en">{t("translate.lang_english")}</option>
                </Select>
                <Button onClick={() => handleTranslate(finding?.description || finding?.title || "")} disabled={isOffline || translating} variant="secondary">
                  {translating ? t("common.loading") : t("translate.translate")}
                </Button>
              </div>
              {translatedText && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                  <div>
                    <strong>{t("translate.original")}</strong>
                    <p style={{ marginTop: "var(--space-1)", fontSize: "0.875rem" }}>{finding?.description || finding?.title || ""}</p>
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
            <div className="notes-form" style={{ marginBottom: "var(--space-4)" }}>
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
            <Button onClick={handleTransition} disabled={!selectedTransition || transitioning || isOffline}>{t(transitioning ? "transition.submitting" : "transition.submit")}</Button>
          </div>
        </div>
      )}
    </>
  );
}
