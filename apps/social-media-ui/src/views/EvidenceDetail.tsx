import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, DropZone, Tabs, Textarea, UploadConfirm, useToast } from "@puda/shared";
import { apiBaseUrl, EvidenceItem } from "../types";

type Props = { id: string; authHeaders: () => Record<string, string>; isOffline: boolean; onBack: () => void };

export default function EvidenceDetail({ id, authHeaders, isOffline, onBack }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [evidence, setEvidence] = useState<EvidenceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Array<{ note_id: string; note_text: string; created_by: string; created_at: string }>>([]);
  const [activity, setActivity] = useState<Array<{ event_id: string; event_type: string; actor_id: string; created_at: string; payload_jsonb?: any }>>([]);
  const [newNote, setNewNote] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [ocrJobId, setOcrJobId] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  const fetchNotes = () => {
    fetch(`${apiBaseUrl}/api/v1/evidence/${id}/notes`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : { notes: [] })
      .then((data) => setNotes(data.notes || []))
      .catch(() => setNotes([]));
  };

  const fetchActivity = () => {
    fetch(`${apiBaseUrl}/api/v1/evidence/${id}/activity`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : { events: [] })
      .then((data) => setActivity(data.events || data.activity || []))
      .catch(() => setActivity([]));
  };

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/v1/evidence/${id}`, { headers: authHeaders() })
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => { setEvidence(data.evidence || data); fetchNotes(); fetchActivity(); })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  }, [id, authHeaders]);

  const handleAddNote = async () => {
    if (!newNote.trim() || isOffline) return;
    setSubmittingNote(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/evidence/${id}/notes`, {
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

  const handleRunOcr = async () => {
    setOcrLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/ocr/submit`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ evidence_id: id }),
      });
      const data = await res.json();
      setOcrJobId(data.job_id);
      const pollInterval = setInterval(async () => {
        const pollRes = await fetch(`${apiBaseUrl}/api/v1/ocr/${data.job_id}`, { headers: authHeaders() });
        const pollData = await pollRes.json();
        if (pollData.status === "COMPLETED") {
          setOcrResult(pollData.extracted_text);
          setOcrLoading(false);
          clearInterval(pollInterval);
        } else if (pollData.status === "FAILED") {
          setOcrLoading(false);
          clearInterval(pollInterval);
          showToast("error", t("ocr.failed"));
        }
      }, 2000);
    } catch {
      setOcrLoading(false);
      showToast("error", t("common.error"));
    }
  };

  const handleUploadConfirm = async () => {
    if (!pendingFile || isOffline) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", pendingFile);
      const hdrs = authHeaders();
      delete hdrs["Content-Type"];
      const res = await fetch(`${apiBaseUrl}/api/v1/evidence/${id}/upload`, {
        method: "POST", headers: hdrs, body: formData,
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      setUploadProgress(100);
      setPendingFile(null);
      showToast("success", t("evidence.upload_success"));
      const entityRes = await fetch(`${apiBaseUrl}/api/v1/evidence/${id}`, { headers: authHeaders() });
      if (entityRes.ok) { const d = await entityRes.json(); setEvidence(d.evidence || d); }
    } catch { showToast("error", t("common.error")); }
    finally { setUploading(false); setUploadProgress(0); }
  };

  if (loading) return <div className="loading-center">{t("common.loading")}</div>;
  if (error) return <Alert variant="error">{error}</Alert>;
  if (!evidence) return null;

  return (
    <>
      <div className="detail-header">
        <button className="detail-header__back" onClick={onBack} aria-label={t("detail.back")} type="button"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
        <h1>{t("evidence.title")}</h1>
        <span className="badge badge--default">{evidence.state_id}</span>
      </div>
      <Tabs tabs={[
        { key: "details", label: t("detail.tab_details"), content: (
          <>
            <div className="detail-section">
              <h2 className="detail-section__title">{t("evidence.information")}</h2>
              <div className="detail-grid">
                <div className="detail-field"><span className="detail-field__label">{t("detail.id")}</span><span className="detail-field__value">{evidence.evidence_id}</span></div>
                <div className="detail-field"><span className="detail-field__label">{t("evidence.capture_type")}</span><span className="detail-field__value">{evidence.capture_type}</span></div>
                <div className="detail-field"><span className="detail-field__label">{t("evidence.hash")}</span><span className="detail-field__value" style={{ wordBreak: "break-all" }}>{evidence.hash_sha256 || "—"}</span></div>
                <div className="detail-field"><span className="detail-field__label">{t("evidence.captured_by")}</span><span className="detail-field__value">{evidence.captured_by}</span></div>
                <div className="detail-field"><span className="detail-field__label">{t("detail.created_at")}</span><span className="detail-field__value">{evidence.created_at ? new Date(evidence.created_at).toLocaleString() : "—"}</span></div>
              </div>
            </div>
            <div className="detail-section">
              <h2 className="detail-section__title">{t("evidence.upload_file")}</h2>
              {pendingFile ? (
                <UploadConfirm file={pendingFile} onConfirm={handleUploadConfirm} onCancel={() => setPendingFile(null)} uploading={uploading} progress={uploadProgress} />
              ) : (
                <DropZone onFileSelected={(file) => setPendingFile(file)} disabled={isOffline} />
              )}
            </div>
            <div className="detail-section">
              <h3 className="detail-section__title">{t("ocr.title")}</h3>
              {ocrResult ? (
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: "0.875rem", background: "var(--color-surface-alt)", padding: "var(--space-3)", borderRadius: "var(--radius-md)" }}>
                  {ocrResult}
                </pre>
              ) : (
                <Button onClick={handleRunOcr} disabled={isOffline || ocrLoading}>
                  {ocrLoading ? t("ocr.processing") : t("ocr.run")}
                </Button>
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
    </>
  );
}
