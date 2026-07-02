import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Card, Field, Input, Modal, Select, Textarea } from "@puda/shared";
import { Bilingual } from "./Bilingual";
import { Task, Application, Inspection, apiBaseUrl } from "./types";

// Field label map for structured data display
const FIELD_LABELS: Record<string, string> = {
  full_name: "Full Name", father_name: "Father's Name", date_of_birth: "Date of Birth",
  email: "Email", mobile: "Mobile", aadhaar: "Aadhaar", pan: "PAN",
  salutation: "Salutation", gender: "Gender", marital_status: "Marital Status", remark: "Remark",
  upn: "Unique Property Number", area_sqyd: "Area (sq. yd.)", plot_no: "Plot No.",
  type: "Property Type", scheme_name: "Scheme Name", authority_name: "Authority",
  plan_sanction_date: "Plan Sanction Date", floors_constructed: "Floors Constructed",
  basement_constructed: "Basement Constructed", basement_area_sqft: "Basement Area (sq. ft.)",
  ground_floor_area_sqft: "Ground Floor Area (sq. ft.)", first_floor_area_sqft: "First Floor Area (sq. ft.)",
  second_floor_area_sqft: "Second Floor Area (sq. ft.)", mumty_constructed: "Mumty Constructed",
  mumty_area_sqft: "Mumty Area (sq. ft.)", estimated_cost: "Estimated Cost",
  purpose: "Purpose", service_pipe_length_ft: "Service Pipe Length (ft.)",
  service_pipe_size: "Service Pipe Size", number_of_taps: "Number of Taps",
  tap_size: "Tap Size", ferrule_cock_size: "Ferrule Cock Size",
  status: "Status", number_of_seats: "Number of Seats",
  hot_water_fitting_material: "Hot Water Fitting Material",
  installation_bill_no: "Installation Bill No.", name: "Name",
  license_no: "License No.", address: "Address", certificate_date: "Certificate Date",
  certificate_number: "Certificate Number", valid_from: "Valid From", valid_till: "Valid Till",
  line1: "Address Line 1", line2: "Address Line 2", city: "City",
  state: "State", district: "District", pincode: "Pincode",
  same_as_permanent: "Same as Permanent", payment_details_updated: "Payment Details Updated",
  authority_id: "Authority ID", permanent: "Permanent Address", communication: "Communication Address",
};

