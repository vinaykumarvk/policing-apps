import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "./AuthContext";
import { Alert, Button, Card, Field, Input, Modal, Textarea, Breadcrumb, timeAgo } from "@puda/shared";
import { getStatusBadgeClass, getStatusLabel, formatDateTime } from "@puda/shared/utils";
import { Bilingual } from "./Bilingual";
import { apiBaseUrl, FeeItem } from "./citizen-types";
import DocumentUploadPanel from "./DocumentUploadPanel";
import DeclarationFormPanel from "./DeclarationFormPanel";
import "./application-detail.css";

interface ApplicationDetailProps {
  application: {
    arn: string;
    service_key: string;
    state_id: string;
    data_jsonb: any;
    created_at: string;
    submitted_at?: string;
    disposed_at?: string;
    disposal_type?: string;
  };
  serviceConfig: any;
  detail: {
    documents?: any[];
    queries?: any[];
    tasks?: any[];
    timeline?: any[];
    workflow_stages?: Array<{
      stateId: string;
      systemRoleId: string | null;
      slaDays: number | null;
      status: "completed" | "current" | "upcoming";
      enteredAt?: string | null;
      completedAt?: string | null;
    }>;
    current_handler?: {
      officer_name?: string;
      role_id: string;
      sla_due_at?: string | null;
      days_in_stage: number;
      since: string;
    } | null;
  };
  feedback?: {
    variant: "info" | "success" | "warning" | "error";
    text: string;
  } | null;
  userId: string;
  onQueryResponded?: () => void;
  onBack: () => void;
  onSubmit?: () => void;
  onDocumentUpload?: (docTypeId: string, file: File) => void;
  onReuseDocument?: (citizenDocId: string, docTypeId: string) => void;
  citizenDocuments?: Array<{
    citizen_doc_id: string;
    doc_type_id: string;
    citizen_version: number;
    original_filename?: string;
    mime_type?: string;
    size_bytes?: number;
    uploaded_at?: string;
    linked_applications?: Array<{
      arn: string;
      verification_status: string;
    }>;
  }>;
  uploading?: boolean;
  uploadProgress?: number;
  isOffline?: boolean;
  staleAt?: string | null;
}

type NdcDueLine = {
  dueCode: string;
  label: string;
  dueKind: "INSTALLMENT" | "DELAYED_COMPLETION_FEE" | "ADDITIONAL_AREA";
  dueDate: string;
  baseAmount: number;
  interestAmount: number;
  totalDueAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: "PAID" | "PENDING" | "PARTIALLY_PAID";
  paymentDate: string | null;
  daysDelayed: number;
};

type NdcPaymentStatus = {
  propertyUpn: string | null;
  authorityId: string;
  allotmentDate: string | null;
  propertyValue: number;
  annualInterestRatePct: number;
  dcfRatePct: number;
  dues: NdcDueLine[];
  totals: {
    baseAmount: number;
    interestAmount: number;
    totalDueAmount: number;
    paidAmount: number;
    balanceAmount: number;
  };
  allDuesPaid: boolean;
  certificateEligible: boolean;
  generatedAt: string;
};

