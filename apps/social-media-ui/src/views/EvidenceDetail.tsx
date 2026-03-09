import { useState, useEffect, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, DropZone, Field, Input, Tabs, Textarea, UploadConfirm, useToast } from "@puda/shared";
import { apiBaseUrl, EvidenceItem } from "../types";
import EmptyState from "../components/EmptyState";

const CourtExportWizard = lazy(() => import("./CourtExportWizard"));

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
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [legalHolds, setLegalHolds] = useState<Array<{ hold_id: string; hold_reason: string; legal_reference: string; held_by: string; held_at: string; is_active: boolean }>>([]);
  const [holdReason, setHoldReason] = useState("");
  const [holdRef, setHoldRef] = useState("");
  const [applyingHold, setApplyingHold] = useState(false);
  const [showCourtExport, setShowCourtExport] = useState(false);

  const fetchNotes = () => {
    fetch(`${apiBaseUrl}/api/v1/evidence/${id}/notes`, authHeaders())
      .then((r) => r.ok ? r.json() : { notes: [] })
      .then((data) => setNotes(data.notes || []))
      .catch(() => setNotes([]));
  };

  const fetchLegalHolds = () => {
    fetch(`${apiBaseUrl}/api/v1/evidence/${id}/legal-holds`, authHeaders())
      .then((r) => r.ok ? r.json() : { holds: [] })
      .then((data) => setLegalHolds(data.holds || []))
      .catch(() => setLegalHolds([]));
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/evidence/${id}/verify`, { ...authHeaders(), method: "POST" });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      setVerifyResult(data.result || data.hash_verification_result || "UNKNOWN");
      const entityRes = await fetch(`${apiBaseUrl}/api/v1/evidence/${id}`, authHeaders());
      if (entityRes.ok) { const d = await entityRes.json(); setEvidence(d.evidence || d); }
      showToast("success", t("evidence.verify_complete"));
    } catch { showToast("error", t("common.error")); }
    finally { setVerifying(false); }
  };

  const handleApplyHold = async () => {
    if (!holdReason.trim()) return;
    setApplyingHold(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/evidence/${id}/legal-hold`, {
        ...authHeaders(), method: "POST",
        body: JSON.stringify({ hold_reason: holdReason, legal_reference: holdRef }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      setHoldReason(""); setHoldRef("");
      fetchLegalHolds();
      showToast("success", t("evidence.hold_applied"));
    } catch { showToast("error", t("common.error")); }
    finally { setApplyingHold(false); }
  };

  const handleReleaseHold = async (holdId: string) => {
    try {
      await fetch(`${apiBaseUrl}/api/v1/evidence/${id}/legal-hold/${holdId}/release`, { ...authHeaders(), method: "POST" });
      fetchLegalHolds();
      showToast("success", t("evidence.hold_released"));
    } catch { showToast("error", t("common.error")); }
  };

  const fetchActivity = () => {
    fetch(`${apiBaseUrl}/api/v1/evidence/${id}/activity`, authHeaders())
      .then((r) => r.ok ? r.json() : { events: [] })
      .then((data) => setActivity(data.events || data.activity || []))
      .catch(() => setActivity([]));
  };

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/v1/evidence/${id}`, authHeaders())
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => { setEvidence(data.evidence || data); fetchNotes(); fetchActivity(); fetchLegalHolds(); })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  }, [id, authHeaders]);

  const handleAddNote = async () => {
    if (!newNote.trim() || isOffline) return;
    setSubmittingNote(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/evidence/${id}/notes`, {
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

  const handleRunOcr = async () => {
    setOcrLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/ocr/submit`, {
        ...authHeaders(),
        method: "POST",
        body: JSON.stringify({ evidence_id: id }),
      });
      const data = await res.json();
      setOcrJobId(data.job_id);
      const pollInterval = setInterval(async () => {
        const pollRes = await fetch(`${apiBaseUrl}/api/v1/ocr/${data.job_id}`, authHeaders());
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
      const res = await fetch(`${apiBaseUrl}/api/v1/evidence/${id}/upload`, {
        method: "POST", credentials: "include", body: formData,
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      setUploadProgress(100);
      setPendingFile(null);
      showToast("success", t("evidence.upload_success"));
      const entityRes = await fetch(`${apiBaseUrl}/api/v1/evidence/${id}`, authHeaders());
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
                <div className="detail-field"><span className="detail-field__label">{t("evidence.hash_algorithm")}</span><span className="detail-field__value">{(evidence as any).hash_algorithm || "SHA-256"}</span></div>
                {(evidence as any).is_original === false && (
                  <div className="detail-field"><span className="detail-field__label">{t("evidence.original")}</span><span className="badge badge--warning">{t("evidence.derivative_copy")}</span></div>
                )}
              </div>
            </div>
            <div className="detail-section">
              <h3 className="detail-section__title">{t("evidence.verify_integrity")}</h3>
              <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                <Button onClick={handleVerify} disabled={isOffline || verifying} variant="secondary">
                  {verifying ? t("common.loading") : t("evidence.verify_hash")}
                </Button>
                {(verifyResult || (evidence as any).hash_verification_result) && (
                  <span className={`badge badge--${(verifyResult || (evidence as any).hash_verification_result) === "MATCH" ? "success" : "danger"}`}>
                    {verifyResult || (evidence as any).hash_verification_result}
                  </span>
                )}
              </div>
            </div>
            <div className="detail-section">
              <h3 className="detail-section__title">{t("evidence.legal_holds")}</h3>
              {legalHolds.length > 0 && (
                <div className="table-scroll">
                <table className="entity-table" style={{ marginBottom: "var(--space-3)" }}>
                  <thead><tr><th>{t("evidence.hold_reason")}</th><th>{t("evidence.legal_ref")}</th><th>{t("alerts.status")}</th><th>{t("models.actions")}</th></tr></thead>
                  <tbody>
                    {legalHolds.map((h) => (
                      <tr key={h.hold_id}>
                        <td data-label={t("evidence.hold_reason")}>{h.hold_reason}</td>
                        <td data-label={t("evidence.legal_ref")}>{h.legal_reference || "—"}</td>
                        <td data-label={t("alerts.status")}><span className={`badge badge--${h.is_active ? "warning" : "default"}`}>{h.is_active ? t("evidence.hold_active") : t("evidence.hold_released")}</span></td>
                        <td data-label={t("models.actions")}>{h.is_active && <Button size="sm" variant="secondary" onClick={() => handleReleaseHold(h.hold_id)} disabled={isOffline}>{t("evidence.release_hold")}</Button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
              <div style={{ display: "grid", gap: "var(--space-2)" }}>
                <Field label={t("evidence.hold_reason")} htmlFor="hold-reason">
                  <Input id="hold-reason" value={holdReason} onChange={(e) => setHoldReason(e.target.value)} placeholder={t("evidence.hold_reason_placeholder")} />
                </Field>
                <Field label={t("evidence.legal_ref")} htmlFor="hold-ref">
                  <Input id="hold-ref" value={holdRef} onChange={(e) => setHoldRef(e.target.value)} placeholder={t("evidence.legal_ref_placeholder")} />
                </Field>
                <Button size="sm" onClick={handleApplyHold} disabled={!holdReason.trim() || applyingHold || isOffline}>{t("evidence.apply_hold")}</Button>
              </div>
            </div>
            <div className="detail-section">
              <h3 className="detail-section__title">{t("osint.court_export")}</h3>
              <Button onClick={() => setShowCourtExport(true)} disabled={isOffline} variant="secondary">{t("osint.download_package")}</Button>
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
      <Suspense fallback={null}>
        <CourtExportWizard open={showCourtExport} evidenceId={id} onClose={() => setShowCourtExport(false)} authHeaders={authHeaders} isOffline={isOffline} />
      </Suspense>
    </>
  );
}
