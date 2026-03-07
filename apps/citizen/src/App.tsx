import { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import "./app.css";
import {
  Alert,
  Button,
  Card,
  Modal,
  ConfirmDialog,
  Drawer,
  Input,
  Select,
  useToast,
  useIdleTimeout,
  SkeletonBlock,
  parseHash,
  buildHash,
  pushHash,
  replaceHash,
  isSuppressed,
  validateView
} from "@puda/shared";
import { formatDate, getServiceDisplayName } from "@puda/shared/utils";
import type { CitizenProperty } from "@puda/shared/form-renderer";
import { useTranslation } from "react-i18next";
import { ensureLocaleLoaded } from "./i18n";
import { useAuth } from "./AuthContext";
import Login from "./Login";
import ThemeToggle from "./ThemeToggle";
import { SecondaryLanguageProvider } from "./SecondaryLanguageContext";
import { Bilingual } from "./Bilingual";

const Dashboard = lazy(() => import("./Dashboard"));
const DocumentLocker = lazy(() => import("./DocumentLocker"));
const Settings = lazy(() => import("./Settings"));
const ReportComplaint = lazy(() => import("./ReportComplaint"));
import AllApplications from "./AllApplications";
import ServiceCatalog from "./ServiceCatalog";
import CreateApplication from "./CreateApplication";
import TrackApplication from "./TrackApplication";
import ProfileView from "./ProfileView";
import { useTheme } from "./theme";
import { usePreferences } from "./preferences";
import "./i18n";
import { readCached, writeCached, readOfflineDrafts, writeOfflineDraft, markOfflineDraftSynced, removeOfflineDraft, getUnsyncedDraftCount } from "./cache";
import { flushCacheTelemetryWithRetry, incrementCacheTelemetry } from "./cacheTelemetry";
import {
  type ServiceSummary, type FeedbackMessage, type Application, type ResumeSnapshot,
  type NdcDueLine, type NdcPaymentStatus,
  apiBaseUrl, CACHE_SCHEMAS, CACHE_TTL_MS,
  isServiceSummaryArray, isApplicationPayload, isApplicationArray,
  isProfilePayload, isServiceConfigPayload, isResumeSnapshotPayload,
  serviceCacheKey, serviceConfigCacheKey, applicationsCacheKey,
  profileCacheKey, applicationDetailCacheKey, resumeStateKey, lastSyncKey,
} from "./citizen-types";

export default function App() {
  const { user, isLoading, logout, authHeaders } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme("puda_citizen_theme");
  const { preferences, updatePreference } = usePreferences(apiBaseUrl, authHeaders, user?.user_id);
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  type ViewId = "catalog" | "create" | "track" | "applications" | "locker" | "settings" | "profile" | "profile-update" | "guide" | "complaints";
  type ViewSnapshot = { view: ViewId; showDashboard: boolean };
  const [view, setView] = useState<ViewId>("catalog");
  const navStackRef = useRef<ViewSnapshot[]>([]);
  const navDirectionRef = useRef<"push" | "replace" | "none">("push");
  const hashInitializedRef = useRef(false);
  const formDirtyRef = useRef(false);
  const deepLinkAppliedRef = useRef(false);
  const [lockerFilter, setLockerFilter] = useState<string | undefined>(undefined);
  const [selectedService, setSelectedService] = useState<ServiceSummary | null>(null);
  const [serviceConfig, setServiceConfig] = useState<any>(null);
  const [currentApplication, setCurrentApplication] = useState<Application | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [formDirty, setFormDirty] = useState(false);
  const [unsavedConfirmOpen, setUnsavedConfirmOpen] = useState(false);
  const pendingNavRef = useRef<(() => void) | null>(null);
  const [applicationDetail, setApplicationDetail] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formStep, setFormStep] = useState<"form" | "documents">("form");
  const [configLoading, setConfigLoading] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const [citizenProperties, setCitizenProperties] = useState<CitizenProperty[]>([]);
  const [citizenDocuments, setCitizenDocuments] = useState<any[]>([]);

  const [profileApplicant, setProfileApplicant] = useState<any>({});
  const [profileAddresses, setProfileAddresses] = useState<any>({});
  const [profileComplete, setProfileComplete] = useState(true);
  const [profileMissingFields, setProfileMissingFields] = useState<string[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [profileEditorSaving, setProfileEditorSaving] = useState(false);
  const [profileEditorError, setProfileEditorError] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState<Record<string, any>>({});
  const [profileVerification, setProfileVerification] = useState<any>({});
  const [profileCompleteness, setProfileCompleteness] = useState<any>(null);
  const [profileUpdateSection, setProfileUpdateSection] = useState<string | null>(null);
  const onboardingRedirectDone = useRef(false);
  const [ndcPaymentStatus, setNdcPaymentStatus] = useState<NdcPaymentStatus | null>(null);
  const [ndcPaymentStatusLoading, setNdcPaymentStatusLoading] = useState(false);
  const [ndcPaymentStatusError, setNdcPaymentStatusError] = useState<string | null>(null);
  const [ndcPaymentPostingDueCode, setNdcPaymentPostingDueCode] = useState<string | null>(null);
  const [ndcPaymentPostingError, setNdcPaymentPostingError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [usingStaleData, setUsingStaleData] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() => getUnsyncedDraftCount());
  const [draftConflictArn, setDraftConflictArn] = useState<string | null>(null);
  const [resolvingDraftConflict, setResolvingDraftConflict] = useState(false);
  const [appSearchQuery, setAppSearchQuery] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [appStatusFilter, setAppStatusFilter] = useState("");
  const [submissionConfirmation, setSubmissionConfirmation] = useState<{
    arn: string;
    serviceName: string;
    submittedAt: string;
  } | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const avatarBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!avatarMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (
        avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node) &&
        avatarBtnRef.current && !avatarBtnRef.current.contains(e.target as Node)
      ) setAvatarMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setAvatarMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [avatarMenuOpen]);

  const [duplicateWarning, setDuplicateWarning] = useState<{
    serviceKey: string;
    applications: Array<{ arn: string; state_id: string; created_at: string }>;
    pendingService?: ServiceSummary;
  } | null>(null);
  const [duplicateBanner, setDuplicateBanner] = useState<{
    applications: Array<{ arn: string; state_id: string; created_at: string }>;
  } | null>(null);
  const resumeHydratedRef = useRef<string | null>(null);

  /** Guard navigation — shows dialog if form is dirty. */
  const guardNavigation = useCallback((action: () => void) => {
    if (!formDirty) { action(); return; }
    pendingNavRef.current = action;
    setUnsavedConfirmOpen(true);
  }, [formDirty]);

  const handleConfirmNav = useCallback(() => {
    setUnsavedConfirmOpen(false);
    setFormDirty(false);
    pendingNavRef.current?.();
    pendingNavRef.current = null;
  }, []);

  const handleCancelNav = useCallback(() => {
    setUnsavedConfirmOpen(false);
    pendingNavRef.current = null;
  }, []);

  // Keep formDirtyRef in sync for the popstate closure
  useEffect(() => { formDirtyRef.current = formDirty; }, [formDirty]);

  // Scroll to top on view change
  useEffect(() => { window.scrollTo(0, 0); }, [view, showDashboard]);

  /** Push current view onto nav stack and navigate to a new view. */
  const navigateTo = useCallback((nextView: ViewId, nextDashboard: boolean) => {
    guardNavigation(() => {
      navDirectionRef.current = "push";
      setFormDirty(false);
      setFormStep("form");
      setAvatarMenuOpen(false);
      navStackRef.current.push({ view, showDashboard });
      setView(nextView);
      setShowDashboard(nextDashboard);
    });
  }, [view, showDashboard, guardNavigation]);

  /** Pop the nav stack and return to the previous view. Falls back to dashboard. */
  const navigateBack = useCallback(() => {
    guardNavigation(() => {
      navDirectionRef.current = "push";
      setFormDirty(false);
      const prev = navStackRef.current.pop();
      if (prev) {
        setView(prev.view);
        setShowDashboard(prev.showDashboard);
      } else {
        setView("catalog");
        setShowDashboard(true);
      }
    });
  }, [guardNavigation]);

  const markSync = useCallback(
    (timestamp?: string) => {
      if (!user) return;
      const value = timestamp || new Date().toISOString();
      setLastSyncAt(value);
      setUsingStaleData(false);
      localStorage.setItem(lastSyncKey(user.user_id), value);
    },
    [user]
  );

  const markStaleData = useCallback(
    (fetchedAt?: string, reason: "offline" | "error" = "offline", source = "app") => {
      setUsingStaleData(true);
      if (fetchedAt) setLastSyncAt(fetchedAt);
      incrementCacheTelemetry("stale_data_served", source);
      incrementCacheTelemetry(
        reason === "offline" ? "cache_fallback_offline" : "cache_fallback_error",
        source
      );
    },
    []
  );

  const flushCacheTelemetryNow = useCallback(
    async (keepalive = false) => {
      if (!user) return;
      try {
        await flushCacheTelemetryWithRetry({
          apiBaseUrl,
          userId: user.user_id,
          keepalive,
          maxAttempts: keepalive ? 1 : 3,
          baseDelayMs: 300
        });
      } catch {
        // Best-effort telemetry; ignore network errors to avoid UI impact.
      }
    },
    [user]
  );

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const key = profileCacheKey(user.user_id);
    setProfileLoading(true);
    try {
      if (isOffline) {
        const cached = readCached<{ applicant?: Record<string, unknown>; addresses?: Record<string, unknown>; completeness?: { isComplete?: boolean; missingFields?: string[] } }>(key, {
          schema: CACHE_SCHEMAS.profile,
          maxAgeMs: CACHE_TTL_MS.profile,
          validate: isProfilePayload
        });
        if (cached) {
          setProfileApplicant(cached.data.applicant || {});
          setProfileAddresses(cached.data.addresses || {});
          setProfileComplete(Boolean(cached.data.completeness?.isComplete));
          setProfileMissingFields(cached.data.completeness?.missingFields || []);
          markStaleData(cached.fetchedAt, "offline", "profile");
          return;
        }
      }
      const res = await fetch(`${apiBaseUrl}/api/v1/profile/me`, authHeaders());
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (typeof data?.error === "string" && data.error.startsWith("PROFILE_INCOMPLETE")) {
          const missing = data.error.split(":")[1] || "";
          setError(`Profile incomplete. Missing fields: ${missing}`);
          setFeedback(null);
          return;
        }
        throw new Error(data?.error || `API error ${res.status}`);
      }
      const data = await res.json();
      setProfileApplicant(data.applicant || {});
      setProfileAddresses(data.addresses || {});
      setProfileComplete(Boolean(data.completeness?.isComplete));
      setProfileMissingFields(data.completeness?.missingFields || []);
      setProfileVerification(data.verification || {});
      setProfileCompleteness(data.completeness || null);
      writeCached(key, data, { schema: CACHE_SCHEMAS.profile });
      markSync();
    } catch {
      const cached = readCached<{ applicant?: Record<string, unknown>; addresses?: Record<string, unknown>; completeness?: { isComplete?: boolean; missingFields?: string[] } }>(key, {
        schema: CACHE_SCHEMAS.profile,
        maxAgeMs: CACHE_TTL_MS.profile,
        validate: isProfilePayload
      });
      if (cached) {
        setProfileApplicant(cached.data.applicant || {});
        setProfileAddresses(cached.data.addresses || {});
        setProfileComplete(Boolean(cached.data.completeness?.isComplete));
        setProfileMissingFields(cached.data.completeness?.missingFields || []);
        markStaleData(cached.fetchedAt, "error", "profile");
        return;
      }
      setProfileComplete(false);
      setProfileMissingFields(["profile"]);
    } finally {
      setProfileLoading(false);
    }
  }, [user, authHeaders, isOffline, markStaleData, markSync]);

  const handleProfileUpdate = useCallback((section: string) => {
    setProfileUpdateSection(section);
    navigateTo("profile-update", false);
  }, [navigateTo]);

  const loadCitizenProperties = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/citizens/me/properties`, authHeaders());
      if (res.ok) {
        const data = await res.json();
        setCitizenProperties(data.properties || []);
      }
    } catch {
      // non-fatal — form still works without auto-fill
    }
  }, [user, authHeaders]);

  const loadCitizenDocuments = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/citizens/me/documents`, authHeaders());
      if (res.ok) {
        const data = await res.json();
        setCitizenDocuments(data.documents || []);
      }
    } catch {
      // non-fatal
    }
  }, [user, authHeaders]);

  // Define functions using useCallback before useEffect hooks
  const loadServices = useCallback(async () => {
    try {
      const key = serviceCacheKey();
      if (isOffline) {
        const cached = readCached<ServiceSummary[]>(key, {
          schema: CACHE_SCHEMAS.services,
          maxAgeMs: CACHE_TTL_MS.services,
          validate: isServiceSummaryArray
        });
        if (cached) {
          setServices(cached.data || []);
          markStaleData(cached.fetchedAt, "offline", "services");
          return;
        }
      }
      const res = await fetch(`${apiBaseUrl}/api/v1/config/services`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setServices(data.services || []);
      writeCached(key, data.services || [], { schema: CACHE_SCHEMAS.services });
      markSync();
    } catch (err) {
      const cached = readCached<ServiceSummary[]>(serviceCacheKey(), {
        schema: CACHE_SCHEMAS.services,
        maxAgeMs: CACHE_TTL_MS.services,
        validate: isServiceSummaryArray
      });
      if (cached) {
        setServices(cached.data || []);
        markStaleData(cached.fetchedAt, "error", "services");
      } else {
        setError(err instanceof Error ? err.message : "Unknown error");
        setFeedback(null);
      }
    } finally {
      setLoading(false);
    }
  }, [isOffline, markStaleData, markSync]);

  const loadServiceConfig = useCallback(async (serviceKey: string) => {
    const key = serviceConfigCacheKey(serviceKey);
    try {
      if (isOffline) {
        const cached = readCached<Record<string, unknown>>(key, {
          schema: CACHE_SCHEMAS.serviceConfig,
          maxAgeMs: CACHE_TTL_MS.serviceConfig,
          validate: isServiceConfigPayload
        });
        if (cached) {
          setServiceConfig(cached.data);
          markStaleData(cached.fetchedAt, "offline", "service_config");
          return;
        }
      }
      const res = await fetch(`${apiBaseUrl}/api/v1/config/services/${serviceKey}`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const config = await res.json();
      if (!config.form) throw new Error("Form configuration not available for this service.");
      setServiceConfig(config);
      writeCached(key, config, { schema: CACHE_SCHEMAS.serviceConfig });
      markSync();
    } catch (err) {
      const cached = readCached<Record<string, unknown>>(key, {
        schema: CACHE_SCHEMAS.serviceConfig,
        maxAgeMs: CACHE_TTL_MS.serviceConfig,
        validate: isServiceConfigPayload
      });
      if (cached) {
        setServiceConfig(cached.data);
        markStaleData(cached.fetchedAt, "error", "service_config");
      } else {
        setError(err instanceof Error ? err.message : "Unknown error");
        setFeedback(null);
      }
    }
  }, [isOffline, markStaleData, markSync]);

  const loadApplicationDetail = useCallback(async (arn: string) => {
    if (!user) return;
    const key = applicationDetailCacheKey(user.user_id, arn);
    try {
      if (isOffline) {
        const cached = readCached<Application>(key, {
          schema: CACHE_SCHEMAS.applicationDetail,
          maxAgeMs: CACHE_TTL_MS.applicationDetail,
          validate: isApplicationPayload
        });
        if (cached) {
          setApplicationDetail(cached.data);
          markStaleData(cached.fetchedAt, "offline", "application_detail");
          if (cached.data.rowVersion !== undefined) {
            setCurrentApplication((prev) => (prev ? { ...prev, rowVersion: cached.data.rowVersion } : prev));
          }
          return;
        }
      }
      const res = await fetch(`${apiBaseUrl}/api/v1/applications/${arn}`, authHeaders());
      if (res.ok) {
        const data = await res.json();
        setApplicationDetail(data);
        writeCached(key, data, { schema: CACHE_SCHEMAS.applicationDetail });
        markSync();
        // Keep rowVersion in sync whenever we reload the detail
        if (data.rowVersion !== undefined) {
          setCurrentApplication(prev => prev ? { ...prev, rowVersion: data.rowVersion } : prev);
        }
      }
    } catch {
      const cached = readCached<Application>(key, {
        schema: CACHE_SCHEMAS.applicationDetail,
        maxAgeMs: CACHE_TTL_MS.applicationDetail,
        validate: isApplicationPayload
      });
      if (cached) {
        setApplicationDetail(cached.data);
        markStaleData(cached.fetchedAt, "error", "application_detail");
      }
    }
  }, [user, authHeaders, isOffline, markStaleData, markSync]);

  // Load user applications for dashboard
  const loadUserApplications = useCallback(async () => {
    if (!user) return;
    const key = applicationsCacheKey(user.user_id);
    try {
      if (isOffline) {
        const cached = readCached<Application[]>(key, {
          schema: CACHE_SCHEMAS.applications,
          maxAgeMs: CACHE_TTL_MS.applications,
          validate: isApplicationArray
        });
        if (cached) {
          setApplications(cached.data || []);
          markStaleData(cached.fetchedAt, "offline", "applications");
          return;
        }
      }
      const res = await fetch(`${apiBaseUrl}/api/v1/applications?userId=${user.user_id}&limit=50`, authHeaders());
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
        writeCached(key, data.applications || [], { schema: CACHE_SCHEMAS.applications });
        markSync();
      }
    } catch (err) {
      const cached = readCached<Application[]>(key, {
        schema: CACHE_SCHEMAS.applications,
        maxAgeMs: CACHE_TTL_MS.applications,
        validate: isApplicationArray
      });
      if (cached) {
        setApplications(cached.data || []);
        markStaleData(cached.fetchedAt, "error", "applications");
      }
    }
  }, [user, authHeaders, isOffline, markStaleData, markSync]);

  // All hooks must be called before any conditional returns
  // PERF-007: Consolidated initial + reconnection data loading (was two separate effects)
  useEffect(() => {
    if (!user) return;
    loadCitizenProperties();
    loadCitizenDocuments();
    if (isOffline) return;
    loadServices();
    loadUserApplications();
    loadProfile();
    if (currentApplication?.arn) {
      loadApplicationDetail(currentApplication.arn);
    }
  }, [user, isOffline, currentApplication?.arn, loadServices, loadUserApplications, loadProfile, loadCitizenProperties, loadCitizenDocuments, loadApplicationDetail]);

  // Post-login: redirect to onboarding if profile incomplete and not onboarded
  useEffect(() => {
    if (!user || profileLoading || onboardingRedirectDone.current) return;
    if (!profileVerification.onboarding_completed_at && !profileComplete) {
      onboardingRedirectDone.current = true;
      setView("profile");
      setShowDashboard(false);
      showToast("info", "Complete your profile to start applying for services");
    }
  }, [user, profileLoading, profileVerification, profileComplete, showToast]);

  useEffect(() => {
    if (user && view === "track" && currentApplication?.arn && !applicationDetail) {
      loadApplicationDetail(currentApplication.arn);
    }
  }, [user, view, currentApplication?.arn, applicationDetail, loadApplicationDetail]);

  useEffect(() => {
    if (user && view === "track" && currentApplication?.service_key && !serviceConfig) {
      loadServiceConfig(currentApplication.service_key);
    }
  }, [user, view, currentApplication?.service_key, serviceConfig, loadServiceConfig]);

  useEffect(() => {
    if (user && view === "create" && selectedService?.serviceKey && !serviceConfig && !configLoading) {
      setConfigLoading(true);
      loadServiceConfig(selectedService.serviceKey).finally(() => setConfigLoading(false));
    }
  }, [user, view, selectedService?.serviceKey, serviceConfig, configLoading, loadServiceConfig]);

  useEffect(() => {
    if (user && view === "create") {
      setFormData((prev: any) => {
        const existingApplicant = prev?.applicant || {};
        const mergedApplicant = { ...existingApplicant, ...profileApplicant };

        // Merge profile addresses into form address section
        const existingAddress = prev?.address || {};
        const mergedAddress = { ...existingAddress };
        if (profileAddresses?.permanent) {
          mergedAddress.permanent = { ...(existingAddress.permanent || {}), ...profileAddresses.permanent };
        }
        if (profileAddresses?.communication) {
          mergedAddress.communication = { ...(existingAddress.communication || {}), ...profileAddresses.communication };
          // When "same as permanent" is checked, fill communication fields from permanent
          if (mergedAddress.communication.same_as_permanent && mergedAddress.permanent) {
            const { same_as_permanent, ...rest } = mergedAddress.communication;
            const filled = { same_as_permanent };
            for (const [k, v] of Object.entries(mergedAddress.permanent)) {
              (filled as any)[k] = rest[k] != null && rest[k] !== "" ? rest[k] : v;
            }
            mergedAddress.communication = filled;
          }
        }

        return { ...prev, applicant: mergedApplicant, address: mergedAddress };
      });
    }
  }, [user, view, profileApplicant, profileAddresses]);

  useEffect(() => {
    if (view !== "create" || selectedService?.serviceKey !== "no_due_certificate") {
      setNdcPaymentStatus(null);
      setNdcPaymentStatusError(null);
      setNdcPaymentStatusLoading(false);
      return;
    }

    const upn = formData?.property?.upn as string | undefined;
    if (!upn) {
      setNdcPaymentStatus(null);
      setNdcPaymentStatusError(null);
      setNdcPaymentStatusLoading(false);
      return;
    }
    // Resolve authority from the citizen's linked property (authoritative source),
    // falling back to the form-selected authority_id if not found.
    const linkedProp = citizenProperties.find(p => p.unique_property_number === upn);
    const authorityId = linkedProp?.authority_id || (formData?.authority_id as string | undefined);
    if (!authorityId) {
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
        const qs = new URLSearchParams({ authorityId, upn });
        const res = await fetch(`${apiBaseUrl}/api/v1/ndc/payment-status/by-upn?${qs.toString()}`, authHeaders());
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
  }, [
    view,
    selectedService?.serviceKey,
    formData?.authority_id,
    formData?.property?.upn,
    citizenProperties,
    isOffline,
    authHeaders
  ]);

  // Duplicate check when UPN is selected for property-linked services
  useEffect(() => {
    if (view !== "create" || !selectedService || isOffline) {
      setDuplicateBanner(null);
      return;
    }
    const propertyRequired = selectedService.submissionValidation?.propertyRequired !== false;
    if (!propertyRequired) return; // person-linked checked at Apply Now
    const upn = formData?.property?.upn as string | undefined;
    if (!upn) {
      setDuplicateBanner(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/v1/applications/check-duplicate`, {
          ...authHeaders(),
          method: "POST",
          body: JSON.stringify({ serviceKey: selectedService.serviceKey, propertyUpn: upn }),
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.hasDuplicate && data.existingApplications?.length > 0) {
            setDuplicateBanner({ applications: data.existingApplications });
          } else if (!cancelled) {
            setDuplicateBanner(null);
          }
        }
      } catch {
        // non-blocking
      }
    })();
    return () => { cancelled = true; };
  }, [view, selectedService, formData?.property?.upn, isOffline, authHeaders]);

  // PERF-007: Removed — consolidated into the single data-loading effect above.

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      void flushCacheTelemetryNow(false);
    };
    const handleOffline = () => setIsOffline(true);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void flushCacheTelemetryNow(true);
      }
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [flushCacheTelemetryNow]);

  // Offline draft sync: flush queued drafts when coming back online
  useEffect(() => {
    if (isOffline || !user) return;
    const unsyncedDrafts = readOfflineDrafts().filter(d => !d.synced);
    if (unsyncedDrafts.length === 0) return;

    let cancelled = false;
    (async () => {
      let syncedCount = 0;
      for (const draft of unsyncedDrafts) {
        if (cancelled) break;
        try {
          const res = await fetch(`${apiBaseUrl}/api/v1/applications`, {
            ...authHeaders(),
            method: "POST",
            body: JSON.stringify({
              authorityId: draft.formData?.authority_id || "PUDA",
              serviceKey: draft.serviceKey,
              data: draft.formData,
              userId: user.user_id,
            }),
          });
          if (res.ok) {
            removeOfflineDraft(draft.id);
            syncedCount++;
          } else {
            markOfflineDraftSynced(draft.id);
          }
        } catch {
          // Network still flaky, stop trying
          break;
        }
      }
      if (syncedCount > 0 && !cancelled) {
        showToast("success", t("offline.synced_count", { count: syncedCount }));
      }
      if (!cancelled) {
        setPendingSyncCount(getUnsyncedDraftCount());
      }
    })();

    return () => { cancelled = true; };
  }, [isOffline, user]);

  useEffect(() => {
    if (!user || isOffline) return;
    const interval = window.setInterval(() => {
      void flushCacheTelemetryNow(false);
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [user, isOffline, flushCacheTelemetryNow]);

  useEffect(() => {
    if (!user) return;
    const synced = localStorage.getItem(lastSyncKey(user.user_id));
    setLastSyncAt(synced);
  }, [user]);

  useEffect(() => {
    if (user) return;
    resumeHydratedRef.current = null;
    hashInitializedRef.current = false;
    deepLinkAppliedRef.current = false;
    window.location.hash = "";
    setUsingStaleData(false);
    setLastSyncAt(null);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (resumeHydratedRef.current === user.user_id) return;
    // Deep-link from URL takes precedence over resume state
    const initHash = window.location.hash;
    if (initHash && initHash !== "#" && initHash !== "#/") {
      deepLinkAppliedRef.current = true;
      resumeHydratedRef.current = user.user_id;
      return;
    }
    const key = resumeStateKey(user.user_id);
    resumeHydratedRef.current = user.user_id;
    const cached = readCached<ResumeSnapshot>(key, {
      schema: CACHE_SCHEMAS.resume,
      maxAgeMs: CACHE_TTL_MS.resume,
      validate: isResumeSnapshotPayload
    });
    if (!cached) {
      // Apply default landing page preference
      const landing = preferences.defaultLandingPage;
      if (landing === "services") {
        setView("catalog");
        setShowDashboard(false);
      } else if (landing === "applications") {
        setView("applications");
        setShowDashboard(false);
      } else if (landing === "locker") {
        setView("locker");
        setShowDashboard(false);
      }
      // "dashboard" is the default — no change needed
      return;
    }
    const snapshot = cached.data;
    setView(snapshot.view || "catalog");
    setShowDashboard(Boolean(snapshot.showDashboard));
    setSelectedService(snapshot.selectedService || null);
    setCurrentApplication(snapshot.currentApplication || null);
    setFormData(snapshot.formData || {});
    // Session restoration is silent — no feedback banner needed
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const snapshot: ResumeSnapshot = {
      view,
      showDashboard,
      selectedService,
      currentApplication,
      formData,
      updatedAt: new Date().toISOString()
    };
    writeCached(resumeStateKey(user.user_id), snapshot, { schema: CACHE_SCHEMAS.resume });
  }, [user, view, showDashboard, selectedService, currentApplication, formData]);

  // --- Hash-based routing ---

  const CITIZEN_VALID_VIEWS = ["", "services", "create", "track", "applications", "locker", "profile", "settings", "guide", "complaints"] as const;

  /** Map current app state → hash string */
  const citizenViewToHash = useCallback((): string => {
    if (view === "catalog" && showDashboard) return buildHash("");
    if (view === "catalog" && !showDashboard) return buildHash("services");
    if (view === "create" && selectedService) return buildHash("create", selectedService.serviceKey);
    if (view === "create") return buildHash("services");
    if (view === "track" && currentApplication) return buildHash("track", currentApplication.arn);
    if (view === "applications") {
      const params: Record<string, string> = {};
      if (appStatusFilter) params.status = appStatusFilter;
      return buildHash("applications", undefined, Object.keys(params).length > 0 ? params : undefined);
    }
    if (view === "locker") {
      const params: Record<string, string> = {};
      if (lockerFilter) params.filter = lockerFilter;
      return buildHash("locker", undefined, Object.keys(params).length > 0 ? params : undefined);
    }
    if (view === "profile" || view === "profile-update") return buildHash("profile");
    if (view === "settings") return buildHash("settings");
    if (view === "guide") return buildHash("guide");
    if (view === "complaints") return buildHash("complaints");
    return buildHash("");
  }, [view, showDashboard, selectedService, currentApplication, appStatusFilter, lockerFilter]);

  // Effect A — Sync state → URL hash (skip until deep-link check has run)
  useEffect(() => {
    if (!user || !hashInitializedRef.current) return;
    const hash = citizenViewToHash();
    const direction = navDirectionRef.current;
    navDirectionRef.current = "push"; // reset for next navigation
    if (direction === "none") return;
    if (direction === "replace") { replaceHash(hash); return; }
    pushHash(hash);
  }, [user, view, showDashboard, selectedService?.serviceKey, currentApplication?.arn, appStatusFilter, lockerFilter]);

  // Effect B — Deep-link init (runs once after auth)
  useEffect(() => {
    if (!user || hashInitializedRef.current) return;
    hashInitializedRef.current = true;
    const hash = window.location.hash;
    if (!hash || hash === "#" || hash === "#/") {
      // No deep link — push initial hash from current state, then let resume-state run
      replaceHash(citizenViewToHash());
      return;
    }
    const parsed = parseHash(hash);
    const validView = validateView(parsed.view, CITIZEN_VALID_VIEWS, "");
    if (validView === "" || validView === "services") {
      // Dashboard/services — set state directly
      deepLinkAppliedRef.current = true;
      navDirectionRef.current = "replace";
      setView("catalog");
      setShowDashboard(validView === "");
      return;
    }
    if (validView === "track" && parsed.resourceId) {
      deepLinkAppliedRef.current = true;
      navDirectionRef.current = "replace";
      setView("track");
      setShowDashboard(false);
      openApplication(parsed.resourceId, { skipNav: true });
      return;
    }
    if (validView === "create" && parsed.resourceId) {
      deepLinkAppliedRef.current = true;
      navDirectionRef.current = "replace";
      // Load the service config and set state — the service key is the resourceId
      const serviceKey = parsed.resourceId;
      setShowDashboard(false);
      loadServiceConfig(serviceKey).then(() => {
        setSelectedService({ serviceKey, displayName: serviceKey, category: "" });
        setView("create");
      });
      return;
    }
    if (validView === "create") {
      // No service key — redirect to services
      deepLinkAppliedRef.current = true;
      navDirectionRef.current = "replace";
      setView("catalog");
      setShowDashboard(false);
      replaceHash(buildHash("services"));
      return;
    }
    if (validView === "applications") {
      deepLinkAppliedRef.current = true;
      navDirectionRef.current = "replace";
      if (parsed.params.status) setAppStatusFilter(parsed.params.status);
      setView("applications");
      setShowDashboard(false);
      return;
    }
    if (validView === "locker") {
      deepLinkAppliedRef.current = true;
      navDirectionRef.current = "replace";
      if (parsed.params.filter) setLockerFilter(parsed.params.filter);
      setView("locker");
      setShowDashboard(false);
      return;
    }
    // Simple views: profile, settings, guide, complaints
    const simpleViewMap: Record<string, ViewId> = {
      profile: "profile",
      settings: "settings",
      guide: "guide",
      complaints: "complaints"
    };
    if (simpleViewMap[validView]) {
      deepLinkAppliedRef.current = true;
      navDirectionRef.current = "replace";
      setView(simpleViewMap[validView]);
      setShowDashboard(false);
      return;
    }
    // Invalid — replace with default
    replaceHash(buildHash(""));
  }, [user]);

  // Effect C — Popstate handler (browser back/forward)
  useEffect(() => {
    if (!user) return;
    const handlePopState = () => {
      if (isSuppressed()) return;
      // Dirty form guard
      if (formDirtyRef.current) {
        const targetHash = window.location.hash;
        pushHash(citizenViewToHash());
        pendingNavRef.current = () => {
          setFormDirty(false);
          const parsed = parseHash(targetHash);
          const validView = validateView(parsed.view, CITIZEN_VALID_VIEWS, "");
          navDirectionRef.current = "none";
          navStackRef.current.pop();
          // Re-parse to set proper view
          replaceHash(targetHash);
        };
        setUnsavedConfirmOpen(true);
        return;
      }
      const parsed = parseHash(window.location.hash);
      const validView = validateView(parsed.view, CITIZEN_VALID_VIEWS, "");
      navDirectionRef.current = "none"; // prevent sync effect from pushing
      navStackRef.current.pop(); // mirror the browser's back
      if (validView === "" || validView === "services") {
        setView("catalog");
        setShowDashboard(validView === "");
        setCurrentApplication(null);
        setApplicationDetail(null);
        return;
      }
      if (validView === "track" && parsed.resourceId) {
        setView("track");
        setShowDashboard(false);
        openApplication(parsed.resourceId, { skipNav: true });
        return;
      }
      if (validView === "applications") {
        setAppStatusFilter(parsed.params.status || "");
        setView("applications");
        setShowDashboard(false);
        setCurrentApplication(null);
        setApplicationDetail(null);
        return;
      }
      if (validView === "locker") {
        setLockerFilter(parsed.params.filter || undefined);
        setView("locker");
        setShowDashboard(false);
        return;
      }
      const simpleViewMap: Record<string, ViewId> = {
        profile: "profile",
        settings: "settings",
        guide: "guide",
        complaints: "complaints"
      };
      if (simpleViewMap[validView]) {
        setView(simpleViewMap[validView]);
        setShowDashboard(false);
        return;
      }
      // Fallback for create or unknown
      setView("catalog");
      setShowDashboard(true);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [user, t]);

  // PERF-026: Lazy-load secondary locale bundle when language preference changes
  useEffect(() => {
    if (preferences.language && preferences.language !== "none") {
      ensureLocaleLoaded(preferences.language);
    }
  }, [preferences.language]);

  // Bridge preferences → theme system
  useEffect(() => {
    if (preferences.theme !== theme) {
      setTheme(preferences.theme);
    }
  }, [preferences.theme]);

  // Bridge preferences → reduce-motion data attribute
  useEffect(() => {
    if (preferences.reduceAnimations) {
      document.documentElement.dataset.reduceMotion = "true";
    } else {
      delete document.documentElement.dataset.reduceMotion;
    }
  }, [preferences.reduceAnimations]);

  // Bridge preferences → high-contrast data attribute
  useEffect(() => {
    if (preferences.contrastMode === "high") {
      document.documentElement.dataset.contrast = "high";
    } else {
      delete document.documentElement.dataset.contrast;
    }
  }, [preferences.contrastMode]);

  useEffect(() => {
    if (!formDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [formDirty]);

  const handleLogout = useCallback(() => {
    window.location.hash = "";
    void flushCacheTelemetryNow(true).finally(() => logout());
  }, [flushCacheTelemetryNow, logout]);

  const { showWarning: idleWarning, dismissWarning } = useIdleTimeout(handleLogout);

  const reloadLatestDraftVersion = useCallback(async () => {
    if (!draftConflictArn) return;
    setResolvingDraftConflict(true);
    setError(null);
    try {
      await loadApplicationDetail(draftConflictArn);
      const freshRes = await fetch(`${apiBaseUrl}/api/v1/applications/${draftConflictArn}`, authHeaders());
      if (!freshRes.ok) throw new Error(`API error ${freshRes.status}`);
      const freshApp = await freshRes.json();
      setCurrentApplication({ ...freshApp, rowVersion: freshApp.rowVersion });
      setFormData(freshApp.data_jsonb || {});
      setFeedback({
        variant: "info",
        text: "Loaded the latest saved draft. Re-apply your pending edits before saving again."
      });
      markSync();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the latest draft");
      setFeedback(null);
    } finally {
      setResolvingDraftConflict(false);
      setDraftConflictArn(null);
    }
  }, [authHeaders, draftConflictArn, loadApplicationDetail, markSync]);

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format(amount || 0);
  }, []);

  const postNdcPaymentByUpn = useCallback(
    async (dueCode: string) => {
      if (isOffline) {
        setNdcPaymentPostingError("You are offline. Payment posting is unavailable.");
        return;
      }
      const authorityId = formData?.authority_id as string | undefined;
      const upn = formData?.property?.upn as string | undefined;
      if (!authorityId || !upn) {
        setNdcPaymentPostingError("Select authority and property UPN before posting payment.");
        return;
      }
      setNdcPaymentPostingDueCode(dueCode);
      setNdcPaymentPostingError(null);
      try {
        const qs = new URLSearchParams({ authorityId, upn });
        const res = await fetch(`${apiBaseUrl}/api/v1/ndc/payments/by-upn?${qs.toString()}`, {
          ...authHeaders(),
          method: "POST",
          body: JSON.stringify({ dueCode }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.message || body?.error || `API error ${res.status}`);
        }
        setNdcPaymentStatus(body.paymentStatus || null);
        const paidAmount = body?.paymentPosted?.amount;
        showToast("success", paidAmount ? `Payment posted for ${dueCode}: ${formatCurrency(Number(paidAmount))}` : `Payment posted for ${dueCode}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to post payment";
        setNdcPaymentPostingError(message);
        showToast("error", message);
      } finally {
        setNdcPaymentPostingDueCode(null);
      }
    },
    [isOffline, formData?.authority_id, formData?.property?.upn, authHeaders, showToast, formatCurrency]
  );

  const openProfileEditor = useCallback(() => {
    setProfileDraft({
      salutation: profileApplicant?.salutation || "",
      first_name: profileApplicant?.first_name || "",
      middle_name: profileApplicant?.middle_name || "",
      last_name: profileApplicant?.last_name || "",
      full_name: profileApplicant?.full_name || "",
      father_name: profileApplicant?.father_name || "",
      gender: profileApplicant?.gender || "",
      marital_status: profileApplicant?.marital_status || "",
      date_of_birth: profileApplicant?.date_of_birth || "",
      aadhaar: profileApplicant?.aadhaar || "",
      pan: profileApplicant?.pan || "",
      email: profileApplicant?.email || "",
      mobile: profileApplicant?.mobile || ""
    });
    setProfileEditorError(null);
    setProfileEditorOpen(true);
  }, [profileApplicant]);

  const saveProfileDraft = useCallback(async () => {
    if (!user) return;
    if (isOffline) {
      setProfileEditorError("You are offline. Personal details can be updated only when online.");
      return;
    }
    setProfileEditorSaving(true);
    setProfileEditorError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/profile/me`, {
        ...authHeaders(),
        method: "PATCH",
        body: JSON.stringify({ applicant: profileDraft })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || body?.error || `API error ${res.status}`);
      }
      setProfileApplicant(body.applicant || {});
      setProfileComplete(Boolean(body.completeness?.isComplete));
      setProfileMissingFields(body.completeness?.missingFields || []);
      setFormData((prev: any) => ({
        ...prev,
        applicant: { ...(prev?.applicant || {}), ...(body.applicant || {}) }
      }));
      writeCached(profileCacheKey(user.user_id), body, { schema: CACHE_SCHEMAS.profile });
      markSync();
      setProfileEditorOpen(false);
      setFeedback({ variant: "success", text: "Personal details updated successfully." });
    } catch (err) {
      setProfileEditorError(err instanceof Error ? err.message : "Failed to update personal details");
    } finally {
      setProfileEditorSaving(false);
    }
  }, [user, isOffline, authHeaders, profileDraft, markSync]);

  const pageTitle = useMemo(() => {
    if (showDashboard && view === "catalog") return "Dashboard";
    if (view === "catalog") return t("nav.services");
    if (view === "create") return selectedService?.displayName || "New Application";
    if (view === "track") return "Application Details";
    if (view === "applications") return "My Applications";
    if (view === "locker") return "Document Locker";
    if (view === "settings") return "Settings";
    if (view === "profile") return t("nav.profile");
    if (view === "guide") return t("nav.guide");
    if (view === "complaints") return t("complaints.title");
    return "PUDA";
  }, [view, showDashboard, selectedService, t]);

  const handleDrawerNav = useCallback((target: ViewId, dashboard: boolean) => {
    setDrawerOpen(false);
    if (view === target && showDashboard === dashboard) return;
    navigateTo(target, dashboard);
  }, [view, showDashboard, navigateTo]);

  const renderTopbarActions = (idSuffix: string) => (
    <div className="topbar-actions">
      <ThemeToggle
        theme={theme}
        resolvedTheme={resolvedTheme}
        onThemeChange={setTheme}
        idSuffix={idSuffix}
      />
      <span className="user-chip" title={user?.name}>{user?.name}</span>
      <Button onClick={handleLogout} variant="ghost" className="ui-btn-ghost">
        {t("nav.logout")}
      </Button>
    </div>
  );

  const renderResilienceBanner = () => {
    const timestamp = lastSyncAt ? new Date(lastSyncAt).toLocaleString() : null;
    if (isOffline) {
      return (
        <Alert variant="warning" className="view-feedback">
          {t("common.offline_banner")}
          {timestamp ? ` ${t("common.offline_cached", { time: timestamp })}` : ""}
        </Alert>
      );
    }
    if (usingStaleData) {
      return (
        <Alert variant="info" className="view-feedback">
          {t("common.stale_data", { time: timestamp || "" })}
        </Alert>
      );
    }
    if (pendingSyncCount > 0 && !isOffline) {
      return (
        <Alert variant="info" className="view-feedback">
          {t("offline.pending_count", { count: pendingSyncCount })}
        </Alert>
      );
    }
    return null;
  };

  // Show login if not authenticated (after all hooks)
  if (isLoading) {
    return (
      <div className="page">
        <div className="panel" style={{ display: "grid", gap: "var(--space-4)" }}>
          <SkeletonBlock height="1.5rem" width="40%" />
          <SkeletonBlock height="1rem" width="70%" />
          <SkeletonBlock height="1rem" width="55%" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <SecondaryLanguageProvider lang={preferences.language}>
        <Login />
      </SecondaryLanguageProvider>
    );
  }

  const renderNavContent = (context: "sidebar" | "drawer") => {
    const handleNav = context === "drawer"
      ? handleDrawerNav
      : (target: ViewId, dashboard: boolean) => {
          if (view === target && showDashboard === dashboard) return;
          navigateTo(target, dashboard);
        };
    const idSuffix = context === "drawer" ? "drawer" : "sidebar";
    return (
      <>
        <div className="sidebar__header">
          <div className="sidebar__portal-name"><Bilingual tKey="nav.portal_name" /></div>
          <div className="sidebar__user-name">{user.name}</div>
        </div>
        <ul className="sidebar__nav">
          <li>
            <button type="button" className={`sidebar__item ${showDashboard && view === "catalog" ? "sidebar__item--active" : ""}`} onClick={() => handleNav("catalog", true)} title={t("nav.dashboard")}>
              <span className="sidebar__item-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </span>
              <Bilingual tKey="nav.dashboard" />
            </button>
          </li>
          <li>
            <button type="button" className={`sidebar__item ${view === "profile" ? "sidebar__item--active" : ""}`} onClick={() => handleNav("profile", false)} title={t("nav.profile")}>
              <span className="sidebar__item-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </span>
              <Bilingual tKey="nav.profile" />
            </button>
          </li>
          <li>
            <button type="button" className={`sidebar__item ${!showDashboard && view === "catalog" ? "sidebar__item--active" : ""}`} onClick={() => handleNav("catalog", false)} title={t("nav.services")}>
              <span className="sidebar__item-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </span>
              <Bilingual tKey="nav.services" />
            </button>
          </li>
          <li>
            <button type="button" className={`sidebar__item ${view === "applications" ? "sidebar__item--active" : ""}`} onClick={() => handleNav("applications", false)} title={t("nav.applications")}>
              <span className="sidebar__item-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </span>
              <Bilingual tKey="nav.applications" />
            </button>
          </li>
          <li>
            <button type="button" className={`sidebar__item ${view === "locker" ? "sidebar__item--active" : ""}`} onClick={() => { setLockerFilter(undefined); handleNav("locker", false); }} title={t("nav.locker")}>
              <span className="sidebar__item-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </span>
              <Bilingual tKey="nav.locker" />
            </button>
          </li>
          <li>
            <button type="button" className={`sidebar__item ${view === "guide" ? "sidebar__item--active" : ""}`} onClick={() => handleNav("guide", false)} title={t("nav.guide")}>
              <span className="sidebar__item-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              </span>
              <Bilingual tKey="nav.guide" />
            </button>
          </li>
          <li>
            <button type="button" className={`sidebar__item ${view === "complaints" ? "sidebar__item--active" : ""}`} onClick={() => handleNav("complaints", false)} title={t("nav.complaints")}>
              <span className="sidebar__item-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </span>
              <Bilingual tKey="nav.complaints" />
            </button>
          </li>
          <li>
            <button type="button" className={`sidebar__item ${view === "settings" ? "sidebar__item--active" : ""}`} onClick={() => handleNav("settings", false)} title={t("nav.settings")}>
              <span className="sidebar__item-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </span>
              <Bilingual tKey="nav.settings" />
            </button>
          </li>
        </ul>
        <div className="sidebar__divider" />
        <div className="sidebar__footer">
          <button type="button" className="sidebar__item" onClick={() => { if (context === "drawer") setDrawerOpen(false); handleLogout(); }} title={t("nav.logout")}>
            <span className="sidebar__item-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </span>
            {t("nav.logout")}
          </button>
        </div>
      </>
    );
  };

  // App Shell: app bar + persistent sidebar (desktop) + drawer (mobile)
  const appShell = (mainContent: React.ReactNode) => (
    <SecondaryLanguageProvider lang={preferences.language}>
      <header className="app-bar">
        <div className="app-bar__inner">
          <button
            className="app-bar__hamburger app-bar__hamburger--desktop-only"
            onClick={() => updatePreference("sidebarCollapsed", !preferences.sidebarCollapsed)}
            aria-label={preferences.sidebarCollapsed ? "Expand menu" : "Collapse menu"}
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div className="app-bar__brand">
            <svg className="app-bar__logo" viewBox="0 0 40 40" aria-hidden="true">
              <circle cx="20" cy="20" r="19" fill="var(--color-brand)" stroke="var(--color-brand)" strokeWidth="1" />
              <circle cx="20" cy="20" r="15" fill="none" stroke="#fff" strokeWidth="0.8" />
              <text x="20" y="16" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="700" fontFamily="system-ui, sans-serif">PUDA</text>
              <text x="20" y="23" textAnchor="middle" fill="#fff" fontSize="3.2" fontFamily="system-ui, sans-serif">PUNJAB URBAN</text>
              <text x="20" y="27" textAnchor="middle" fill="#fff" fontSize="3.2" fontFamily="system-ui, sans-serif">DEVELOPMENT</text>
              <text x="20" y="31" textAnchor="middle" fill="#fff" fontSize="3.2" fontFamily="system-ui, sans-serif">AUTHORITY</text>
            </svg>
            <div className="app-bar__brand-text">
              <span className="app-bar__brand-name">PUDA Citizen Portal</span>
              <span className="app-bar__page-title">{pageTitle}</span>
            </div>
          </div>
          <div className="app-bar__avatar-wrap" style={{ position: "relative" }}>
            <button ref={avatarBtnRef} className="app-bar__avatar"
              onClick={() => setAvatarMenuOpen(p => !p)}
              aria-label="User menu" aria-expanded={avatarMenuOpen} type="button">
              {user.name.charAt(0).toUpperCase()}
            </button>
            {avatarMenuOpen && (
              <div ref={avatarMenuRef} className="avatar-menu">
                <div className="avatar-menu__header">
                  <span className="avatar-menu__initial">{user.name.charAt(0).toUpperCase()}</span>
                  <span className="avatar-menu__name">{user.name}</span>
                </div>
                <div className="avatar-menu__divider" />
                <button className="avatar-menu__item" type="button"
                  onClick={() => { setAvatarMenuOpen(false); navigateTo("profile", false); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <Bilingual tKey="nav.profile" />
                </button>
                <button className="avatar-menu__item" type="button"
                  onClick={() => { setAvatarMenuOpen(false); navigateTo("settings", false); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  <Bilingual tKey="nav.settings" />
                </button>
                <div className="avatar-menu__divider" />
                <button className="avatar-menu__item avatar-menu__item--danger" type="button"
                  onClick={() => { setAvatarMenuOpen(false); handleLogout(); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  <Bilingual tKey="nav.logout" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Desktop: persistent sidebar (hidden on mobile via CSS) */}
      <aside className={`sidebar${preferences.sidebarCollapsed ? " sidebar--collapsed" : ""}`}>
        {renderNavContent("sidebar")}
      </aside>

      {/* Mobile: overlay drawer (portal renders outside #root) */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        {renderNavContent("drawer")}
      </Drawer>

      {/* Mobile: persistent bottom navigation */}
      <nav className="bottom-nav" aria-label="Main navigation">
        <button className={`bottom-nav__tab${showDashboard && view === "catalog" ? " bottom-nav__tab--active" : ""}`}
          type="button" onClick={() => { if (!(showDashboard && view === "catalog")) navigateTo("catalog", true); }}>
          <svg className="bottom-nav__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span className="bottom-nav__label"><Bilingual tKey="nav.dashboard" /></span>
        </button>
        <button className={`bottom-nav__tab${!showDashboard && view === "catalog" ? " bottom-nav__tab--active" : ""}`}
          type="button" onClick={() => { if (!(!showDashboard && view === "catalog")) navigateTo("catalog", false); }}>
          <svg className="bottom-nav__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          <span className="bottom-nav__label"><Bilingual tKey="nav.services" /></span>
        </button>
        <button className={`bottom-nav__tab${view === "applications" ? " bottom-nav__tab--active" : ""}`}
          type="button" onClick={() => { if (view !== "applications") navigateTo("applications", false); }}>
          <svg className="bottom-nav__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          <span className="bottom-nav__label"><Bilingual tKey="nav.applications" /></span>
        </button>
        <button className={`bottom-nav__tab${view === "locker" ? " bottom-nav__tab--active" : ""}`}
          type="button" onClick={() => { if (view !== "locker") { setLockerFilter(undefined); navigateTo("locker", false); } }}>
          <svg className="bottom-nav__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span className="bottom-nav__label"><Bilingual tKey="nav.locker" /></span>
        </button>
        <button className={`bottom-nav__tab${drawerOpen ? " bottom-nav__tab--active" : ""}`}
          type="button" onClick={() => setDrawerOpen(true)}>
          <svg className="bottom-nav__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          <span className="bottom-nav__label"><Bilingual tKey="nav.more" /></span>
        </button>
      </nav>

      <div className={`app-layout${preferences.sidebarCollapsed ? " app-layout--sidebar-collapsed" : ""}`}>
        <div className="app-layout__main">
          {mainContent}
        </div>
      </div>
      <ConfirmDialog
        open={unsavedConfirmOpen}
        title={t("common.unsaved_title")}
        description={t("common.unsaved_confirm")}
        variant="warning"
        confirmLabel={t("common.leave")}
        cancelLabel={t("common.stay")}
        onConfirm={handleConfirmNav}
        onCancel={handleCancelNav}
      />
      <Modal open={idleWarning} title={t("idle.warning_title")} onClose={dismissWarning} actions={<Button onClick={dismissWarning}>{t("idle.continue")}</Button>}>
        <p>{t("idle.warning_message")}</p>
      </Modal>
    </SecondaryLanguageProvider>
  );

  // Show dashboard by default after login
  if (showDashboard && view === "catalog") {
    return appShell(
      <div className="page">
        <a href="#citizen-main-dashboard" className="skip-link">
          {t("common.skip_to_main")}
        </a>
        <main id="citizen-main-dashboard" role="main">
          <h1><Bilingual tKey="dashboard.title" /></h1>
          <p className="subtitle">{t("dashboard.welcome", { name: user.name })}</p>
          <Suspense fallback={<div className="panel" style={{display:"grid",gap:"var(--space-3)"}}><SkeletonBlock height="5rem" /><SkeletonBlock height="5rem" /><SkeletonBlock height="5rem" /></div>}>
            <Dashboard
              onNavigateToCatalog={() => {
                setError(null);
                setFeedback(null);
                navigateTo("catalog", false);
              }}
              onNavigateToApplication={async (arn) => {
                setError(null);
                setFeedback(null);
                if (arn) {
                  await openApplication(arn);
                } else {
                  navigateTo("applications", false);
                }
              }}
              onNavigateToApplications={(filter) => {
                setError(null);
                setFeedback(null);
                setAppStatusFilter(filter === "active" ? "In Progress" : filter === "approved" ? "Approved" : "");
                navigateTo("applications", false);
              }}
              onNavigateToLocker={(filter?: string) => {
                setError(null);
                setFeedback(null);
                setLockerFilter(filter);
                navigateTo("locker", false);
              }}
              onNavigateToComplaints={() => {
                setError(null);
                setFeedback(null);
                navigateTo("complaints", false);
              }}
              onNavigateToProfile={() => {
                setError(null);
                setFeedback(null);
                navigateTo("profile", false);
              }}
              profileCompleteness={profileCompleteness}
              isOffline={isOffline}
            />
          </Suspense>
        </main>
      </div>
    );
  }

  const ensureProfileComplete = (): boolean => {
    if (profileLoading) {
      setError(null);
      setFeedback({ variant: "warning", text: "Profile is still loading. Please wait and try again." });
      return false;
    }
    if (!profileComplete) {
      setError(null);
      setFeedback({
        variant: "warning",
        text: "Your profile is incomplete. Please update your profile to proceed."
      });
      return false;
    }
    setFeedback(null);
    return true;
  };

  const createApplication = async () => {
    if (!selectedService || !user) return;
    if (isOffline) {
      setError(null);
      setFeedback({ variant: "warning", text: "You are offline. Application creation is unavailable in read-only mode." });
      return;
    }
    if (!ensureProfileComplete()) return;
    
    try {
      setError(null);
      const res = await fetch(`${apiBaseUrl}/api/v1/applications`, {
        ...authHeaders(),
        method: "POST",
        body: JSON.stringify({
          authorityId: formData.authority_id || "PUDA",
          serviceKey: selectedService.serviceKey,
          applicantUserId: user.user_id,
          data: formData
        })
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);
      const app = await res.json();
      setCurrentApplication({ ...app, rowVersion: app.rowVersion });
      setFeedback({
        variant: "success",
        text: "Application draft created. You can continue adding details and documents before submission."
      });
      navigateTo("track", false);
      markSync();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setFeedback(null);
    }
  };

  const saveDraft = async () => {
    if (!selectedService || !user) return;
    if (isOffline) {
      setError(null);
      const draftId = currentApplication?.arn || crypto.randomUUID();
      writeOfflineDraft({
        id: draftId,
        serviceKey: selectedService.serviceKey,
        formData,
        savedAt: new Date().toISOString(),
        synced: false,
      });
      showToast("info", t("offline.draft_saved_locally"));
      setFeedback({ variant: "info", text: t("offline.draft_saved_locally") });
      setFormDirty(false);
      return;
    }
    if (!ensureProfileComplete()) return;
    
    try {
      setError(null);
      if (currentApplication && currentApplication.state_id === "DRAFT") {
        // Update existing draft — send rowVersion for optimistic concurrency
        const res = await fetch(`${apiBaseUrl}/api/v1/applications/${currentApplication.arn}`, {
          ...authHeaders(),
          method: "PUT",
          body: JSON.stringify({
            data: formData,
            userId: user.user_id,
            rowVersion: currentApplication.rowVersion
          })
        });
        
        if (res.status === 409) {
          // Another session/user modified this draft since we loaded it.
          setDraftConflictArn(currentApplication.arn);
          setFeedback({
            variant: "warning",
            text: "This draft was updated in another session. Reload the latest version to continue."
          });
          return;
        }
        
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (typeof data?.error === "string" && data.error.startsWith("PROFILE_INCOMPLETE")) {
            const missing = data.error.split(":")[1] || "";
            setError(null);
            setFeedback({ variant: "warning", text: `Profile incomplete. Missing fields: ${missing}` });
            return;
          }
          throw new Error(data?.error || `API error ${res.status}`);
        }
        const app = await res.json();
        setCurrentApplication({ ...app, rowVersion: app.rowVersion });
        setFormDirty(false);
        showToast("success", "Draft saved successfully.");
        setFeedback({ variant: "success", text: "Draft saved successfully." });
        markSync();
      } else {
        const res = await fetch(`${apiBaseUrl}/api/v1/applications`, {
          ...authHeaders(),
          method: "POST",
          body: JSON.stringify({
            authorityId: formData.authority_id || "PUDA",
            serviceKey: selectedService.serviceKey,
            applicantUserId: user.user_id,
            data: formData
          })
        });
        
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (typeof data?.error === "string" && data.error.startsWith("PROFILE_INCOMPLETE")) {
            const missing = data.error.split(":")[1] || "";
            setError(null);
            showToast("warning", `Profile incomplete. Missing fields: ${missing}`);
            setFeedback({ variant: "warning", text: `Profile incomplete. Missing fields: ${missing}` });
            return;
          }
          throw new Error(data?.error || `API error ${res.status}`);
        }
        const app = await res.json();
        setCurrentApplication({ ...app, rowVersion: app.rowVersion });
        setFormDirty(false);
        showToast("success", "Draft saved successfully.");
        setFeedback({ variant: "success", text: "Draft saved successfully." });
        markSync();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save draft";
      setError(msg);
      showToast("error", msg);
      setFeedback(null);
    }
  };

  const submitApplication = async () => {
    if (!currentApplication || !user) return;
    if (isOffline) {
      setError(null);
      setFeedback({ variant: "warning", text: "You are offline. Submission is unavailable in read-only mode." });
      return;
    }
    if (!ensureProfileComplete()) return;
    
    try {
      setError(null);
      const res = await fetch(`${apiBaseUrl}/api/v1/applications/${currentApplication.arn}/submit`, {
        ...authHeaders(),
        method: "POST",
        body: JSON.stringify({
          userId: user.user_id
        })
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (typeof data?.error === "string" && data.error.startsWith("PROFILE_INCOMPLETE")) {
          const missing = data.error.split(":")[1] || "";
          setError(null);
          setFeedback({ variant: "warning", text: `Profile incomplete. Missing fields: ${missing}` });
          return;
        }
        throw new Error(data?.error || `API error ${res.status}`);
      }
      const result = await res.json();
      setCurrentApplication({ ...currentApplication, arn: result.submittedArn, state_id: "SUBMITTED" });
      setFormDirty(false);
      setSubmissionConfirmation({
        arn: result.submittedArn,
        serviceName: selectedService ? getServiceDisplayName(selectedService.serviceKey) : "",
        submittedAt: new Date().toISOString(),
      });
      showToast("success", `Application submitted successfully. ARN: ${result.submittedArn}`);
      setFeedback({
        variant: "success",
        text: `Application submitted successfully. ARN: ${result.submittedArn}`
      });
      markSync();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      showToast("error", msg);
      setFeedback(null);
    }
  };

  const handleStartApplication = async (service: ServiceSummary) => {
    if (isOffline) {
      setError(null);
      setFeedback({ variant: "warning", text: "You are offline. Starting a new application is disabled in read-only mode." });
      return;
    }

    // Duplicate check for person-linked services (propertyRequired === false)
    const propertyRequired = service.submissionValidation?.propertyRequired !== false;
    if (!propertyRequired) {
      try {
        const res = await fetch(`${apiBaseUrl}/api/v1/applications/check-duplicate`, {
          ...authHeaders(),
          method: "POST",
          body: JSON.stringify({ serviceKey: service.serviceKey }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.hasDuplicate && data.existingApplications?.length > 0) {
            setDuplicateWarning({
              serviceKey: service.serviceKey,
              applications: data.existingApplications,
              pendingService: service,
            });
            return;
          }
        }
      } catch {
        // Non-blocking: proceed even if check fails
      }
    }

    proceedToCreate(service);
  };

  const proceedToCreate = (service: ServiceSummary) => {
    setSelectedService(service);
    setServiceConfig(null);
    setError(null);
    setFeedback(null);
    setDuplicateBanner(null);
    setDuplicateWarning(null);
    setConfigLoading(true);
    loadServiceConfig(service.serviceKey).then(() => {
      navigateTo("create", false);
    }).finally(() => {
      setConfigLoading(false);
    });
  };

  const handleDocumentUpload = async (docTypeId: string, file: File) => {
    if (!currentApplication || !user) return;
    if (isOffline) {
      setError(null);
      showToast("warning", "You are offline. Document upload is unavailable.");
      setFeedback({ variant: "warning", text: "You are offline. Document upload is unavailable in read-only mode." });
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      setError(null);
      const form = new FormData();
      form.append("arn", currentApplication.arn);
      form.append("docTypeId", docTypeId);
      form.append("userId", user.user_id);
      form.append("file", file);

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${apiBaseUrl}/api/v1/documents/upload`);
        xhr.withCredentials = true;
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error("Upload failed"));
        });
        xhr.addEventListener("error", () => reject(new Error("Upload failed")));
        xhr.send(form);
      });

      await loadApplicationDetail(currentApplication.arn);
      showToast("success", `Document uploaded for ${docTypeId}.`);
      setFeedback({ variant: "success", text: `Document uploaded successfully for ${docTypeId}.` });
      markSync();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg);
      showToast("error", msg);
      setFeedback(null);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Upload directly to Document Locker (no ARN needed — used in create view)
  const handleLockerUpload = async (docTypeId: string, file: File) => {
    if (!user) return;
    if (isOffline) {
      showToast("warning", "You are offline. Document upload is unavailable.");
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const form = new FormData();
      form.append("docTypeId", docTypeId);
      form.append("file", file);

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${apiBaseUrl}/api/v1/citizens/me/documents/upload`);
        xhr.withCredentials = true;
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error("Upload failed"));
        });
        xhr.addEventListener("error", () => reject(new Error("Upload failed")));
        xhr.send(form);
      });

      await loadCitizenDocuments();
      showToast("success", `Document uploaded to your locker for ${docTypeId}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      showToast("error", msg);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleReuseDocument = async (citizenDocId: string, docTypeId: string) => {
    if (!currentApplication || !user) return;
    if (isOffline) {
      showToast("warning", "You are offline. Document reuse is unavailable.");
      return;
    }
    try {
      setError(null);
      const res = await fetch(`${apiBaseUrl}/api/v1/citizens/me/documents/reuse`, {
        ...authHeaders(),
        method: "POST",
        body: JSON.stringify({
          citizenDocId,
          arn: currentApplication.arn,
          docTypeId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to reuse document");
      }
      await loadApplicationDetail(currentApplication.arn);
      showToast("success", `Document reused from your Document Locker for ${docTypeId}.`);
      setFeedback({ variant: "success", text: `Document from your locker linked to this application.` });
      markSync();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reuse document";
      setError(msg);
      showToast("error", msg);
    }
  };

  async function openApplication(arn: string, opts?: { skipNav?: boolean }) {
    if (!user) return;
    setError(null);
    setFeedback(null);
    const cacheKey = applicationDetailCacheKey(user.user_id, arn);
    try {
      if (!isOffline) {
        const res = await fetch(`${apiBaseUrl}/api/v1/applications/${arn}`, authHeaders());
        if (res.ok) {
          const appData = await res.json();
          setCurrentApplication({
            arn: appData.arn,
            service_key: appData.service_key,
            state_id: appData.state_id,
            data_jsonb: appData.data_jsonb,
            created_at: appData.created_at,
            submitted_at: appData.submitted_at,
            disposal_type: appData.disposal_type,
            documents: appData.documents,
            rowVersion: appData.rowVersion
          });
          setApplicationDetail(appData);
          writeCached(cacheKey, appData, { schema: CACHE_SCHEMAS.applicationDetail });
          await loadServiceConfig(appData.service_key);
          if (!opts?.skipNav) navigateTo("track", false);
          markSync();
          return;
        }
      }
      const cached = readCached<Application>(cacheKey, {
        schema: CACHE_SCHEMAS.applicationDetail,
        maxAgeMs: CACHE_TTL_MS.applicationDetail,
        validate: isApplicationPayload
      });
      if (cached) {
        const appData = cached.data;
        setCurrentApplication({
          arn: appData.arn,
          service_key: appData.service_key,
          state_id: appData.state_id,
          data_jsonb: appData.data_jsonb,
          created_at: appData.created_at,
          submitted_at: appData.submitted_at,
          disposal_type: appData.disposal_type,
          documents: appData.documents,
          rowVersion: appData.rowVersion
        });
        setApplicationDetail(appData);
        await loadServiceConfig(appData.service_key);
        if (!opts?.skipNav) navigateTo("track", false);
        markStaleData(cached.fetchedAt, isOffline ? "offline" : "error", "application_open");
        return;
      }
      throw new Error("Application details are unavailable offline.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load application");
      setFeedback(null);
    }
  }

  const hasDocumentTypes = !!(serviceConfig?.documents?.documentTypes?.length);

  // Compute NDC-specific FormRenderer props so we can conditionally override submitLabel after
  const ndcFormProps: Record<string, any> = selectedService?.serviceKey === "no_due_certificate"
    ? (() => {
        if (isOffline) return {};
        if (!formData?.property?.upn) {
          return { submitDisabled: true, submitLabel: t("create.select_property") };
        }
        if (ndcPaymentStatusLoading) {
          return { submitDisabled: true, submitLabel: t("create.loading_payment") };
        }
        if (!ndcPaymentStatus) {
          return { submitDisabled: true, submitLabel: t("create.payment_unavailable") };
        }
        if (!ndcPaymentStatus.certificateEligible) {
          return {
            submitOverride: (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "var(--space-1)" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--color-warning)", fontWeight: 500 }}>
                  {t("create.clear_dues")}
                </span>
                <button
                  type="button"
                  className="form-action-btn form-action-btn--primary"
                  disabled
                  title="Pay all dues using the Pay Now buttons in the ledger above"
                >
                  {t("create.submit_dues_pending")}
                </button>
              </div>
            ),
          };
        }
        return { submitLabel: t("create.submit_get_cert") };
      })()
    : {};

  const ndcPaymentStatusPanel =
    selectedService?.serviceKey === "no_due_certificate" ? (
      <section className="ndc-payment-panel" id="ndc-payment-status-panel">
        <h3>{t("ndc.payment_status")}</h3>
        {!formData?.property?.upn ? (
          <Alert variant="info">{t("ndc.select_upn")}</Alert>
        ) : null}
        {ndcPaymentStatusLoading ? (
          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            <SkeletonBlock height="2.5rem" />
            <SkeletonBlock height="8rem" />
          </div>
        ) : null}
        {ndcPaymentStatusError ? <Alert variant="warning">{ndcPaymentStatusError}</Alert> : null}
        {ndcPaymentPostingError ? <Alert variant="warning">{ndcPaymentPostingError}</Alert> : null}
        {ndcPaymentStatus ? (
          <>
            <p style={{ margin: "0 0 0.75rem", color: "var(--color-text-muted)" }}>
              {t("ndc.allotment_info", { date: ndcPaymentStatus.allotmentDate || "—", value: formatCurrency(ndcPaymentStatus.propertyValue), rate: ndcPaymentStatus.annualInterestRatePct, dcf: ndcPaymentStatus.dcfRatePct })}
            </p>
            <div className="ndc-payment-summary">
              <Card className="ndc-payment-kpi">
                <span>{t("ndc.total_due")}</span>
                <strong>{formatCurrency(ndcPaymentStatus.totals.totalDueAmount)}</strong>
              </Card>
              <Card className="ndc-payment-kpi">
                <span>{t("ndc.total_paid")}</span>
                <strong>{formatCurrency(ndcPaymentStatus.totals.paidAmount)}</strong>
              </Card>
              <Card className="ndc-payment-kpi">
                <span>{t("ndc.pending_balance")}</span>
                <strong>{formatCurrency(ndcPaymentStatus.totals.balanceAmount)}</strong>
              </Card>
            </div>
            {ndcPaymentStatus.certificateEligible ? (
              <Alert variant="success">
                {t("ndc.certificate_eligible", { upn: ndcPaymentStatus.propertyUpn })}
              </Alert>
            ) : (
              <Alert variant="warning">
                {t("ndc.dues_pending")}
              </Alert>
            )}
            <div className="ndc-payment-table-wrap">
              <table className="ndc-payment-table">
                <thead>
                  <tr>
                    <th>{t("ndc.due_type")}</th>
                    <th>{t("ndc.due_date")}</th>
                    <th>{t("ndc.payment_date")}</th>
                    <th>{t("ndc.delay_days")}</th>
                    <th>{t("ndc.base")}</th>
                    <th>{t("ndc.interest")}</th>
                    <th>{t("ndc.total")}</th>
                    <th>{t("ndc.paid")}</th>
                    <th>{t("ndc.balance")}</th>
                    <th>{t("ndc.status")}</th>
                    <th>{t("ndc.action")}</th>
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
                      <td data-label="Total">{formatCurrency(due.totalDueAmount)}</td>
                      <td data-label="Paid">{formatCurrency(due.paidAmount)}</td>
                      <td data-label="Balance">{formatCurrency(due.balanceAmount)}</td>
                      <td data-label="Status">{due.status}</td>
                      <td data-label="Action">
                        {due.balanceAmount > 0.01 ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="form-action-btn"
                            onClick={() => void postNdcPaymentByUpn(due.dueCode)}
                            disabled={Boolean(ndcPaymentPostingDueCode)}
                          >
                            {ndcPaymentPostingDueCode === due.dueCode ? t("ndc.posting") : t("ndc.pay_now")}
                          </Button>
                        ) : (
                          t("ndc.paid")
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>
    ) : null;

  if (view === "create" && selectedService) {
    return appShell(
      <CreateApplication
        selectedService={selectedService}
        serviceConfig={serviceConfig}
        formData={formData}
        formStep={formStep}
        error={error}
        feedback={feedback}
        configLoading={configLoading}
        profileLoading={profileLoading}
        profileComplete={profileComplete}
        profileMissingFields={profileMissingFields}
        duplicateBanner={duplicateBanner}
        isOffline={isOffline}
        language={preferences.language}
        citizenProperties={citizenProperties}
        citizenDocuments={citizenDocuments}
        uploading={uploading}
        uploadProgress={uploadProgress}
        hasDocumentTypes={hasDocumentTypes}
        ndcFormProps={ndcFormProps}
        ndcPaymentStatusPanel={ndcPaymentStatusPanel}
        resilienceBanner={renderResilienceBanner()}
        profileEditorOpen={profileEditorOpen}
        profileEditorSaving={profileEditorSaving}
        profileEditorError={profileEditorError}
        profileDraft={profileDraft}
        draftConflictArn={draftConflictArn}
        resolvingDraftConflict={resolvingDraftConflict}
        onFormDataChange={(data) => { setFormData(data); setFormDirty(true); }}
        onFormStepChange={setFormStep}
        onCreateApplication={createApplication}
        onSaveDraft={saveDraft}
        onLookupUpn={async (upn) => {
          const res = await fetch(
            `${apiBaseUrl}/api/v1/citizens/me/property-lookup?upn=${encodeURIComponent(upn)}`,
            authHeaders()
          );
          if (!res.ok) return null;
          const json = await res.json();
          if (json.property) {
            loadCitizenProperties();
            return json.property;
          }
          return null;
        }}
        onLoadCitizenProperties={loadCitizenProperties}
        onHandleLockerUpload={handleLockerUpload}
        onOpenProfileEditor={openProfileEditor}
        onSetProfileEditorOpen={setProfileEditorOpen}
        onProfileDraftChange={setProfileDraft}
        onSaveProfileDraft={saveProfileDraft}
        onSetDraftConflictArn={setDraftConflictArn}
        onReloadLatestDraftVersion={reloadLatestDraftVersion}
        onBack={navigateBack}
        onClearError={() => setError(null)}
        onOpenApplication={(arn) => openApplication(arn)}
      />
    );
  }

  if (view === "track" && currentApplication) {
    return appShell(
      <TrackApplication
        currentApplication={currentApplication}
        serviceConfig={serviceConfig}
        applicationDetail={applicationDetail}
        feedback={feedback}
        userId={user.user_id}
        submissionConfirmation={submissionConfirmation}
        citizenDocuments={citizenDocuments}
        uploading={uploading}
        uploadProgress={uploadProgress}
        isOffline={isOffline}
        staleAt={lastSyncAt}
        onDismissConfirmation={() => setSubmissionConfirmation(null)}
        onQueryResponded={async () => {
          if (currentApplication?.arn) {
            await loadApplicationDetail(currentApplication.arn);
          }
        }}
        onBack={() => {
          setCurrentApplication(null);
          setApplicationDetail(null);
          navigateBack();
        }}
        onSubmit={currentApplication.state_id === "DRAFT" ? submitApplication : undefined}
        onDocumentUpload={handleDocumentUpload}
        onReuseDocument={handleReuseDocument}
      />
    );
  }

  if (view === "profile") {
    return appShell(
      <ProfileView
        profileApplicant={profileApplicant}
        profileAddresses={profileAddresses}
        profileVerification={profileVerification}
        profileCompleteness={profileCompleteness}
        onProfileUpdate={handleProfileUpdate}
        onProfileComplete={(data) => {
          setProfileApplicant(data.applicant || {});
          setProfileAddresses(data.addresses || {});
          setProfileComplete(Boolean(data.completeness?.isComplete));
          setProfileMissingFields(data.completeness?.missingFields || []);
          setProfileVerification(data.verification || {});
          setProfileCompleteness(data.completeness || null);
          if (user) writeCached(profileCacheKey(user.user_id), data, { schema: CACHE_SCHEMAS.profile });
          showToast("success", "Profile completed successfully!");
          navigateTo("catalog", true);
        }}
        onProfileSkip={() => navigateTo("catalog", true)}
        onReVerifyAadhaar={() => {
          setProfileVerification((prev: any) => ({ ...prev, onboarding_completed_at: undefined, aadhaar_verified: false }));
        }}
        onReVerifyPan={() => {
          setProfileVerification((prev: any) => ({ ...prev, onboarding_completed_at: undefined, pan_verified: false }));
        }}
      />
    );
  }

  // Profile Update (placeholder)
  if (view === "profile-update") {
    const sectionLabel = profileUpdateSection
      ? t(`profile.section_${profileUpdateSection}`)
      : t("nav.profile");
    return appShell(
      <div className="page">
        <a href="#citizen-main-profile-update" className="skip-link">{t("common.skip_to_main")}</a>
        <h1>{t("profile.update_title", { section: sectionLabel })}</h1>
        <main id="citizen-main-profile-update" className="panel" role="main">
          <Card style={{ textAlign: "center", padding: "var(--space-8) var(--space-5)" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-subtle)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "var(--space-3)" }}>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <h2 style={{ margin: "0 0 var(--space-2)", fontSize: "1.1rem" }}>{t("profile.update_coming_title")}</h2>
            <p style={{ color: "var(--color-text-subtle)", fontSize: "0.9rem", margin: "0 0 var(--space-4)" }}>{t("profile.update_coming_desc")}</p>
            <Button variant="secondary" onClick={navigateBack}>{t("profile.update_back")}</Button>
          </Card>
        </main>
      </div>
    );
  }

  // Citizen Guide View
  if (view === "guide") {
    return appShell(
      <div className="page">
        <a href="#citizen-main-guide" className="skip-link">{t("common.skip_to_main")}</a>
        <h1><Bilingual tKey="nav.guide" /></h1>
        <p className="subtitle">{t("guide.subtitle")}</p>
        <main id="citizen-main-guide" className="panel" role="main">
          <Card style={{ textAlign: "center", padding: "var(--space-8) var(--space-5)" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-subtle)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "var(--space-3)" }}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            <h2 style={{ margin: "0 0 var(--space-2)", fontSize: "1.1rem" }}>{t("guide.coming_soon_title")}</h2>
            <p style={{ color: "var(--color-text-subtle)", fontSize: "0.9rem", margin: 0 }}>{t("guide.coming_soon_desc")}</p>
          </Card>
        </main>
      </div>
    );
  }

  // Settings View
  if (view === "settings") {
    return appShell(
      <Suspense fallback={<div className="page"><div className="panel" style={{display:"grid",gap:"var(--space-3)"}}><SkeletonBlock height="2rem" width="50%" /><SkeletonBlock height="2.75rem" /><SkeletonBlock height="2.75rem" /></div></div>}>
        <Settings preferences={preferences} onUpdatePreference={updatePreference} />
      </Suspense>
    );
  }

  // Report Complaint View
  if (view === "complaints") {
    return appShell(
      <div className="page">
        <a href="#citizen-main-complaints" className="skip-link">
          {t("common.skip_to_main")}
        </a>
        <h1><Bilingual tKey="complaints.title" /></h1>
        <p className="subtitle">{t("complaints.subtitle")}</p>
        <main id="citizen-main-complaints" className="panel" role="main">
          {renderResilienceBanner()}
          <Suspense fallback={<div style={{display:"grid",gap:"var(--space-3)"}}><SkeletonBlock height="5rem" /><SkeletonBlock height="5rem" /></div>}>
            <ReportComplaint
              onBack={() => navigateBack()}
              isOffline={isOffline}
            />
          </Suspense>
        </main>
      </div>
    );
  }

  // Document Locker View
  if (view === "locker") {
    return appShell(
      <div className="page">
        <a href="#citizen-main-locker" className="skip-link">
          {t("common.skip_to_main")}
        </a>
        <h1><Bilingual tKey="locker.title" /></h1>
        <p className="subtitle">{t("locker.subtitle")}</p>
        <main id="citizen-main-locker" className="panel" role="main">
          {renderResilienceBanner()}
          <Suspense fallback={<div style={{display:"grid",gap:"var(--space-3)"}}><SkeletonBlock height="5rem" /><SkeletonBlock height="5rem" /></div>}>
            <DocumentLocker
              onBack={() => {
                setLockerFilter(undefined);
                navigateBack();
              }}
              isOffline={isOffline}
              initialFilter={lockerFilter}
            />
          </Suspense>
        </main>
      </div>
    );
  }

  if (view === "applications") {
    return appShell(
      <AllApplications
        applications={applications}
        loading={loading}
        error={error}
        feedback={feedback}
        isOffline={isOffline}
        appSearchQuery={appSearchQuery}
        onAppSearchQueryChange={setAppSearchQuery}
        appStatusFilter={appStatusFilter}
        onAppStatusFilterChange={setAppStatusFilter}
        onBack={navigateBack}
        onOpenApplication={(arn) => openApplication(arn)}
        onNavigateToCatalog={() => navigateTo("catalog", false)}
        resilienceBanner={renderResilienceBanner()}
      />
    );
  }

  return appShell(
    <ServiceCatalog
      services={services}
      catalogSearch={catalogSearch}
      onCatalogSearchChange={setCatalogSearch}
      loading={loading}
      error={error}
      feedback={feedback}
      isOffline={isOffline}
      duplicateWarning={duplicateWarning}
      onDismissDuplicateWarning={() => setDuplicateWarning(null)}
      onStartApplication={handleStartApplication}
      onOpenApplication={(arn) => openApplication(arn)}
      onProceedToCreate={proceedToCreate}
      resilienceBanner={renderResilienceBanner()}
    />
  );
}