export default function ApplicationDetail({
  application,
  serviceConfig,
  detail,
  feedback = null,
  userId,
  onQueryResponded,
  onBack,
  onSubmit,
  onDocumentUpload,
  onReuseDocument,
  citizenDocuments = [],
  uploading = false,
  uploadProgress = 0,
  isOffline = false,
  staleAt = null
}: ApplicationDetailProps) {
  
  const { t } = useTranslation();
  const { authHeaders } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [generatingReceipt, setGeneratingReceipt] = useState(false);

  // Withdrawal state (C3)
  const [withdrawConfirmOpen, setWithdrawConfirmOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawFeedback, setWithdrawFeedback] = useState<{ variant: "success" | "error"; text: string } | null>(null);

  // Inspection visibility state (C5)
  const [citizenInspections, setCitizenInspections] = useState<Array<{
    inspection_id: string;
    inspection_type: string;
    status: string;
    scheduled_at?: string;
    completed_at?: string;
    outcome?: string;
  }>>([]);

  // Load inspections for citizen visibility (C5)
  useEffect(() => {
    if (!application?.arn || isOffline) return;
    const loadInspections = async () => {
      try {
        const res = await fetch(
          `${apiBaseUrl}/api/v1/inspections/for-application/${encodeURIComponent(application.arn)}`,
          authHeaders()
        );
        if (!res.ok) return;
        const data = await res.json();
        setCitizenInspections(data.inspections || []);
      } catch {
        // silently fail — inspections are supplementary
      }
    };
    void loadInspections();
  }, [application?.arn, isOffline, authHeaders]);

  // Handle application withdrawal (C3)
  const handleWithdraw = async () => {
    if (!application?.arn) return;
    setWithdrawing(true);
    setWithdrawFeedback(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/applications/${encodeURIComponent(application.arn)}`,
        {
          ...authHeaders(),
          method: "DELETE",
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || "Withdrawal failed");
      }
      setWithdrawFeedback({ variant: "success", text: t("withdraw.success") });
      setWithdrawConfirmOpen(false);
      // Navigate back after a short delay to show feedback
      setTimeout(() => onBack(), 1500);
    } catch {
      setWithdrawFeedback({ variant: "error", text: t("withdraw.error") });
      setWithdrawConfirmOpen(false);
    } finally {
      setWithdrawing(false);
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch(url, authHeaders());
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadReceipt = () => {
    setGeneratingReceipt(true);
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    try {
      const serviceName = esc(serviceConfig?.displayName || application.service_key);
      const applicantName = esc(
        application.data_jsonb?.applicant?.name
        || application.data_jsonb?.applicant?.applicantName
        || application.data_jsonb?.applicantName
        || "—"
      );
      const submittedDate = esc(application.submitted_at
        ? new Date(application.submitted_at).toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
          })
        : new Date(application.created_at).toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
          }));
      const statusLabel = esc(getStatusLabel(application.state_id));

      const receiptHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${t("receipt.title")} — ${esc(application.arn)}</title>
<style>
  @media print {
    body { margin: 0; }
    .no-print { display: none !important; }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 2rem; color: #1a1a1a; background: #fff; }
  .receipt { max-width: 700px; margin: 0 auto; border: 2px solid #1a365d; padding: 2rem; }
  .receipt-header { text-align: center; border-bottom: 2px solid #1a365d; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  .receipt-header h1 { font-size: 1.1rem; color: #1a365d; margin-bottom: 0.25rem; }
  .receipt-header h2 { font-size: 1.4rem; color: #1a365d; }
  .receipt-body { margin-bottom: 1.5rem; }
  .receipt-row { display: flex; padding: 0.6rem 0; border-bottom: 1px solid #e2e8f0; }
  .receipt-label { font-weight: 600; width: 220px; flex-shrink: 0; color: #4a5568; }
  .receipt-value { flex: 1; word-break: break-word; }
  .receipt-footer { border-top: 2px solid #1a365d; padding-top: 1rem; text-align: center; }
  .receipt-footer p { font-size: 0.85rem; color: #718096; margin-bottom: 0.5rem; }
  .receipt-footer .generated-at { font-size: 0.75rem; color: #a0aec0; }
  .print-btn { display: block; margin: 1.5rem auto 0; padding: 0.75rem 2rem; background: #1a365d; color: #fff; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; min-height: 2.75rem; }
  .print-btn:hover { background: #2a4a7f; }
  .print-btn:active { background: #0f2440; }
</style>
</head>
<body>
<div class="receipt">
  <div class="receipt-header">
    <h1>${t("receipt.authority")}</h1>
    <h2>${t("receipt.title")}</h2>
  </div>
  <div class="receipt-body">
    <div class="receipt-row">
      <span class="receipt-label">${t("receipt.arn")}</span>
      <span class="receipt-value"><strong>${esc(application.arn)}</strong></span>
    </div>
    <div class="receipt-row">
      <span class="receipt-label">${t("receipt.service")}</span>
      <span class="receipt-value">${serviceName}</span>
    </div>
    <div class="receipt-row">
      <span class="receipt-label">${t("receipt.applicant")}</span>
      <span class="receipt-value">${applicantName}</span>
    </div>
    <div class="receipt-row">
      <span class="receipt-label">${t("receipt.submitted_on")}</span>
      <span class="receipt-value">${submittedDate}</span>
    </div>
    <div class="receipt-row">
      <span class="receipt-label">${t("receipt.status")}</span>
      <span class="receipt-value">${statusLabel}</span>
    </div>
  </div>
  <div class="receipt-footer">
    <p>${t("receipt.disclaimer")}</p>
    <span class="generated-at">Generated: ${new Date().toLocaleString("en-IN")}</span>
  </div>
</div>
<button type="button" class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
</body>
</html>`;

      const receiptWindow = window.open("", "_blank");
      if (receiptWindow) {
        receiptWindow.document.write(receiptHtml);
        receiptWindow.document.close();
      }
    } finally {
      setGeneratingReceipt(false);
    }
  };

  const formConfig = serviceConfig?.form;
  const formData = application.data_jsonb || {};
  const docTypes = serviceConfig?.documents?.documentTypes || [];
  const queries = detail.queries || [];
  const documents = detail.documents || [];
  const timelineEvents = detail.timeline || [];
  const visibleTimeline = timelineEvents.slice(0, 10);
  const pendingQuery = queries.find((q: any) => q.status === "PENDING");
  const unlockedDocTypes: string[] = pendingQuery?.unlocked_doc_type_ids || [];
  const canUpload =
    !isOffline &&
    (application.state_id === "DRAFT" || (application.state_id === "QUERY_PENDING" && unlockedDocTypes.length > 0));
  const allowedDocTypes =
    application.state_id === "QUERY_PENDING"
      ? docTypes.filter((dt: any) => unlockedDocTypes.includes(dt.docTypeId))
      : docTypes;
  const unlockedFields: string[] = pendingQuery?.unlocked_field_keys || [];
  const applicantLockedFields = unlockedFields.filter((key) => key.startsWith("applicant."));
  const editableUnlockedFields = unlockedFields.filter((key) => !key.startsWith("applicant."));
  const [responseMessage, setResponseMessage] = useState("");
  const [responseData, setResponseData] = useState<any>(formData);
  const [responding, setResponding] = useState(false);
  const [responseError, setResponseError] = useState<string | null>(null);
  const [ndcPaymentStatus, setNdcPaymentStatus] = useState<NdcPaymentStatus | null>(null);
  const [ndcPaymentStatusLoading, setNdcPaymentStatusLoading] = useState(false);
  const [ndcPaymentStatusError, setNdcPaymentStatusError] = useState<string | null>(null);
  const [showNdcPaymentPage, setShowNdcPaymentPage] = useState(false);
  const [ndcPostingDueCode, setNdcPostingDueCode] = useState<string | null>(null);
  const [ndcPostingError, setNdcPostingError] = useState<string | null>(null);
  const [declarationDocTypeId, setDeclarationDocTypeId] = useState<string | null>(null);
  const [declarationSubmitting, setDeclarationSubmitting] = useState(false);
  const [declarationFeedback, setDeclarationFeedback] = useState<{ variant: "success" | "error"; text: string } | null>(null);

  // Generic fee payment state (for non-NDC services with feeSchedule)
  const [feeDemands, setFeeDemands] = useState<Array<{
    demand_id: string;
    demand_number: string | null;
    total_amount: number;
    paid_amount: number;
    status: "PENDING" | "PARTIALLY_PAID" | "PAID" | "WAIVED" | "CANCELLED";
    due_date: string | null;
    lineItems?: Array<{
      fee_head_code: string;
      description: string | null;
      amount: number;
    }>;
  }>>([]);
  const [feeDemandsLoading, setFeeDemandsLoading] = useState(false);
  const [feeDemandsError, setFeeDemandsError] = useState<string | null>(null);
  const [paymentInitiating, setPaymentInitiating] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    setResponseData(formData);
    setShowNdcPaymentPage(false);
  }, [application.arn]);

  useEffect(() => {
    if (application.service_key !== "no_due_certificate") {
      setNdcPaymentStatus(null);
      setNdcPaymentStatusError(null);
      setNdcPaymentStatusLoading(false);
      return;
    }
    if (isOffline) {
      setNdcPaymentStatusError("Offline mode is active. Payment status cannot be refreshed.");
      setNdcPaymentStatusLoading(false);
      return;
    }
    let cancelled = false;
    setNdcPaymentStatusLoading(true);
    setNdcPaymentStatusError(null);

    void (async () => {
      try {
        const res = await fetch(
          `${apiBaseUrl}/api/v1/applications/${application.arn}/payment-status`,
          authHeaders()
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.message || body?.error || `API error ${res.status}`);
        }
        if (!cancelled) {
          setNdcPaymentStatus(body.paymentStatus || null);
        }
      } catch (err) {
        if (!cancelled) {
          setNdcPaymentStatus(null);
          setNdcPaymentStatusError(err instanceof Error ? err.message : "Failed to load payment status");
        }
      } finally {
        if (!cancelled) {
          setNdcPaymentStatusLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [application.arn, application.service_key, isOffline, authHeaders]);

  // Generic fee demands (for non-NDC services that have a feeSchedule in their config)
  const hasFeeSchedule = application.service_key !== "no_due_certificate" &&
    Array.isArray(serviceConfig?.feeSchedule?.default) &&
    serviceConfig.feeSchedule.default.length > 0;

  useEffect(() => {
    if (!hasFeeSchedule) {
      setFeeDemands([]);
      setFeeDemandsError(null);
      setFeeDemandsLoading(false);
      return;
    }
    if (application.state_id === "DRAFT") {
      // No demands exist for draft applications
      setFeeDemands([]);
      return;
    }
    if (isOffline) {
      setFeeDemandsError(t("payment.offline_unavailable"));
      setFeeDemandsLoading(false);
      return;
    }
    let cancelled = false;
    setFeeDemandsLoading(true);
    setFeeDemandsError(null);

    void (async () => {
      try {
        const res = await fetch(
          `${apiBaseUrl}/api/v1/fees/demands/for-application/${application.arn}`,
          authHeaders()
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.message || body?.error || `API error ${res.status}`);
        }
        if (!cancelled) {
          setFeeDemands(Array.isArray(body.demands) ? body.demands : Array.isArray(body) ? body : []);
        }
      } catch (err) {
        if (!cancelled) {
          setFeeDemands([]);
          setFeeDemandsError(err instanceof Error ? err.message : "Failed to load fee demands");
        }
      } finally {
        if (!cancelled) {
          setFeeDemandsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [application.arn, application.state_id, hasFeeSchedule, isOffline, authHeaders, t]);

  // Build field map from form config for proper labels
  // NOTE: All hooks MUST be above any early returns to comply with Rules of Hooks
  const fieldMap = useMemo(() => {
    const map: Record<string, { label: string; type: string; options?: any[] }> = {};
    if (formConfig?.pages) {
      formConfig.pages.forEach((page: any) => {
        page.sections?.forEach((section: any) => {
          section.fields?.forEach((field: any) => {
            map[field.key] = {
              label: field.label,
              type: field.type,
              options: field.ui?.options
            };
          });
        });
      });
    }
    return map;
  }, [formConfig]);

  // Get display value for a field
  const getDisplayValue = (key: string, value: any): string => {
    if (value === null || value === undefined || value === "") return "—";
    
    const field = fieldMap[key];
    if (field?.type === "enum" && field.options) {
      const option = field.options.find((opt: any) => opt.value === value);
      return option?.label || value;
    }
    if (field?.type === "boolean") {
      return value ? "Yes" : "No";
    }
    if (field?.type === "date") {
      return new Date(value).toLocaleDateString();
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  };

  // Flatten nested data for display
  const flattenData = (obj: any, prefix = ""): Array<{ key: string; label: string; value: any }> => {
    const result: Array<{ key: string; label: string; value: any }> = [];
    
    for (const [k, v] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${k}` : k;
      const field = fieldMap[fullKey];
      const label = field?.label || k.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
      
      if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
        result.push(...flattenData(v, fullKey));
      } else {
        result.push({ key: fullKey, label, value: v });
      }
    }
    
    return result;
  };

  const flatData = flattenData(formData);

  // Group data by section/page if form config exists
  const groupedData = useMemo(() => {
    if (!formConfig?.pages) {
      // Fallback: group by key prefix (capitalize first letter)
      const groups: Record<string, Array<{ key: string; label: string; value: any }>> = {};
      flatData.forEach(item => {
        const prefix = item.key.split(".")[0];
        if (!groups[prefix]) groups[prefix] = [];
        groups[prefix].push(item);
      });
      return Object.entries(groups).map(([title, items]) => ({ 
        title: title.charAt(0).toUpperCase() + title.slice(1).replace(/_/g, " "), 
        items 
      }));
    }

    const groups: Array<{ title: string; items: Array<{ key: string; label: string; value: any }> }> = [];
    
    formConfig.pages.forEach((page: any) => {
      page.sections?.forEach((section: any) => {
        const sectionItems: Array<{ key: string; label: string; value: any }> = [];
        section.fields?.forEach((field: any) => {
          const value = getNestedValue(formData, field.key);
          if (value !== undefined && value !== null && value !== "") {
            sectionItems.push({
              key: field.key,
              label: field.label,
              value
            });
          }
        });
        if (sectionItems.length > 0) {
          groups.push({ title: section.title || page.title, items: sectionItems });
        }
      });
    });
    
    return groups;
  }, [formConfig, formData, fieldMap]);

  // Early return for loading state — placed after ALL hooks
  if (!serviceConfig && application.service_key) {
    return (
      <>
        <a href="#citizen-main-application-detail" className="skip-link">
          {t("common.skip_to_main")}
        </a>
        <main id="citizen-main-application-detail" className="application-detail" role="main">
        <div className="detail-header">
          <div className="detail-title-section">
            <Breadcrumb items={[
              { label: t("app_detail.back"), onClick: onBack },
              { label: `Application ${application.arn}` }
            ]} />
            <h1><Bilingual tKey="app_detail.title" /></h1>
            <div className="detail-meta">
              <div className="meta-item">
                <span className="meta-label">{t("app_detail.arn")}</span>
                <span className="meta-value">{application.arn}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="detail-section">
          {isOffline ? (
            <Alert variant="warning">
              Offline mode is active. Cached application details are not available on this device yet.
            </Alert>
          ) : (
            <p>{t("app_detail.loading")}</p>
          )}
        </div>
        </main>
      </>
    );
  }

  function getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }

  function setNestedValue(obj: any, path: string, value: any): any {
    const keys = path.split(".");
    const updated = { ...obj };
    let current = updated;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    return updated;
  }

  const buildUpdatedData = () => {
    let updated: any = {};
    editableUnlockedFields.forEach((key) => {
      const value = getNestedValue(responseData, key);
      updated = setNestedValue(updated, key, value);
    });
    return updated;
  };

  const handleQueryResponse = async () => {
    if (!pendingQuery) return;
    if (isOffline) {
      setResponseError("You are offline. Query responses are disabled in read-only mode.");
      return;
    }
    setResponding(true);
    setResponseError(null);
    try {
      const updatedData = buildUpdatedData();
      const res = await fetch(
        `${apiBaseUrl}/api/v1/applications/${application.arn}/query-response`,
        {
          ...authHeaders(),
          method: "POST",
          body: JSON.stringify({
            queryId: pendingQuery.query_id,
            responseMessage,
            updatedData,
            userId
          })
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to respond to query");
      }
      setResponseMessage("");
      if (onQueryResponded) {
        onQueryResponded();
      }
    } catch (err) {
      setResponseError(err instanceof Error ? err.message : "Failed to respond to query");
    } finally {
      setResponding(false);
    }
  };

  // M3: Utilities imported from @puda/shared/utils
  const formatDate = formatDateTime;
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format(amount || 0);
  const outputDownloadUrl = `${apiBaseUrl}/api/v1/applications/${application.arn}/output/download`;

  const handleNdcPaymentPost = async (dueCode: string) => {
    if (isOffline) {
      setNdcPostingError("You are offline. Payment posting is unavailable.");
      return;
    }
    setNdcPostingDueCode(dueCode);
    setNdcPostingError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/applications/${application.arn}/pay-due`,
        {
          ...authHeaders(),
          method: "POST",
          body: JSON.stringify({ dueCode, userId }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || body?.error || `API error ${res.status}`);
      }
      setNdcPaymentStatus(body.paymentStatus || null);
      setNdcPostingError(null);
    } catch (err) {
      setNdcPostingError(err instanceof Error ? err.message : "Failed to post payment");
    } finally {
      setNdcPostingDueCode(null);
    }
  };

  // Generic payment initiation handler
  const handleInitiatePayment = async (demandId: string) => {
    if (isOffline) {
      setPaymentError(t("payment.offline_unavailable"));
      return;
    }
    setPaymentInitiating(demandId);
    setPaymentError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/payments`,
        {
          ...authHeaders(),
          method: "POST",
          body: JSON.stringify({
            arn: application.arn,
            demandId,
            mode: "GATEWAY",
            amount: feeDemands.find((d) => d.demand_id === demandId)?.total_amount || 0,
          }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || body?.error || `API error ${res.status}`);
      }
      // Refresh demands to reflect new payment status
      const refreshRes = await fetch(
        `${apiBaseUrl}/api/v1/fees/demands/for-application/${application.arn}`,
        authHeaders()
      );
      const refreshBody = await refreshRes.json().catch(() => ({}));
      if (refreshRes.ok) {
        setFeeDemands(Array.isArray(refreshBody.demands) ? refreshBody.demands : Array.isArray(refreshBody) ? refreshBody : []);
      }
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Failed to initiate payment");
    } finally {
      setPaymentInitiating(null);
    }
  };

  // Declaration form helpers
  const activeDeclarationDocType = declarationDocTypeId
    ? docTypes.find((dt: any) => dt.docTypeId === declarationDocTypeId)
    : null;
  const activeDeclarationTemplate = activeDeclarationDocType?.declarationTemplate || null;

  const handleDeclarationSubmit = async (filledFields: Record<string, string>) => {
    if (!declarationDocTypeId || isOffline) return;
    setDeclarationSubmitting(true);
    setDeclarationFeedback(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/applications/${application.arn}/declarations`,
        {
          ...authHeaders(),
          method: "POST",
          body: JSON.stringify({ docTypeId: declarationDocTypeId, filledFields }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || body?.error || `API error ${res.status}`);
      }
      setDeclarationFeedback({ variant: "success", text: t("declaration.success") });
      setDeclarationDocTypeId(null);
      // Trigger a refresh of documents by calling onQueryResponded which reloads the detail
      if (onQueryResponded) onQueryResponded();
    } catch (err) {
      setDeclarationFeedback({
        variant: "error",
        text: err instanceof Error ? err.message : t("declaration.error"),
      });
    } finally {
      setDeclarationSubmitting(false);
    }
  };

  return (
    <>
      <a href="#citizen-main-application-detail" className="skip-link">
        {t("common.skip_to_main")}
      </a>
      <main id="citizen-main-application-detail" className="application-detail" role="main">
      {/* Header */}
      <div className="detail-header">
        <div className="detail-title-section">
          <Breadcrumb items={[
            { label: t("app_detail.back"), onClick: onBack },
            { label: `${t("app_detail.title")} — ${application.arn}` }
          ]} />
          <h1><Bilingual tKey="app_detail.title" /></h1>
          <div className="detail-meta">
            <div className="meta-item">
              <span className="meta-label">{t("app_detail.arn")}</span>
              <span className="meta-value">{application.arn}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">{t("app_detail.service")}</span>
              <span className="meta-value">{serviceConfig?.displayName || application.service_key}</span>
            </div>
          </div>
          {application.state_id !== "DRAFT" && (
            <button
              type="button"
              className="receipt-download-btn"
              onClick={handleDownloadReceipt}
              disabled={generatingReceipt}
              aria-label={t("receipt.download")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {generatingReceipt ? t("receipt.downloading") : t("receipt.download")}
            </button>
          )}
        </div>
      </div>
      {feedback ? <Alert variant={feedback.variant} className="detail-feedback">{feedback.text}</Alert> : null}
      {isOffline ? (
        <Alert variant="warning" className="detail-feedback">
          Offline mode is active. Changes are disabled.
          {staleAt ? ` Showing cached data from ${new Date(staleAt).toLocaleString()}.` : ""}
        </Alert>
      ) : null}

      {/* Status Card */}
      <div className="detail-section status-card-section">
        <div className="status-card">
          <div className="status-header">
            <span className="status-label">{t("app_detail.current_status")}</span>
            <span className={`status-badge-large ${getStatusBadgeClass(application.state_id)}`}>
              {getStatusLabel(application.state_id)}
            </span>
          </div>
          <div className="status-dates">
            <div className="date-item">
              <span className="date-label">{t("app_detail.created")}</span>
              <span className="date-value">{formatDate(application.created_at)}</span>
            </div>
            {application.submitted_at && (
              <div className="date-item">
                <span className="date-label">{t("app_detail.submitted")}</span>
                <span className="date-value">{formatDate(application.submitted_at)}</span>
              </div>
            )}
            {application.disposed_at && (
              <div className="date-item">
                <span className="date-label">{t("app_detail.disposed")}</span>
                <span className="date-value">{formatDate(application.disposed_at)}</span>
              </div>
            )}
          </div>
          {application.submitted_at && !["APPROVED", "REJECTED", "DRAFT"].includes(application.state_id) && (() => {
            const daysSinceSubmission = Math.floor((Date.now() - new Date(application.submitted_at).getTime()) / (1000 * 60 * 60 * 24));
            const currentStage = detail.workflow_stages?.find(s => s.status === "current");
            const estimatedDays = currentStage?.slaDays || 30;
            const progressPercent = Math.min(100, Math.round((daysSinceSubmission / estimatedDays) * 100));
            return (
              <div className="sla-progress">
                <div className="sla-progress__bar">
                  <div className="sla-progress__fill" style={{ width: `${progressPercent}%` }} />
                </div>
                <span className="sla-progress__text">
                  {t("sla.day_of", { current: daysSinceSubmission, estimated: estimatedDays })}
                </span>
              </div>
            );
          })()}
          {application.state_id === "DRAFT" && onSubmit && (
            <Button onClick={onSubmit} className="submit-button-large" fullWidth disabled={isOffline}>
              {t("app_detail.submit")}
            </Button>
          )}
          {application.state_id === "DRAFT" && (
            <Button
              onClick={() => setWithdrawConfirmOpen(true)}
              className="withdraw-button"
              variant="danger"
              fullWidth
              disabled={isOffline || withdrawing}
            >
              {t("withdraw.button")}
            </Button>
          )}
          {withdrawFeedback && (
            <Alert variant={withdrawFeedback.variant} className="withdraw-feedback">
              {withdrawFeedback.text}
            </Alert>
          )}
        </div>
      </div>

      {/* Milestone Banners */}
      {application.disposal_type === "APPROVED" && (
        <div className="milestone-banner milestone-banner--approved" role="status">
          <div className="milestone-banner__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div className="milestone-banner__content">
            <h3 className="milestone-banner__title">{t("milestone.approved_title")}</h3>
            <p className="milestone-banner__desc">{t("milestone.approved_desc")}</p>
          </div>
        </div>
      )}
      {application.disposal_type === "REJECTED" && (
        <div className="milestone-banner milestone-banner--rejected" role="status">
          <div className="milestone-banner__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <div className="milestone-banner__content">
            <h3 className="milestone-banner__title">{t("milestone.rejected_title")}</h3>
            <p className="milestone-banner__desc">{t("milestone.rejected_desc")}</p>
          </div>
        </div>
      )}

      {/* Progress Tracker */}
      {detail.workflow_stages && detail.workflow_stages.length > 0 && (
        <div className="detail-section progress-tracker-section">
          <h2 className="section-title"><Bilingual tKey="timeline.progress" /></h2>
          <div className="progress-tracker">
            {detail.workflow_stages.map((stage, idx) => (
              <div
                key={stage.stateId}
                className={`progress-tracker__step progress-tracker__step--${stage.status}`}
              >
                <div className="progress-tracker__dot">
                  {stage.status === "completed" ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>
                <div className="progress-tracker__label">
                  <span className="progress-tracker__role">
                    {t(`stage.${(stage.systemRoleId || stage.stateId).toLowerCase()}`, { defaultValue: (stage.systemRoleId || stage.stateId).replace(/_/g, " ") })}
                  </span>
                  {stage.slaDays && (
                    <span className="progress-tracker__sla">
                      {t("timeline.estimated_days", { count: stage.slaDays, defaultValue: `~${stage.slaDays} days` })}
                    </span>
                  )}
                </div>
                {idx < detail.workflow_stages!.length - 1 && <div className="progress-tracker__connector" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Who Has My File */}
      {detail.current_handler && (
        <div className="detail-section handler-card">
          <div className="handler-card__header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="handler-card__icon"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <h3><Bilingual tKey="handler.currently_with" /></h3>
          </div>
          <div className="handler-card__body">
            {detail.current_handler.officer_name ? (
              <p className="handler-card__name">{detail.current_handler.officer_name}</p>
            ) : (
              <p className="handler-card__awaiting">{t("handler.awaiting_assignment", { role: detail.current_handler.role_id.replace(/_/g, " "), defaultValue: `Awaiting assignment to ${detail.current_handler.role_id.replace(/_/g, " ")}` })}</p>
            )}
            <p className="handler-card__role">
              {t(`stage.${detail.current_handler.role_id.toLowerCase()}`, { defaultValue: detail.current_handler.role_id.replace(/_/g, " ") })}
            </p>
            <p className="handler-card__since">
              {t("handler.since", { defaultValue: "Since" })}: {new Date(detail.current_handler.since).toLocaleDateString()} ({t("handler.days", { count: detail.current_handler.days_in_stage, defaultValue: `${detail.current_handler.days_in_stage} days` })})
            </p>
          </div>
        </div>
      )}

      {/* Inspection Visibility for Citizens (C5) */}
      {citizenInspections.length > 0 && (
        <div className="detail-section inspection-section">
          <h2 className="section-title"><Bilingual tKey="citizen_inspection.title" /></h2>
          <div className="inspection-cards">
            {citizenInspections.map((insp) => {
              const statusKey =
                insp.status === "SCHEDULED" ? "citizen_inspection.scheduled" :
                insp.status === "IN_PROGRESS" ? "citizen_inspection.in_progress" :
                insp.status === "COMPLETED" ? "citizen_inspection.completed" :
                insp.status;
              return (
                <Card key={insp.inspection_id} className="inspection-card">
                  <div className="inspection-card__row">
                    <span className="inspection-card__label">{t("citizen_inspection.type")}</span>
                    <span className="inspection-card__value">{insp.inspection_type?.replace(/_/g, " ") || "--"}</span>
                  </div>
                  <div className="inspection-card__row">
                    <span className="inspection-card__label">{t("citizen_inspection.status")}</span>
                    <span className={`inspection-card__value badge ${insp.status === "COMPLETED" ? "badge-approved" : "badge-pending"}`}>
                      {t(statusKey, { defaultValue: insp.status })}
                    </span>
                  </div>
                  {insp.scheduled_at && (
                    <div className="inspection-card__row">
                      <span className="inspection-card__label">{t("citizen_inspection.scheduled")}</span>
                      <span className="inspection-card__value">{new Date(insp.scheduled_at).toLocaleDateString()}</span>
                    </div>
                  )}
                  {insp.outcome && (
                    <div className="inspection-card__row">
                      <span className="inspection-card__label">{t("citizen_inspection.outcome")}</span>
                      <span className="inspection-card__value">{insp.outcome.replace(/_/g, " ")}</span>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {application.service_key === "no_due_certificate" && (ndcPaymentStatusLoading || ndcPaymentStatus) && (
        <div className="detail-section" id="ndc-payment-ledger">
          <h2 className="section-title"><Bilingual tKey="ndc.payment_status" /></h2>
          {ndcPaymentStatusLoading ? (
            <div style={{ display: "grid", gap: "var(--space-2)" }}>
              <div className="ui-skeleton" style={{ height: "2.6rem" }} />
              <div className="ui-skeleton" style={{ height: "8rem" }} />
            </div>
          ) : null}
          {ndcPaymentStatusError ? <Alert variant="warning">{ndcPaymentStatusError}</Alert> : null}
          {ndcPaymentStatus ? (
            <>
              <div className="ndc-summary-grid">
                <Card className="ndc-summary-card">
                  <span className="ndc-summary-label">{t("ndc.total_due")}</span>
                  <strong className="ndc-summary-value">
                    {formatCurrency(ndcPaymentStatus.totals.totalDueAmount)}
                  </strong>
                </Card>
                <Card className="ndc-summary-card">
                  <span className="ndc-summary-label">{t("ndc.total_paid")}</span>
                  <strong className="ndc-summary-value">
                    {formatCurrency(ndcPaymentStatus.totals.paidAmount)}
                  </strong>
                </Card>
                <Card className="ndc-summary-card">
                  <span className="ndc-summary-label">{t("ndc.pending_balance")}</span>
                  <strong className="ndc-summary-value">
                    {formatCurrency(ndcPaymentStatus.totals.balanceAmount)}
                  </strong>
                </Card>
              </div>
              <p className="timeline-note">
                Allotment Date: {ndcPaymentStatus.allotmentDate || "—"} | Property Value: {formatCurrency(ndcPaymentStatus.propertyValue)} | Interest Rate: {ndcPaymentStatus.annualInterestRatePct}% p.a. | DCF Rate: {ndcPaymentStatus.dcfRatePct}%
              </p>

              {ndcPaymentStatus.certificateEligible ? (
                <Alert variant="success">
                  {t("ndc.certificate_eligible")}
                </Alert>
              ) : (
                <Alert variant="warning">
                  {t("ndc.dues_pending")}
                </Alert>
              )}

              <div className="ndc-payment-actions">
                {ndcPaymentStatus.certificateEligible ? (
                  <button
                    type="button"
                    className="download-cert-link-large"
                    onClick={() => handleDownload(outputDownloadUrl, `NDC-${application.arn.replace(/\//g, "-")}.pdf`)}
                    disabled={downloading}
                  >
                    {downloading ? t("ndc.downloading") : t("ndc.download_ndc")}
                  </button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() => setShowNdcPaymentPage(true)}
                    className="submit-button-large"
                  >
                    {t("ndc.go_to_payment")}
                  </Button>
                )}
              </div>

              <div className="ndc-ledger-table-wrap">
                <table className="ndc-ledger-table">
                  <thead>
                    <tr>
                      <th>Due Type</th>
                      <th>Due Date</th>
                      <th>Payment Date</th>
                      <th>Delay (Days)</th>
                      <th>Base</th>
                      <th>Interest</th>
                      <th>Total Due</th>
                      <th>Paid</th>
                      <th>Balance</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ndcPaymentStatus.dues.map((due) => (
                      <tr key={due.dueCode}>
                        <td data-label="Due Type">{due.label}</td>
                        <td data-label="Due Date">{due.dueDate}</td>
                        <td data-label="Payment Date">{due.paymentDate || "—"}</td>
                        <td data-label="Delay (Days)">{due.daysDelayed}</td>
                        <td data-label="Base">{formatCurrency(due.baseAmount)}</td>
                        <td data-label="Interest">{formatCurrency(due.interestAmount)}</td>
                        <td data-label="Total Due">{formatCurrency(due.totalDueAmount)}</td>
                        <td data-label="Paid">{formatCurrency(due.paidAmount)}</td>
                        <td data-label="Balance">{formatCurrency(due.balanceAmount)}</td>
                        <td data-label="Status">{due.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      )}

      {application.service_key === "no_due_certificate" && showNdcPaymentPage && ndcPaymentStatus ? (
        <div className="detail-section" id="ndc-payment-page">
          <h2 className="section-title"><Bilingual tKey="ndc.payment_page" /></h2>
          <p className="timeline-note">{t("ndc.payment_page_desc")}</p>
          {ndcPostingError ? <Alert variant="warning">{ndcPostingError}</Alert> : null}
          <div className="read-card-list">
            {ndcPaymentStatus.dues.filter((due) => due.balanceAmount > 0.01).length === 0 ? (
              <Alert variant="success">{t("ndc.all_settled")}</Alert>
            ) : null}
            {ndcPaymentStatus.dues
              .filter((due) => due.balanceAmount > 0.01)
              .map((due) => (
                <Card key={`pending-${due.dueCode}`} className="read-only-card">
                  <div className="read-card-header">
                    <p className="read-card-title">{due.label}</p>
                    <span className="status-badge badge-query">Pending</span>
                  </div>
                  <div className="read-card-grid">
                    <div className="read-meta-row">
                      <span className="read-meta-key">{t("ndc.due_date")}</span>
                      <span className="read-meta-value">{due.dueDate}</span>
                    </div>
                    <div className="read-meta-row">
                      <span className="read-meta-key">{t("ndc.payable_amount")}</span>
                      <span className="read-meta-value">{formatCurrency(due.balanceAmount)}</span>
                    </div>
                  </div>
                  <div className="query-response-actions" style={{ marginTop: "var(--space-2)" }}>
                    <Button
                      variant="primary"
                      className="submit-button-large"
                      onClick={() => void handleNdcPaymentPost(due.dueCode)}
                      disabled={isOffline || Boolean(ndcPostingDueCode)}
                    >
                      {ndcPostingDueCode === due.dueCode ? t("ndc.posting") : `${t("ndc.pay")} ${formatCurrency(due.balanceAmount)}`}
                    </Button>
                  </div>
                </Card>
              ))}
          </div>
          <Button variant="ghost" onClick={() => setShowNdcPaymentPage(false)}>
            {t("ndc.back_to_status")}
          </Button>
        </div>
      ) : null}

      {/* Generic Fee Payment Section (non-NDC services with feeSchedule) */}
      {hasFeeSchedule && application.state_id !== "DRAFT" && (
        <div className="detail-section" id="fee-payment-section">
          <h2 className="section-title"><Bilingual tKey="payment.title" /></h2>

          {feeDemandsLoading ? (
            <div style={{ display: "grid", gap: "var(--space-2)" }}>
              <div className="ui-skeleton" style={{ height: "2.6rem" }} />
              <div className="ui-skeleton" style={{ height: "6rem" }} />
            </div>
          ) : null}

          {feeDemandsError ? <Alert variant="warning">{feeDemandsError}</Alert> : null}

          {!feeDemandsLoading && !feeDemandsError && feeDemands.length === 0 && (
            <>
              {/* Show fee schedule from config when no demands exist yet */}
              <div className="fee-breakdown-card">
                <h3 className="fee-breakdown-title">{t("payment.fee_breakdown")}</h3>
                <div className="fee-breakdown-lines">
                  {(serviceConfig?.feeSchedule?.default || []).map((fee: FeeItem, idx: number) => (
                    <div key={idx} className="fee-breakdown-row">
                      <span className="fee-breakdown-label">{fee.description || fee.feeType}</span>
                      <span className="fee-breakdown-amount">{formatCurrency(fee.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="fee-breakdown-row fee-breakdown-total">
                  <span className="fee-breakdown-label">{t("payment.total")}</span>
                  <strong className="fee-breakdown-amount">
                    {formatCurrency(
                      (serviceConfig?.feeSchedule?.default || []).reduce(
                        (sum: number, fee: FeeItem) => sum + (fee.amount || 0), 0
                      )
                    )}
                  </strong>
                </div>
              </div>
              <Alert variant="info">{t("payment.status_pending")}</Alert>
            </>
          )}

          {!feeDemandsLoading && feeDemands.length > 0 && (
            <div className="fee-demands-list">
              {feeDemands.map((demand) => {
                const isPaid = demand.status === "PAID" || demand.status === "WAIVED";
                const remaining = demand.total_amount - demand.paid_amount;
                return (
                  <Card key={demand.demand_id} className={`read-only-card fee-demand-card ${isPaid ? "fee-demand-paid" : ""}`}>
                    <div className="read-card-header">
                      <p className="read-card-title">
                        {demand.demand_number || demand.demand_id.slice(0, 8)}
                      </p>
                      <span className={`doc-verification-badge ${isPaid ? "status-verified" : demand.status === "PARTIALLY_PAID" ? "status-query" : "status-pending"}`}>
                        {isPaid
                          ? t("payment.status_completed")
                          : demand.status === "PARTIALLY_PAID"
                            ? t("payment.status_pending")
                            : t("payment.status_pending")
                        }
                      </span>
                    </div>

                    {/* Fee breakdown lines */}
                    {demand.lineItems && demand.lineItems.length > 0 && (
                      <div className="fee-breakdown-lines">
                        {demand.lineItems.map((li, idx) => (
                          <div key={idx} className="fee-breakdown-row">
                            <span className="fee-breakdown-label">{li.description || li.fee_head_code}</span>
                            <span className="fee-breakdown-amount">{formatCurrency(li.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="read-card-grid">
                      <div className="read-meta-row">
                        <span className="read-meta-key">{t("payment.total")}</span>
                        <span className="read-meta-value">{formatCurrency(demand.total_amount)}</span>
                      </div>
                      {demand.paid_amount > 0 && (
                        <div className="read-meta-row">
                          <span className="read-meta-key">{t("payment.paid_amount")}</span>
                          <span className="read-meta-value">{formatCurrency(demand.paid_amount)}</span>
                        </div>
                      )}
                      {!isPaid && remaining > 0.01 && (
                        <div className="read-meta-row">
                          <span className="read-meta-key">{t("payment.remaining")}</span>
                          <strong className="read-meta-value">{formatCurrency(remaining)}</strong>
                        </div>
                      )}
                    </div>

                    {!isPaid && remaining > 0.01 && (
                      <div className="fee-demand-actions">
                        <p className="timeline-note">{t("payment.gateway_redirect")}</p>
                        <Button
                          variant="primary"
                          className="submit-button-large"
                          onClick={() => void handleInitiatePayment(demand.demand_id)}
                          disabled={isOffline || Boolean(paymentInitiating)}
                        >
                          {paymentInitiating === demand.demand_id
                            ? t("payment.initiating")
                            : `${t("payment.pay_now")} ${formatCurrency(remaining)}`
                          }
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {paymentError ? <Alert variant="error">{paymentError}</Alert> : null}
        </div>
      )}

      {/* Application Data */}
      {groupedData.length > 0 && (
        <div className="detail-section">
          <h2 className="section-title"><Bilingual tKey="app_detail.info" /></h2>
          <div className="data-groups">
            {groupedData.map((group, idx) => (
              <div key={idx} className="data-group">
                <h3 className="group-title">{group.title}</h3>
                <div className="data-fields">
                  {group.items.map((item) => (
                    <div key={item.key} className="data-field">
                      <div className="field-label">{item.label}</div>
                      <div className="field-value">{getDisplayValue(item.key, item.value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Queries */}
      <div className="detail-section">
        <h2 className="section-title"><Bilingual tKey="app_detail.queries" /> ({queries.length})</h2>
        {queries.length > 0 ? (
          <div className="read-card-list">
            {queries.map((query: any) => (
              <Card key={query.query_id} className={`read-only-card query-read-card ${query.status === "PENDING" ? "query-pending" : ""}`}>
                <div className="read-card-header">
                  <p className="read-card-title">{t("app_detail.query_number", { number: query.query_number })}</p>
                  <span className={`query-status ${query.status === "PENDING" ? "status-pending" : "status-responded"}`}>
                    {query.status === "PENDING" ? t("app_detail.pending_response") : t("app_detail.responded")}
                  </span>
                </div>
                <p className="read-card-body">{query.message}</p>
                <div className="read-card-grid">
                  <div className="read-meta-row">
                    <span className="read-meta-key">{t("app_detail.raised_at")}</span>
                    <span className="read-meta-value">
                      {query.raised_at ? formatDate(query.raised_at) : "—"}
                    </span>
                  </div>
                  <div className="read-meta-row">
                    <span className="read-meta-key">{t("app_detail.response_due")}</span>
                    <span className="read-meta-value">
                      {query.response_due_at ? new Date(query.response_due_at).toLocaleDateString() : "—"}
                    </span>
                  </div>
                  <div className="read-meta-row">
                    <span className="read-meta-key">{t("app_detail.responded_at")}</span>
                    <span className="read-meta-value">
                      {query.responded_at ? formatDate(query.responded_at) : "—"}
                    </span>
                  </div>
                </div>
                {query.responded_at && (
                  <div className="query-response read-card-response">
                    <div className="response-label">{t("app_detail.your_response")}:</div>
                    <div className="response-text">{query.response_remarks || "Response submitted"}</div>
                    <div className="response-date">{t("app_detail.responded_on")}: {new Date(query.responded_at).toLocaleDateString()}</div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <Alert variant="info" className="detail-empty-alert">
            {t("app_detail.no_queries")}
          </Alert>
        )}
      </div>

      {pendingQuery && application.state_id === "QUERY_PENDING" && (
        <div className="detail-section">
          <h2 className="section-title"><Bilingual tKey="app_detail.respond_to_query" /></h2>
          <Alert variant="info" className="query-pending-message">{pendingQuery.message}</Alert>
          {editableUnlockedFields.length > 0 && (
            <div className="query-response-form">
              {editableUnlockedFields.map((fieldKey) => {
                const field = fieldMap[fieldKey];
                const value = getNestedValue(responseData, fieldKey);
                const label = field?.label || fieldKey;
                const type = field?.type || "string";
                const fieldId = `query-field-${fieldKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
                return (
                  <div key={fieldKey}>
                    {type === "boolean" ? (
                      <label className="checkbox-field" htmlFor={fieldId}>
                        <input
                          id={fieldId}
                          type="checkbox"
                          checked={Boolean(value)}
                          disabled={isOffline || responding}
                          onChange={(e) =>
                            setResponseData((prev: any) => setNestedValue(prev, fieldKey, e.target.checked))
                          }
                        />
                        <span>{label}</span>
                      </label>
                    ) : (
                      <Field label={label} htmlFor={fieldId}>
                        <Input
                          id={fieldId}
                          type={type === "number" ? "number" : type === "date" ? "date" : "text"}
                          value={value ?? ""}
                          disabled={isOffline || responding}
                          onChange={(e) => {
                            const nextValue = type === "number" ? Number(e.target.value) : e.target.value;
                            setResponseData((prev: any) => setNestedValue(prev, fieldKey, nextValue));
                          }}
                        />
                      </Field>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {applicantLockedFields.length > 0 && (
            <Alert variant="warning">
              Applicant details are read-only. Please update your profile to change applicant information.
            </Alert>
          )}
          <Field label={<Bilingual tKey="app_detail.response_message" />} htmlFor="query-response-message" required>
            <Textarea
              id="query-response-message"
              value={responseMessage}
              disabled={isOffline || responding}
              onChange={(e) => setResponseMessage(e.target.value)}
              rows={3}
            />
          </Field>
          {responseError ? <Alert variant="error">{responseError}</Alert> : null}
          <div className="query-response-actions">
            <Button
              className="submit-button-large"
              onClick={handleQueryResponse}
              disabled={isOffline || responding || !responseMessage.trim()}
              fullWidth
            >
              {responding ? t("app_detail.submitting") : t("app_detail.submit_response")}
            </Button>
          </div>
        </div>
      )}

      {/* Documents */}
      <div className="detail-section">
        <h2 className="section-title"><Bilingual tKey="app_detail.documents" /> ({documents.length})</h2>
        {documents.length > 0 ? (
          <div className="read-card-list">
            {documents.map((doc: any) => {
              const verStatus = doc.verification_status || "PENDING";
              const badgeClass = verStatus === "VERIFIED" ? "status-verified" : verStatus === "REJECTED" ? "status-rejected" : verStatus === "QUERY" ? "status-query" : "status-pending";
              return (
              <Card key={doc.doc_id} className={`read-only-card document-read-card ${verStatus === "REJECTED" || verStatus === "QUERY" ? "doc-action-required" : ""}`}>
                <div className="read-card-header">
                  <p className="read-card-title">{doc.original_filename || doc.doc_id}</p>
                  <span className={`doc-verification-badge ${badgeClass}`}>{verStatus === "VERIFIED" ? "Verified" : verStatus === "REJECTED" ? "Rejected" : verStatus === "QUERY" ? "Query" : "Pending"}</span>
                </div>
                {(verStatus === "REJECTED" || verStatus === "QUERY") && doc.verification_remarks && (
                  <Alert variant={verStatus === "REJECTED" ? "error" : "warning"} className="doc-remarks-alert">
                    {verStatus === "REJECTED" ? "Rejected" : "Query"} — {doc.verification_remarks}
                    {verStatus === "REJECTED" && ". Please re-upload a corrected copy."}
                  </Alert>
                )}
                <div className="read-card-grid">
                  <div className="read-meta-row">
                    <span className="read-meta-key">{t("app_detail.doc_type")}</span>
                    <span className="read-meta-value">{doc.doc_type_id || "—"}</span>
                  </div>
                  <div className="read-meta-row">
                    <span className="read-meta-key">{t("app_detail.doc_id")}</span>
                    <span className="read-meta-value">{doc.doc_id}</span>
                  </div>
                </div>
                <div className="doc-download-row">
                  <a
                    href={`${apiBaseUrl}/api/v1/documents/${doc.doc_id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="doc-download"
                  >
                    {t("app_detail.download")}
                  </a>
                </div>
              </Card>
              );
            })}
          </div>
        ) : (
          <Alert variant="info" className="detail-empty-alert">
            {t("app_detail.no_documents")}
          </Alert>
        )}
        {/* Re-upload alerts for queried/rejected documents */}
        {documents.some((doc: any) => doc.verification_status === "QUERY" || doc.verification_status === "REJECTED") && (
          <Alert variant="warning" className="doc-remarks-alert">
            Action required: Some documents need your attention. Please review the remarks above and re-upload corrected copies below.
          </Alert>
        )}
        {canUpload && allowedDocTypes.length > 0 && (
          <DocumentUploadPanel
            mode="full"
            documentTypes={docTypes}
            citizenDocuments={citizenDocuments}
            applicationDocuments={documents}
            onDocumentUpload={onDocumentUpload}
            onReuseDocument={onReuseDocument}
            uploading={uploading}
            uploadProgress={uploadProgress}
            isOffline={isOffline}
            unlockedDocTypeIds={unlockedDocTypes}
            applicationStateId={application.state_id}
            onDeclarationStart={(docTypeId) => {
              setDeclarationFeedback(null);
              setDeclarationDocTypeId(docTypeId);
            }}
          />
        )}
        {application.state_id === "QUERY_PENDING" && unlockedDocTypes.length === 0 && (
          <Alert variant="warning">No documents are unlocked for upload in this query.</Alert>
        )}
      </div>

      {/* Timeline */}
      <div className="detail-section">
        <h2 className="section-title"><Bilingual tKey="app_detail.timeline" /> ({timelineEvents.length})</h2>
        {timelineEvents.length > 0 ? (
          <>
            <p className="timeline-note">Showing the most recent {visibleTimeline.length} events.</p>
            <div className="read-card-list">
              {visibleTimeline.map((event: any, idx: number) => (
                <Card key={idx} className="read-only-card timeline-read-card">
                  <p className="read-card-title">{event.event_type || "Timeline Event"}</p>
                  <div className="read-card-grid">
                    <div className="read-meta-row">
                      <span className="read-meta-key">{t("app_detail.timestamp")}</span>
                      <span className="read-meta-value" title={event.created_at ? formatDate(event.created_at) : ""}>
                        {event.created_at ? timeAgo(event.created_at) : "—"}
                      </span>
                    </div>
                    <div className="read-meta-row">
                      <span className="read-meta-key">{t("app_detail.actor_type")}</span>
                      <span className="read-meta-value">{event.actor_type || "System"}</span>
                    </div>
                    <div className="read-meta-row">
                      <span className="read-meta-key">{t("app_detail.actor")}</span>
                      <span className="read-meta-value">{event.actor_id || "System"}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <Alert variant="info" className="detail-empty-alert">
            {t("app_detail.no_timeline")}
          </Alert>
        )}
      </div>

      {/* Output Download */}
      {(application.disposal_type === "APPROVED" ||
        application.disposal_type === "REJECTED" ||
        (application.service_key === "no_due_certificate" && ndcPaymentStatus?.certificateEligible)) && (
        <div className="detail-section">
          {downloadError && <p className="error-message" style={{ marginBottom: "var(--space-2)" }}>{downloadError}</p>}
          <button
            type="button"
            className="download-cert-link-large"
            onClick={() => handleDownload(
              outputDownloadUrl,
              `${application.disposal_type === "REJECTED" ? "Order" : "Certificate"}-${application.arn.replace(/\//g, "-")}.pdf`
            )}
            disabled={downloading}
          >
            {downloading ? t("ndc.downloading") : (application.disposal_type === "REJECTED" ? t("download_order") : t("download_certificate"))}
          </button>
        </div>
      )}
      {/* Declaration feedback */}
      {declarationFeedback && (
        <Alert variant={declarationFeedback.variant} className="detail-feedback" style={{ marginTop: "var(--space-3)" }}>
          {declarationFeedback.text}
        </Alert>
      )}
      </main>

      {/* Declaration Form Panel overlay */}
      {activeDeclarationTemplate && declarationDocTypeId && (
        <DeclarationFormPanel
          template={activeDeclarationTemplate}
          applicationData={formData}
          submitting={declarationSubmitting}
          onSubmit={handleDeclarationSubmit}
          onCancel={() => setDeclarationDocTypeId(null)}
        />
      )}

      {/* Withdrawal Confirmation Modal (C3) */}
      <Modal
        open={withdrawConfirmOpen}
        onClose={() => setWithdrawConfirmOpen(false)}
        title={t("withdraw.confirm_title")}
        description={t("withdraw.confirm_message")}
        actions={
          <>
            <Button type="button" variant="ghost" onClick={() => setWithdrawConfirmOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => void handleWithdraw()}
              disabled={withdrawing}
            >
              {withdrawing ? t("common.loading") : t("withdraw.button")}
            </Button>
          </>
        }
      />
    </>
  );
}
