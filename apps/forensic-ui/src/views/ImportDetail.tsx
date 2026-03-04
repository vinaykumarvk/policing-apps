import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Tabs, Textarea, useToast } from "@puda/shared";
import { apiBaseUrl, ImportJob } from "../types";

type Props = { id: string; authHeaders: () => Record<string, string>; isOffline: boolean; onBack: () => void };

export default function ImportDetail({ id, authHeaders, isOffline, onBack }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [job, setJob] = useState<ImportJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Array<{ note_id: string; note_text: string; created_by: string; created_at: string }>>([]);
  const [activity, setActivity] = useState<Array<{ event_id: string; event_type: string; actor_id: string; created_at: string; payload_jsonb?: any }>>([]);
  const [newNote, setNewNote] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  const fetchNotes = () => {
    fetch(`${apiBaseUrl}/api/v1/imports/${id}/notes`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : { notes: [] })
      .then((data) => setNotes(data.notes || []))
      .catch(() => setNotes([]));
  };

  const fetchActivity = () => {
    fetch(`${apiBaseUrl}/api/v1/imports/${id}/activity`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : { events: [] })
      .then((data) => setActivity(data.events || data.activity || []))
      .catch(() => setActivity([]));
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || isOffline) return;
    setSubmittingNote(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/imports/${id}/notes`, {
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
    fetch(`${apiBaseUrl}/api/v1/imports/${id}`, { headers: authHeaders() })
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => { setJob(data.import || data); fetchNotes(); fetchActivity(); })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load import job"))
      .finally(() => setLoading(false));
  }, [id, authHeaders]);

  if (loading) return <div className="loading-center">{t("common.loading")}</div>;
  if (error) return <Alert variant="error">{error}</Alert>;
  if (!job) return null;

  return (
    <>
      <div className="detail-header">
        <button className="detail-header__back" onClick={onBack} aria-label={t("detail.back")} type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1>{t("imports.job_title")}</h1>
        <span className="badge badge--default">{job.state_id}</span>
      </div>
      <Tabs tabs={[
        { key: "details", label: t("detail.tab_details"), content: (
          <>
            <div className="detail-section">
              <h2 className="detail-section__title">{t("imports.job_information")}</h2>
              <div className="detail-grid">
                <div className="detail-field"><span className="detail-field__label">{t("detail.id")}</span><span className="detail-field__value">{job.import_job_id}</span></div>
                <div className="detail-field"><span className="detail-field__label">{t("imports.job_type")}</span><span className="detail-field__value">{job.job_type}</span></div>
                <div className="detail-field"><span className="detail-field__label">{t("imports.progress")}</span><span className="detail-field__value">{job.progress_pct}%</span></div>
                <div className="detail-field"><span className="detail-field__label">{t("imports.case_id")}</span><span className="detail-field__value">{job.case_id}</span></div>
                <div className="detail-field"><span className="detail-field__label">{t("imports.evidence_id")}</span><span className="detail-field__value">{job.evidence_id}</span></div>
                <div className="detail-field"><span className="detail-field__label">{t("detail.created_at")}</span><span className="detail-field__value">{job.created_at ? new Date(job.created_at).toLocaleString() : "—"}</span></div>
              </div>
            </div>
            {job.error_message && (
              <div className="detail-section">
                <h2 className="detail-section__title">{t("imports.error")}</h2>
                <Alert variant="error">{job.error_message}</Alert>
              </div>
            )}
            {job.warnings && job.warnings.length > 0 && (
              <div className="detail-section">
                <h2 className="detail-section__title">{t("imports.warnings")}</h2>
                <ul>{job.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}
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
    </>
  );
}
