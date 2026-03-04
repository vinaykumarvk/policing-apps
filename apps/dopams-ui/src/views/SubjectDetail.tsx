import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Field, Input, MaskedField, Select, Tabs, Textarea, useToast } from "@puda/shared";
import { apiBaseUrl, SubjectProfile } from "../types";

type Props = {
  id: string;
  authHeaders: () => Record<string, string>;
  isOffline: boolean;
  onBack: () => void;
};

export default function SubjectDetail({ id, authHeaders, isOffline, onBack }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [subject, setSubject] = useState<SubjectProfile | null>(null);
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

  const fetchTransitions = () => {
    fetch(`${apiBaseUrl}/api/v1/subjects/${id}/transitions`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : { transitions: [] })
      .then((data) => setAvailableTransitions(data.transitions || []))
      .catch(() => setAvailableTransitions([]));
  };

  const fetchNotes = () => {
    fetch(`${apiBaseUrl}/api/v1/subjects/${id}/notes`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : { notes: [] })
      .then((data) => setNotes(data.notes || []))
      .catch(() => setNotes([]));
  };
  const fetchActivity = () => {
    fetch(`${apiBaseUrl}/api/v1/subjects/${id}/activity`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : { events: [] })
      .then((data) => setActivity(data.events || data.activity || []))
      .catch(() => setActivity([]));
  };
  const handleAddNote = async () => {
    if (!newNote.trim() || isOffline) return;
    setSubmittingNote(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/subjects/${id}/notes`, {
        method: "POST", headers: authHeaders(),
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
    fetch(`${apiBaseUrl}/api/v1/subjects/${id}`, { headers: authHeaders() })
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => { setSubject(data.subject || data); fetchTransitions(); fetchNotes(); fetchActivity(); })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load subject"))
      .finally(() => setLoading(false));
  }, [id, authHeaders]);

  const handleTransition = async () => {
    if (!selectedTransition || isOffline) return;
    setTransitioning(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/subjects/${id}/transition`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ transitionId: selectedTransition, remarks }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const entityRes = await fetch(`${apiBaseUrl}/api/v1/subjects/${id}`, { headers: authHeaders() });
      if (entityRes.ok) { const d = await entityRes.json(); setSubject(d.subject || d); }
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
  if (!subject) return null;

  return (
    <>
      <div className="detail-header">
        <button className="detail-header__back" onClick={onBack} aria-label={t("detail.back")} type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1>{subject.full_name}</h1>
        <span className={`badge badge--${subject.risk_score >= 7 ? "critical" : subject.risk_score >= 4 ? "warning" : "low"}`}>
          Risk: {subject.risk_score}
        </span>
        <span className="badge badge--default">{subject.state_id}</span>
      </div>

      <Tabs tabs={[
        { key: "details", label: t("detail.tab_details"), content: (
          <>
            <div className="detail-section">
              <h2 className="detail-section__title">{t("subject.personal_info")}</h2>
              <div className="detail-grid">
                <div className="detail-field">
                  <span className="detail-field__label">{t("detail.id")}</span>
                  <span className="detail-field__value">{subject.subject_id}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-field__label">{t("subjects.name")}</span>
                  <span className="detail-field__value">{subject.full_name}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-field__label">{t("subjects.gender")}</span>
                  <span className="detail-field__value">{subject.gender || "—"}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-field__label">{t("subjects.dob")}</span>
                  <span className="detail-field__value">{subject.date_of_birth || "—"}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-field__label">{t("subjects.risk_score")}</span>
                  <span className="detail-field__value">{subject.risk_score}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-field__label">{t("detail.created_at")}</span>
                  <span className="detail-field__value">{subject.created_at ? new Date(subject.created_at).toLocaleString() : "—"}</span>
                </div>
              </div>
            </div>

            {Array.isArray(subject.aliases) && subject.aliases.length > 0 && (
              <div className="detail-section">
                <h2 className="detail-section__title">{t("subjects.aliases")}</h2>
                <ul>
                  {subject.aliases.map((alias, i) => <li key={i}>{alias}</li>)}
                </ul>
              </div>
            )}

            {subject.identifiers && Object.keys(subject.identifiers).length > 0 && (
              <div className="detail-section">
                <h2 className="detail-section__title">{t("subject.identifiers")}</h2>
                <div className="detail-grid">
                  {Object.entries(subject.identifiers).map(([key, val]) => {
                    const isPii = /aadhaar|pan/i.test(key);
                    return isPii ? (
                      <MaskedField key={key} label={key} value={String(val)} />
                    ) : (
                      <div className="detail-field" key={key}>
                        <span className="detail-field__label">{key}</span>
                        <span className="detail-field__value">{val}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {Array.isArray(subject.addresses) && subject.addresses.length > 0 && (
              <div className="detail-section">
                <h2 className="detail-section__title">{t("subject.addresses")}</h2>
                <ul>
                  {subject.addresses.map((addr, i) => <li key={i}>{addr}</li>)}
                </ul>
              </div>
            )}
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
