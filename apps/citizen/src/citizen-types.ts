export type ServiceSummary = {
  serviceKey: string;
  displayName: string;
  category: string;
  description?: string;
  submissionValidation?: { propertyRequired?: boolean };
};

export type FeedbackMessage = {
  variant: "info" | "success" | "warning" | "error";
  text: string;
};

export type Application = {
  arn: string;
  service_key: string;
  state_id: string;
  data_jsonb: any;
  created_at: string;
  submitted_at?: string;
  disposal_type?: string;
  documents?: { doc_id: string; doc_type_id: string; original_filename: string }[];
  /** Optimistic concurrency token — must be sent back on updates. */
  rowVersion?: number;
};

export type ResumeSnapshot = {
  view: "catalog" | "create" | "track" | "applications" | "locker" | "settings" | "profile" | "complaints";
  showDashboard: boolean;
  selectedService: ServiceSummary | null;
  currentApplication: Application | null;
  formData: any;
  updatedAt: string;
};

export type NdcDueLine = {
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

export type NdcPaymentStatus = {
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

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
const RESUME_STATE_VERSION = "v1";
export const CACHE_SCHEMAS = {
  services: "citizen-services-v1",
  serviceConfig: "citizen-service-config-v1",
  profile: "citizen-profile-v1",
  applications: "citizen-applications-v1",
  applicationDetail: "citizen-application-detail-v1",
  resume: "citizen-resume-v1"
} as const;
export const CACHE_TTL_MS = {
  services: 7 * 24 * 60 * 60 * 1000,
  serviceConfig: 7 * 24 * 60 * 60 * 1000,
  profile: 24 * 60 * 60 * 1000,
  applications: 6 * 60 * 60 * 1000,
  applicationDetail: 6 * 60 * 60 * 1000,
  resume: 7 * 24 * 60 * 60 * 1000
} as const;

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isServiceSummaryArray(value: unknown): value is ServiceSummary[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.serviceKey === "string" &&
        typeof item.displayName === "string" &&
        typeof item.category === "string"
    )
  );
}

export function isApplicationPayload(value: unknown): value is Application {
  return (
    isRecord(value) &&
    typeof value.arn === "string" &&
    typeof value.service_key === "string" &&
    typeof value.state_id === "string" &&
    typeof value.created_at === "string"
  );
}

export function isApplicationArray(value: unknown): value is Application[] {
  return Array.isArray(value) && value.every((item) => isApplicationPayload(item));
}

export function isProfilePayload(value: unknown): value is { applicant?: Record<string, unknown>; completeness?: { isComplete?: boolean; missingFields?: string[] } } {
  if (!isRecord(value)) return false;
  if ("applicant" in value && value.applicant !== undefined && !isRecord(value.applicant)) return false;
  if ("completeness" in value && value.completeness !== undefined) {
    if (!isRecord(value.completeness)) return false;
    if ("isComplete" in value.completeness && typeof value.completeness.isComplete !== "boolean") return false;
    if (
      "missingFields" in value.completeness &&
      value.completeness.missingFields !== undefined &&
      !isStringArray(value.completeness.missingFields)
    ) {
      return false;
    }
  }
  return true;
}

export function isServiceConfigPayload(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  if ("form" in value && value.form !== undefined && value.form !== null) {
    if (!isRecord(value.form)) return false;
    if (!Array.isArray(value.form.pages)) return false;
  }
  return true;
}

export function isResumeSnapshotPayload(value: unknown): value is ResumeSnapshot {
  return (
    isRecord(value) &&
    (value.view === "catalog" || value.view === "create" || value.view === "track" || value.view === "applications" || value.view === "locker" || value.view === "settings" || value.view === "profile" || value.view === "guide" || value.view === "complaints") &&
    typeof value.showDashboard === "boolean" &&
    "formData" in value &&
    typeof value.updatedAt === "string" &&
    (value.selectedService === null ||
      (isRecord(value.selectedService) &&
        typeof value.selectedService.serviceKey === "string" &&
        typeof value.selectedService.displayName === "string" &&
        typeof value.selectedService.category === "string")) &&
    (value.currentApplication === null || isApplicationPayload(value.currentApplication))
  );
}

export function serviceCacheKey() {
  return "puda_citizen_cache_services";
}

export function serviceConfigCacheKey(serviceKey: string) {
  return `puda_citizen_cache_service_config_${serviceKey}`;
}

export function applicationsCacheKey(userId: string) {
  return `puda_citizen_cache_applications_${userId}`;
}

export function profileCacheKey(userId: string) {
  return `puda_citizen_cache_profile_${userId}`;
}

export function applicationDetailCacheKey(userId: string, arn: string) {
  return `puda_citizen_cache_application_detail_${userId}_${arn}`;
}

export function resumeStateKey(userId: string) {
  return `puda_citizen_resume_${RESUME_STATE_VERSION}_${userId}`;
}

export function lastSyncKey(userId: string) {
  return `puda_citizen_last_sync_${userId}`;
}