function humanizeKey(key: string): string {
  return FIELD_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatValue(v: any): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function renderStructuredData(data: any): JSX.Element {
  if (!data || typeof data !== "object") return <p>{String(data ?? "—")}</p>;
  return (
    <div className="structured-data">
      {Object.entries(data).map(([sectionKey, sectionValue]) => {
        if (sectionValue && typeof sectionValue === "object" && !Array.isArray(sectionValue)) {
          return (
            <div key={sectionKey} className="data-section">
              <h3 className="data-section-title">
                {humanizeKey(sectionKey)}
              </h3>
              <table className="data-table">
                <tbody>
                  {Object.entries(sectionValue as Record<string, any>).map(([k, v]) => {
                    if (v && typeof v === "object" && !Array.isArray(v)) {
                      return (
                        <tr key={k}>
                          <td colSpan={2} className="data-table-group-cell">
                            <strong className="data-table-group-title">{humanizeKey(k)}</strong>
                            <table className="data-table data-table--nested">
                              <tbody>
                                {Object.entries(v as Record<string, any>).map(([sk, sv]) => (
                                  <tr key={sk}>
                                    <td className="data-table-key data-table-key--nested">{humanizeKey(sk)}</td>
                                    <td className="data-table-value data-table-value--nested">{formatValue(sv)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={k}>
                        <td className="data-table-key">{humanizeKey(k)}</td>
                        <td className="data-table-value">{formatValue(v)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        }
        return (
          <div key={sectionKey} className="data-inline-row">
            <strong className="data-inline-key">{humanizeKey(sectionKey)}:</strong> {formatValue(sectionValue)}
          </div>
        );
      })}
    </div>
  );
}

interface TaskDetailProps {
  task: Task;
  application: Application;
  serviceConfig: any;
  officerUserId: string;
  authHeaders: () => RequestInit;
  isOffline: boolean;
  fromSearch: boolean;
  onBack: () => void;
  onActionComplete: (feedback?: { variant: "info" | "success" | "warning" | "error"; text: string }) => void;
  onApplicationUpdate?: (updater: (prev: Application) => Application) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export default function TaskDetail({
  task,
  application,
  serviceConfig,
  officerUserId,
  authHeaders,
  isOffline,
  fromSearch,
  onBack,
  onActionComplete,
  onApplicationUpdate,
  onDirtyChange,
}: TaskDetailProps) {
  const { t } = useTranslation();

  const [feedback, setFeedback] = useState<{ variant: "info" | "success" | "warning" | "error"; text: string } | null>(null);
  const [action, setAction] = useState<"FORWARD" | "QUERY" | "APPROVE" | "REJECT" | null>(null);
  const [remarks, setRemarks] = useState("");
  const [queryMessage, setQueryMessage] = useState("");
  const [unlockedFields, setUnlockedFields] = useState<string[]>([]);
  const [unlockedDocuments, setUnlockedDocuments] = useState<string[]>([]);
  const [verificationChecklist, setVerificationChecklist] = useState<Record<string, boolean>>({});
  const [verificationRemarks, setVerificationRemarks] = useState("");
  const [checklistItems, setChecklistItems] = useState<Array<{ key: string; label: string; required?: boolean }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Per-document verification state
  const [docVerifications, setDocVerifications] = useState<Record<string, { status: string; remarks: string }>>({});
  const [docVerifyLoading, setDocVerifyLoading] = useState<string | null>(null);
  const [docVerifyFeedback, setDocVerifyFeedback] = useState<{ docId: string; variant: "success" | "error"; text: string } | null>(null);

  // Inspection state
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [inspectionLoading, setInspectionLoading] = useState(false);
  const [inspectionOutcome, setInspectionOutcome] = useState("");
  const [inspectionRemarks, setInspectionRemarks] = useState("");
  const [inspectionFindings, setInspectionFindings] = useState("");

  // Reason code state (O2)
  const [reasonCode, setReasonCode] = useState("");

  // Internal notes state (O5)
  const [internalNotes, setInternalNotes] = useState<Array<{ id: string; text: string; created_at: string; officer_id: string }>>([]);
  const [newNote, setNewNote] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);

  // Batch doc verification state (O6)
  const [batchVerifyLoading, setBatchVerifyLoading] = useState(false);

  // Document preview state
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewMimeType, setPreviewMimeType] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    setConfirmOpen(false);
    setFeedback(null);
    setError(null);
    setReasonCode("");
  }, [action]);

  useEffect(() => {
    if (!serviceConfig || !application) {
      setChecklistItems([]);
      setVerificationChecklist({});
      setVerificationRemarks("");
      return;
    }
    const currentState = serviceConfig.workflow?.states?.find((s: any) => s.stateId === application.state_id);
    const checklist = currentState?.taskUi?.checklist || [];
    setChecklistItems(checklist);
    const nextChecklist: Record<string, boolean> = {};
    checklist.forEach((item: any) => { nextChecklist[item.key] = false; });
    setVerificationChecklist(nextChecklist);
    setVerificationRemarks("");
  }, [serviceConfig, application?.state_id]);

  // Notify parent when form becomes dirty (action form opened + text changed)
  useEffect(() => {
    const dirty = action !== null && (remarks.length > 0 || queryMessage.length > 0);
    onDirtyChange?.(dirty);
  }, [action, remarks, queryMessage, onDirtyChange]);

  // Clean up dirty state on unmount
  useEffect(() => {
    return () => { onDirtyChange?.(false); };
  }, [onDirtyChange]);

  // Clean up blob URL when preview closes
  useEffect(() => {
    return () => {
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    };
  }, [previewBlobUrl]);

  // Load inspections for the current application
  const loadInspections = useCallback(async (arn: string) => {
    setInspectionLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/inspections/for-application/${encodeURIComponent(arn)}`, authHeaders());
      if (!res.ok) throw new Error("Failed to load inspections");
      const data = await res.json();
      setInspections(data.inspections || []);
    } catch {
      setInspections([]);
    } finally {
      setInspectionLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (application?.arn) {
      void loadInspections(application.arn);
    }
  }, [application?.arn, loadInspections]);

  // Load internal notes for the current application (O5)
  const loadNotes = useCallback(async (arn: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/applications/${encodeURIComponent(arn)}/notes?visibility=INTERNAL`, authHeaders());
      if (!res.ok) return;
      const data = await res.json();
      setInternalNotes(data.notes || []);
    } catch {
      // silently fail — notes are supplementary
    }
  }, [authHeaders]);

  useEffect(() => {
    if (application?.arn) {
      void loadNotes(application.arn);
    }
  }, [application?.arn, loadNotes]);

  const handleAddNote = useCallback(async () => {
    if (!newNote.trim() || !application?.arn) return;
    setNoteLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/applications/${encodeURIComponent(application.arn)}/notes`, {
        ...authHeaders(),
        method: "POST",
        body: JSON.stringify({ text: newNote.trim(), visibility: "INTERNAL", officerUserId }),
      });
      if (!res.ok) throw new Error("Failed to add note");
      setNewNote("");
      setFeedback({ variant: "success", text: t("feedback.note_added") });
      void loadNotes(application.arn);
    } catch {
      setFeedback({ variant: "error", text: "Failed to add note" });
    } finally {
      setNoteLoading(false);
    }
  }, [newNote, application?.arn, authHeaders, officerUserId, t, loadNotes]);

  // Batch verify all documents (O6)
  const handleVerifyAllDocs = useCallback(async () => {
    if (!application?.documents?.length) return;
    setBatchVerifyLoading(true);
    try {
      const unverifiedDocs = application.documents.filter(
        (doc) => doc.verification_status !== "VERIFIED"
      );
      for (const doc of unverifiedDocs) {
        await fetch(`${apiBaseUrl}/api/v1/documents/${doc.doc_id}/verify`, {
          ...authHeaders(),
          method: "PATCH",
          body: JSON.stringify({ status: "VERIFIED", remarks: "", officerUserId }),
        });
      }
      setFeedback({ variant: "success", text: t("feedback.all_docs_verified") });
      if (onApplicationUpdate) {
        onApplicationUpdate((prev) => ({
          ...prev,
          documents: prev.documents.map((d) => ({ ...d, verification_status: "VERIFIED" })),
        }));
      }
    } catch {
      setFeedback({ variant: "error", text: "Failed to verify all documents" });
    } finally {
      setBatchVerifyLoading(false);
    }
  }, [application?.documents, authHeaders, officerUserId, t, onApplicationUpdate]);

  const handleAssignInspection = useCallback(async (inspectionId: string) => {
    setInspectionLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/inspections/${inspectionId}/assign`, {
        ...authHeaders(),
        method: "PATCH",
        body: JSON.stringify({ officerUserId }),
      });
      if (!res.ok) throw new Error("Assignment failed");
      setFeedback({ variant: "success", text: t("feedback.inspection_assigned") });
      void loadInspections(application.arn);
    } catch {
      setFeedback({ variant: "error", text: t("feedback.inspection_error") });
    } finally {
      setInspectionLoading(false);
    }
  }, [authHeaders, officerUserId, application.arn, loadInspections, t]);

  const handleCompleteInspection = useCallback(async (inspectionId: string) => {
    if (!inspectionOutcome) return;
    setInspectionLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/inspections/${inspectionId}/complete`, {
        ...authHeaders(),
        method: "PATCH",
        body: JSON.stringify({
          outcome: inspectionOutcome,
          findingsSummary: inspectionFindings || undefined,
          outcomeRemarks: inspectionRemarks || undefined,
        }),
      });
      if (!res.ok) throw new Error("Completion failed");
      setFeedback({ variant: "success", text: t("feedback.inspection_completed") });
      setInspectionOutcome("");
      setInspectionFindings("");
      setInspectionRemarks("");
      void loadInspections(application.arn);
    } catch {
      setFeedback({ variant: "error", text: t("feedback.inspection_error") });
    } finally {
      setInspectionLoading(false);
    }
  }, [authHeaders, inspectionOutcome, inspectionFindings, inspectionRemarks, application.arn, loadInspections, t]);

  const handleCancelInspection = useCallback(async (inspectionId: string) => {
    setInspectionLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/inspections/${inspectionId}/cancel`, {
        ...authHeaders(),
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Cancellation failed");
      setFeedback({ variant: "success", text: t("feedback.inspection_cancelled") });
      void loadInspections(application.arn);
    } catch {
      setFeedback({ variant: "error", text: t("feedback.inspection_error") });
    } finally {
      setInspectionLoading(false);
    }
  }, [authHeaders, application.arn, loadInspections, t]);

  const fetchDocBlob = useCallback(async (docId: string): Promise<{ url: string; mime: string }> => {
    const res = await fetch(`${apiBaseUrl}/api/v1/documents/${docId}/download`, authHeaders());
    if (!res.ok) throw new Error("Failed to fetch document");
    const mime = res.headers.get("content-type") || "application/octet-stream";
    const blob = await res.blob();
    return { url: URL.createObjectURL(blob), mime };
  }, [authHeaders]);

  const handleDownload = useCallback(async (doc: any) => {
    try {
      const { url, mime } = await fetchDocBlob(doc.doc_id);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.original_filename || "document";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setFeedback({ variant: "error", text: t("feedback.failed_download_doc") });
    }
  }, [fetchDocBlob]);

  const handlePreview = useCallback(async (doc: any) => {
    setPreviewDoc(doc);
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewBlobUrl(null);
    setFullscreen(false);
    try {
      const { url, mime } = await fetchDocBlob(doc.doc_id);
      setPreviewBlobUrl(url);
      setPreviewMimeType(mime);
    } catch {
      setPreviewError(t("feedback.failed_preview_doc"));
    } finally {
      setPreviewLoading(false);
    }
  }, [fetchDocBlob]);

  const closePreview = useCallback(() => {
    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    setPreviewDoc(null);
    setPreviewBlobUrl(null);
    setPreviewMimeType("");
    setPreviewError(null);
    setFullscreen(false);
  }, [previewBlobUrl]);

  const handleDocVerify = useCallback(async (docId: string, status: string) => {
    const entry = docVerifications[docId] || { status: "", remarks: "" };
    const remarks = entry.remarks;
    if ((status === "REJECTED" || status === "QUERY") && !remarks.trim()) {
      setDocVerifyFeedback({ docId, variant: "error", text: t("feedback.provide_rejection_reason") });
      return;
    }
    setDocVerifyLoading(docId);
    setDocVerifyFeedback(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/documents/${docId}/verify`, {
        ...authHeaders(),
        method: "PATCH",
        body: JSON.stringify({ status, remarks: remarks || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Verification failed");
      }
      setDocVerifyFeedback({ docId, variant: "success", text: t("feedback.doc_status_updated", { status }) });
      // PERF-028: Immutable update for optimistic document verification feedback
      if (onApplicationUpdate) {
        onApplicationUpdate((prev) => ({
          ...prev,
          documents: prev.documents.map((d: any) =>
            d.doc_id === docId
              ? { ...d, verification_status: status, verification_remarks: remarks }
              : d
          ),
        }));
      }
    } catch (err) {
      setDocVerifyFeedback({ docId, variant: "error", text: err instanceof Error ? err.message : "Verification failed" });
    } finally {
      setDocVerifyLoading(null);
    }
  }, [docVerifications, authHeaders, application.documents]);

  const isPreviewImage = previewMimeType.startsWith("image/");
  const isPreviewPdf = previewMimeType === "application/pdf";

  const handleAction = async (confirmed = false) => {
    if (!task || !action) return;
    if (isOffline) {
      setError(null);
      setFeedback({ variant: "warning", text: t("feedback.offline_workflow") });
      return;
    }
    if (action === "QUERY" && !queryMessage.trim()) {
      setError(null);
      setFeedback({ variant: "warning", text: t("feedback.query_message_required") });
      return;
    }
    if (!remarks.trim()) {
      setError(null);
      setFeedback({ variant: "warning", text: t("feedback.remarks_required") });
      return;
    }
    if (!confirmed && (action === "APPROVE" || action === "REJECT")) {
      setConfirmOpen(true);
      return;
    }

    setActionLoading(true);
    setError(null);
    setFeedback(null);
    try {
      const body: any = { action, userId: officerUserId, remarks };
      if (reasonCode) {
        body.reasonCode = reasonCode;
      }
      if (action === "QUERY") {
        body.queryMessage = queryMessage;
        body.unlockedFields = unlockedFields;
        body.unlockedDocuments = unlockedDocuments;
      }
      if (Object.keys(verificationChecklist).length > 0 || verificationRemarks) {
        body.verificationData = { checklist: verificationChecklist, remarks: verificationRemarks };
      }
      const res = await fetch(`${apiBaseUrl}/api/v1/tasks/${task.task_id}/actions`, {
        ...authHeaders(),
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Action failed");
      }
      onActionComplete({ variant: "success", text: t("feedback.action_completed", { action }) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setFeedback(null);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <Button onClick={onBack} className="back-button" variant="ghost">
        &larr; {t(fromSearch ? "task.back_to_search" : "task.back_to_inbox")}
      </Button>
      <h1 style={{ marginTop: "var(--space-3)" }}>{t("app.page_task")}</h1>
      <p className="subtitle">ARN: {application.arn}</p>

      <div className="panel" style={{ marginTop: "var(--space-4)" }}>
        {isOffline ? (
          <Alert variant="warning" className="task-feedback">
            {t("offline.task_disabled")}
          </Alert>
        ) : null}
        {feedback ? <Alert variant={feedback.variant} className="task-feedback">{feedback.text}</Alert> : null}
        {application.sla_due_at && (
          <div className="sla-banner">
            <strong>{t("task.sla_due")}</strong> {new Date(application.sla_due_at).toLocaleString()}
            {new Date(application.sla_due_at) < new Date() && <span className="sla-overdue"> (Overdue)</span>}
          </div>
        )}

        <div className="application-details">
          <h2>{t("task.application_data")}</h2>
          {renderStructuredData(application.data_jsonb)}
        </div>

        {checklistItems.length > 0 && (
          <div className="verification-section">
            <h2>{t("task.verification_checklist")}</h2>
            <div className="checklist-items">
              {checklistItems.map((item) => (
                <label key={item.key} className="checklist-item">
                  <input
                    type="checkbox"
                    checked={verificationChecklist[item.key] || false}
                    disabled={isOffline || actionLoading}
                    onChange={(e) => setVerificationChecklist({ ...verificationChecklist, [item.key]: e.target.checked })}
                  />
                  <span>{item.label}{item.required ? " *" : ""}</span>
                </label>
              ))}
            </div>
            <Field label={<Bilingual tKey="task.verification_remarks" />} htmlFor="verification-remarks">
              <Textarea
                id="verification-remarks"
                value={verificationRemarks}
                onChange={(e) => setVerificationRemarks(e.target.value)}
                rows={3}
                placeholder={t("task.verification_remarks_placeholder")}
                disabled={isOffline || actionLoading}
              />
            </Field>
          </div>
        )}

        <div className="documents-section">
          <div className="documents-section-header">
            <h2>{t("task.documents_section", { count: application.documents.length })}</h2>
            {!fromSearch && !["APPROVED", "REJECTED", "CLOSED"].includes(application.state_id) && application.documents.length > 0 && (
              <Button
                size="sm"
                variant="success"
                disabled={isOffline || batchVerifyLoading || application.documents.every((d) => d.verification_status === "VERIFIED")}
                onClick={() => void handleVerifyAllDocs()}
              >
                {batchVerifyLoading ? t("common.loading") : t("task.verify_all_docs")}
              </Button>
            )}
          </div>
          {application.documents.length > 0 ? (
            <div className="detail-card-list">
              {application.documents.map((doc) => {
                const verEntry = docVerifications[doc.doc_id] || { status: "", remarks: "" };
                const verStatus = doc.verification_status || "PENDING";
                const statusClass = verStatus === "VERIFIED" ? "badge-approved" : verStatus === "REJECTED" ? "badge-rejected" : verStatus === "QUERY" ? "badge-query" : "badge-pending";
                return (
                <Card key={doc.doc_id} className="detail-read-card">
                  <div className="read-card-header">
                    <p className="read-card-title">{doc.original_filename}</p>
                    <span className={`badge ${statusClass}`}>{verStatus}</span>
                  </div>
                  <div className="read-card-grid">
                    <div className="read-meta-row">
                      <span className="read-meta-key">Document Type</span>
                      <span className="read-meta-value">{doc.doc_type_id || "—"}</span>
                    </div>
                    <div className="read-meta-row">
                      <span className="read-meta-key">Document ID</span>
                      <span className="read-meta-value">{doc.doc_id}</span>
                    </div>
                    {doc.verification_remarks && (
                      <div className="read-meta-row">
                        <span className="read-meta-key">Remarks</span>
                        <span className="read-meta-value">{doc.verification_remarks}</span>
                      </div>
                    )}
                  </div>
                  <div className="doc-actions">
                    <Button variant="ghost" className="doc-actions__btn" onClick={() => void handlePreview(doc)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      {t("action.preview")}
                    </Button>
                    <Button variant="ghost" className="doc-actions__btn" onClick={() => void handleDownload(doc)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      {t("action.download")}
                    </Button>
                  </div>
                  {/* Per-document verification controls */}
                  {!fromSearch && !["APPROVED", "REJECTED", "CLOSED"].includes(application.state_id) && (
                    <div className="doc-verify-controls">
                      <div className="doc-verify-actions">
                        <Button
                          size="sm"
                          variant="success"
                          disabled={isOffline || docVerifyLoading === doc.doc_id}
                          onClick={() => void handleDocVerify(doc.doc_id, "VERIFIED")}
                        >
                          {t("action.verify")}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={isOffline || docVerifyLoading === doc.doc_id}
                          onClick={() => void handleDocVerify(doc.doc_id, "REJECTED")}
                        >
                          {t("action.reject")}
                        </Button>
                        <Button
                          size="sm"
                          variant="warning"
                          disabled={isOffline || docVerifyLoading === doc.doc_id}
                          onClick={() => void handleDocVerify(doc.doc_id, "QUERY")}
                        >
                          {t("action.query")}
                        </Button>
                      </div>
                      <input
                        type="text"
                        className="ui-input doc-verify-remarks"
                        placeholder={t("task.doc_verify_reason_placeholder")}
                        value={verEntry.remarks}
                        disabled={isOffline || docVerifyLoading === doc.doc_id}
                        onChange={(e) => setDocVerifications((prev) => ({
                          ...prev,
                          [doc.doc_id]: { ...prev[doc.doc_id], remarks: e.target.value },
                        }))}
                      />
                      {docVerifyLoading === doc.doc_id && <span className="doc-verify-loading">Saving...</span>}
                      {docVerifyFeedback?.docId === doc.doc_id && (
                        <Alert variant={docVerifyFeedback.variant === "success" ? "success" : "error"} className="doc-verify-alert">
                          {docVerifyFeedback.text}
                        </Alert>
                      )}
                    </div>
                  )}
                </Card>
                );
              })}
            </div>
          ) : (
            <Alert variant="info" className="empty-read-alert">
              {t("task.no_documents")}
            </Alert>
          )}
        </div>

        {/* Site Inspection Section */}
        <div className="inspection-section">
          <h2><Bilingual tKey="inspection.title" /></h2>
          {inspections.length === 0 ? (
            <Alert variant="info" className="empty-read-alert">
              {t("inspection.no_inspections")}
            </Alert>
          ) : (
            <div className="detail-card-list">
              {inspections.map((insp) => {
                const statusKey =
                  insp.status === "SCHEDULED" ? "inspection.status_scheduled"
                  : insp.status === "IN_PROGRESS" ? "inspection.status_in_progress"
                  : insp.status === "COMPLETED" ? "inspection.status_completed"
                  : "inspection.status_cancelled";
                const statusClass =
                  insp.status === "COMPLETED" ? "badge-approved"
                  : insp.status === "CANCELLED" ? "badge-rejected"
                  : insp.status === "IN_PROGRESS" ? "badge-query"
                  : "badge-pending";
                const isAssignedToMe = insp.officer_user_id === officerUserId;
                const canAct = (insp.status === "SCHEDULED" || insp.status === "IN_PROGRESS");

                return (
                  <Card key={insp.inspection_id} className="detail-read-card">
                    <div className="read-card-header">
                      <p className="read-card-title">{insp.inspection_type}</p>
                      <span className={`badge ${statusClass}`}>{t(statusKey)}</span>
                    </div>
                    <div className="read-card-grid">
                      <div className="read-meta-row">
                        <span className="read-meta-key"><Bilingual tKey="inspection.type" /></span>
                        <span className="read-meta-value">{insp.inspection_type || "\u2014"}</span>
                      </div>
                      <div className="read-meta-row">
                        <span className="read-meta-key"><Bilingual tKey="inspection.status" /></span>
                        <span className="read-meta-value">{t(statusKey)}</span>
                      </div>
                      <div className="read-meta-row">
                        <span className="read-meta-key"><Bilingual tKey="inspection.scheduled_at" /></span>
                        <span className="read-meta-value">
                          {insp.scheduled_at ? new Date(insp.scheduled_at).toLocaleString() : "\u2014"}
                        </span>
                      </div>
                      {insp.status === "COMPLETED" && insp.actual_at && (
                        <div className="read-meta-row">
                          <span className="read-meta-key"><Bilingual tKey="inspection.completed_on" /></span>
                          <span className="read-meta-value">
                            {new Date(insp.actual_at).toLocaleString()}
                          </span>
                        </div>
                      )}
                      {isAssignedToMe && canAct && (
                        <div className="read-meta-row">
                          <span className="read-meta-key">&nbsp;</span>
                          <span className="read-meta-value" style={{ color: "var(--color-success)" }}>
                            {t("inspection.assigned_to_you")}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Assign to Me button: SCHEDULED + unassigned */}
                    {insp.status === "SCHEDULED" && !insp.officer_user_id && (
                      <div style={{ marginTop: "var(--space-3)" }}>
                        <Button
                          onClick={() => void handleAssignInspection(insp.inspection_id)}
                          disabled={isOffline || inspectionLoading}
                        >
                          {t("inspection.assign_to_me")}
                        </Button>
                      </div>
                    )}

                    {/* Complete inspection form: assigned to current officer, SCHEDULED or IN_PROGRESS */}
                    {isAssignedToMe && canAct && (
                      <div className="inspection-form" style={{ marginTop: "var(--space-3)" }}>
                        <Field label={<Bilingual tKey="inspection.outcome" />} htmlFor={`insp-outcome-${insp.inspection_id}`} required>
                          <Select
                            id={`insp-outcome-${insp.inspection_id}`}
                            value={inspectionOutcome}
                            onChange={(e) => setInspectionOutcome(e.target.value)}
                            disabled={isOffline || inspectionLoading}
                          >
                            <option value="">{t("complaints.select_status")}</option>
                            <option value="PASS">{t("inspection.outcome_pass")}</option>
                            <option value="FAIL">{t("inspection.outcome_fail")}</option>
                            <option value="REINSPECTION_REQUIRED">{t("inspection.outcome_reinspection")}</option>
                            <option value="NA">{t("inspection.outcome_na")}</option>
                          </Select>
                        </Field>
                        <Field label={<Bilingual tKey="inspection.findings" />} htmlFor={`insp-findings-${insp.inspection_id}`}>
                          <Textarea
                            id={`insp-findings-${insp.inspection_id}`}
                            value={inspectionFindings}
                            onChange={(e) => setInspectionFindings(e.target.value)}
                            rows={3}
                            disabled={isOffline || inspectionLoading}
                          />
                        </Field>
                        <Field label={<Bilingual tKey="inspection.remarks" />} htmlFor={`insp-remarks-${insp.inspection_id}`}>
                          <Textarea
                            id={`insp-remarks-${insp.inspection_id}`}
                            value={inspectionRemarks}
                            onChange={(e) => setInspectionRemarks(e.target.value)}
                            rows={3}
                            disabled={isOffline || inspectionLoading}
                          />
                        </Field>
                        <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
                          <Button
                            onClick={() => void handleCompleteInspection(insp.inspection_id)}
                            disabled={isOffline || inspectionLoading || !inspectionOutcome}
                          >
                            {t("inspection.complete")}
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => void handleCancelInspection(insp.inspection_id)}
                            disabled={isOffline || inspectionLoading}
                          >
                            {t("inspection.cancel_inspection")}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Read-only view for completed inspections */}
                    {insp.status === "COMPLETED" && (
                      <div className="read-card-grid" style={{ marginTop: "var(--space-3)" }}>
                        <div className="read-meta-row">
                          <span className="read-meta-key"><Bilingual tKey="inspection.outcome" /></span>
                          <span className="read-meta-value">{insp.outcome || "\u2014"}</span>
                        </div>
                        {insp.findings_summary && (
                          <div className="read-meta-row">
                            <span className="read-meta-key"><Bilingual tKey="inspection.findings" /></span>
                            <span className="read-meta-value">{insp.findings_summary}</span>
                          </div>
                        )}
                        {insp.outcome_remarks && (
                          <div className="read-meta-row">
                            <span className="read-meta-key"><Bilingual tKey="inspection.remarks" /></span>
                            <span className="read-meta-value">{insp.outcome_remarks}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cancel button for non-assigned SCHEDULED or IN_PROGRESS */}
                    {canAct && !isAssignedToMe && insp.officer_user_id && (
                      <div style={{ marginTop: "var(--space-3)" }}>
                        <Button
                          variant="danger"
                          onClick={() => void handleCancelInspection(insp.inspection_id)}
                          disabled={isOffline || inspectionLoading}
                        >
                          {t("inspection.cancel_inspection")}
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="queries-section">
          <h2>{t("task.queries_section", { count: application.queries.length })}</h2>
          {application.queries.length > 0 ? (
            <div className="detail-card-list">
              {application.queries.map((q) => (
                <Card key={q.query_id} className="detail-read-card query-item">
                  <div className="read-card-header">
                    <p className="read-card-title">Query #{q.query_number}</p>
                    <span className="badge">{q.status || "PENDING"}</span>
                  </div>
                  <p className="read-card-body">{q.message}</p>
                  <div className="read-card-grid">
                    <div className="read-meta-row">
                      <span className="read-meta-key">Raised At</span>
                      <span className="read-meta-value">
                        {q.raised_at ? new Date(q.raised_at).toLocaleString() : "—"}
                      </span>
                    </div>
                    <div className="read-meta-row">
                      <span className="read-meta-key">Responded At</span>
                      <span className="read-meta-value">
                        {q.responded_at ? new Date(q.responded_at).toLocaleString() : "—"}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Alert variant="info" className="empty-read-alert">
              {t("task.no_queries")}
            </Alert>
          )}
        </div>

        <div className="timeline-section">
          <h2>{t("task.timeline_section", { count: application.timeline.length })}</h2>
          {application.timeline.length > 0 ? (
            <div className="detail-card-list">
              {application.timeline.map((event, idx) => (
                <Card key={idx} className="detail-read-card timeline-item-card">
                  <p className="read-card-title">{event.event_type}</p>
                  <div className="read-card-grid">
                    <div className="read-meta-row">
                      <span className="read-meta-key">Timestamp</span>
                      <span className="read-meta-value">
                        {event.created_at ? new Date(event.created_at).toLocaleString() : "—"}
                      </span>
                    </div>
                    <div className="read-meta-row">
                      <span className="read-meta-key">Actor</span>
                      <span className="read-meta-value">
                        {event.actor_id || event.actor_type || "System"}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Alert variant="info" className="empty-read-alert">
              {t("task.no_timeline")}
            </Alert>
          )}
        </div>

        {(application.disposal_type === "APPROVED" || application.disposal_type === "REJECTED") && (
          <div className="output-download">
            <a href={`${apiBaseUrl}/api/v1/applications/${application.arn}/output/download`} target="_blank" rel="noopener noreferrer" className="download-link">
              Download {application.disposal_type === "APPROVED" ? "Certificate" : "Order"}
            </a>
          </div>
        )}

        {/* Internal Notes Section (O5) */}
        {!fromSearch && (
          <div className="notes-section">
            <h2>{t("task.notes")}</h2>
            <div className="notes-list">
              {internalNotes.length > 0 ? (
                internalNotes.map((note) => (
                  <Card key={note.id} className="note-card">
                    <p className="note-text">{note.text}</p>
                    <div className="note-meta">
                      <span className="note-author">{note.officer_id}</span>
                      <span className="note-date">{new Date(note.created_at).toLocaleString()}</span>
                    </div>
                  </Card>
                ))
              ) : (
                <p className="notes-empty">{t("task.note_placeholder")}</p>
              )}
            </div>
            {!["APPROVED", "REJECTED", "CLOSED"].includes(application.state_id) && (
              <div className="note-form">
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder={t("task.note_placeholder")}
                  rows={2}
                  disabled={isOffline || noteLoading}
                />
                <Button
                  size="sm"
                  onClick={() => void handleAddNote()}
                  disabled={isOffline || noteLoading || !newNote.trim()}
                >
                  {noteLoading ? t("common.loading") : t("task.add_note")}
                </Button>
              </div>
            )}
          </div>
        )}

        {error ? <Alert variant="error">{error}</Alert> : null}

        {!fromSearch && !["APPROVED", "REJECTED", "CLOSED"].includes(application.state_id) && task.task_id && (
          <div className="action-panel">
            <h2>{t("task.take_action")}</h2>
            <div className="action-buttons">
              <Button onClick={() => setAction("FORWARD")} className="action-btn forward" variant="secondary" disabled={isOffline || actionLoading}>{t("action.forward")}</Button>
              <Button onClick={() => setAction("QUERY")} className="action-btn query" variant="secondary" disabled={isOffline || actionLoading}>{t("action.query")}</Button>
              <Button onClick={() => setAction("APPROVE")} className="action-btn approve" variant="secondary" disabled={isOffline || actionLoading}>{t("action.approve")}</Button>
              <Button onClick={() => setAction("REJECT")} className="action-btn reject" variant="secondary" disabled={isOffline || actionLoading}>{t("action.reject")}</Button>
            </div>

            {action && (
              <div className="action-form">
                {(action === "REJECT" || action === "QUERY") && (
                  <Field label={<Bilingual tKey="task.reason_code" />} htmlFor="reason-code">
                    <Select
                      id="reason-code"
                      value={reasonCode}
                      onChange={(e) => setReasonCode(e.target.value)}
                      disabled={isOffline || actionLoading}
                    >
                      <option value="">{t("task.select_reason")}</option>
                      {action === "REJECT" ? (
                        <>
                          <option value="INCOMPLETE_DOCS">{t("reason.incomplete_docs")}</option>
                          <option value="POLICY_VIOLATION">{t("reason.policy_violation")}</option>
                          <option value="INCORRECT_INFO">{t("reason.incorrect_info")}</option>
                          <option value="OTHER">{t("reason.other")}</option>
                        </>
                      ) : (
                        <>
                          <option value="MISSING_DOC">{t("reason.missing_doc")}</option>
                          <option value="CLARIFICATION">{t("reason.clarification")}</option>
                          <option value="ADDITIONAL_INFO">{t("reason.additional_info")}</option>
                          <option value="OTHER">{t("reason.other")}</option>
                        </>
                      )}
                    </Select>
                  </Field>
                )}
                {action === "QUERY" && (
                  <>
                    <Field label={<Bilingual tKey="task.query_message" />} htmlFor="query-message" required>
                      <Textarea
                        id="query-message"
                        value={queryMessage}
                        onChange={(e) => setQueryMessage(e.target.value)}
                        rows={3}
                        disabled={isOffline || actionLoading}
                      />
                    </Field>
                    <Field label={<Bilingual tKey="task.unlock_fields" />} htmlFor="unlock-fields">
                      <Input
                        id="unlock-fields"
                        type="text"
                        value={unlockedFields.join(", ")}
                        onChange={(e) =>
                          setUnlockedFields(
                            e.target.value.split(",").map((s) => s.trim()).filter((s) => s)
                          )
                        }
                        placeholder={t("task.unlock_fields_placeholder")}
                        disabled={isOffline || actionLoading}
                      />
                    </Field>
                    <Field label={<Bilingual tKey="task.unlock_documents" />} htmlFor="unlock-documents">
                      <Input
                        id="unlock-documents"
                        type="text"
                        value={unlockedDocuments.join(", ")}
                        onChange={(e) =>
                          setUnlockedDocuments(
                            e.target.value.split(",").map((s) => s.trim()).filter((s) => s)
                          )
                        }
                        placeholder={t("task.unlock_documents_placeholder")}
                        disabled={isOffline || actionLoading}
                      />
                    </Field>
                  </>
                )}
                <Field label={<Bilingual tKey="task.remarks" />} htmlFor="action-remarks" required={action === "REJECT"}>
                  <Textarea
                    id="action-remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    disabled={isOffline || actionLoading}
                  />
                </Field>
                <div className="action-form-buttons">
                  <Button
                    onClick={() => void handleAction()}
                    className="submit-action"
                    disabled={
                      isOffline ||
                      actionLoading ||
                      (action === "QUERY" && !queryMessage.trim()) ||
                      (action === "REJECT" && !remarks.trim())
                    }
                  >
                    {actionLoading ? t("task.submitting") : t("task.submit_action", { action })}
                  </Button>
                  <Button
                    onClick={() => setAction(null)}
                    className="cancel-action"
                    variant="ghost"
                    disabled={actionLoading}
                  >
                    {t("action.cancel")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        open={confirmOpen && (action === "APPROVE" || action === "REJECT")}
        onClose={() => setConfirmOpen(false)}
        title={action === "APPROVE" ? t("task.confirm_approval") : t("task.confirm_rejection")}
        description={
          action === "APPROVE"
            ? t("task.approval_warning")
            : t("task.rejection_warning")
        }
        actions={
          <>
            <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)}>
              {t("action.cancel")}
            </Button>
            <Button
              type="button"
              variant={action === "APPROVE" ? "success" : "danger"}
              onClick={() => {
                setConfirmOpen(false);
                void handleAction(true);
              }}
            >
              {t(action === "APPROVE" ? "action.confirm_approval" : "action.confirm_rejection")}
            </Button>
          </>
        }
      />

      {/* Document Preview Modal */}
      <Modal
        open={!!previewDoc && !fullscreen}
        onClose={closePreview}
        title={previewDoc?.original_filename || "Document Preview"}
        className="doc-preview-modal"
        actions={
          <>
            <Button type="button" variant="ghost" onClick={closePreview}>{t("action.close")}</Button>
            {previewBlobUrl && (
              <>
                <Button type="button" variant="ghost" onClick={() => setFullscreen(true)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                  {t("action.fullscreen")}
                </Button>
                <Button type="button" variant="secondary" onClick={() => void handleDownload(previewDoc)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  {t("action.download")}
                </Button>
              </>
            )}
          </>
        }
      >
        <div className="doc-preview-content">
          {previewLoading && <p className="doc-preview-loading">{t("task.loading_preview")}</p>}
          {previewError && <Alert variant="error">{previewError}</Alert>}
          {previewBlobUrl && isPreviewImage && (
            <img src={previewBlobUrl} alt={previewDoc?.original_filename || "Document"} className="doc-preview-img" />
          )}
          {previewBlobUrl && isPreviewPdf && (
            <iframe src={previewBlobUrl} title={previewDoc?.original_filename || "Document"} className="doc-preview-iframe" />
          )}
          {previewBlobUrl && !isPreviewImage && !isPreviewPdf && (
            <div className="doc-preview-unsupported">
              <p>{t("task.preview_unavailable")}</p>
              <Button variant="secondary" onClick={() => void handleDownload(previewDoc)}>{t("task.download_to_view")}</Button>
            </div>
          )}
        </div>
      </Modal>

      {/* Fullscreen Preview Overlay */}
      {fullscreen && previewDoc && (
        <div className="doc-preview-fullscreen" role="dialog" aria-label="Fullscreen document preview">
          <div className="doc-preview-fullscreen__toolbar">
            <span className="doc-preview-fullscreen__filename">{previewDoc.original_filename}</span>
            <div className="doc-preview-fullscreen__actions">
              <Button variant="ghost" onClick={() => void handleDownload(previewDoc)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                {t("action.download")}
              </Button>
              <Button variant="ghost" onClick={() => setFullscreen(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                {t("action.exit_fullscreen")}
              </Button>
              <Button variant="ghost" onClick={closePreview}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                {t("action.close")}
              </Button>
            </div>
          </div>
          <div className="doc-preview-fullscreen__body">
            {previewBlobUrl && isPreviewImage && (
              <img src={previewBlobUrl} alt={previewDoc.original_filename || "Document"} className="doc-preview-img" />
            )}
            {previewBlobUrl && isPreviewPdf && (
              <iframe src={previewBlobUrl} title={previewDoc.original_filename || "Document"} className="doc-preview-iframe" />
            )}
            {previewBlobUrl && !isPreviewImage && !isPreviewPdf && (
              <div className="doc-preview-unsupported">
                <p>{t("task.preview_unavailable")}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
