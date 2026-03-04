import type { ReactNode } from "react";
import { Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Button,
  Breadcrumb,
  Field,
  Input,
  Modal,
  Select,
  SkeletonBlock,
} from "@puda/shared";
import { FormRenderer } from "@puda/shared/form-renderer";
import type { FormConfig, CitizenProperty } from "@puda/shared/form-renderer";
import { getStatusLabel, formatDate } from "@puda/shared/utils";
import { ErrorBoundary } from "./ErrorBoundary";
import { Bilingual } from "./Bilingual";
import type { ServiceSummary, FeedbackMessage } from "./citizen-types";

const DocumentUploadPanel = lazy(() => import("./DocumentUploadPanel"));

type DuplicateBanner = {
  applications: Array<{ arn: string; state_id: string; created_at: string }>;
} | null;

type Props = {
  selectedService: ServiceSummary;
  serviceConfig: any;
  formData: any;
  formStep: "form" | "documents";
  error: string | null;
  feedback: FeedbackMessage | null;
  configLoading: boolean;
  profileLoading: boolean;
  profileComplete: boolean;
  profileMissingFields: string[];
  duplicateBanner: DuplicateBanner;
  isOffline: boolean;
  language: string;
  citizenProperties: CitizenProperty[];
  citizenDocuments: any[];
  uploading: boolean;
  uploadProgress: number;
  hasDocumentTypes: boolean;
  ndcFormProps: Record<string, any>;
  ndcPaymentStatusPanel: ReactNode;
  resilienceBanner: ReactNode;
  // Profile editor modal
  profileEditorOpen: boolean;
  profileEditorSaving: boolean;
  profileEditorError: string | null;
  profileDraft: Record<string, any>;
  // Draft conflict modal
  draftConflictArn: string | null;
  resolvingDraftConflict: boolean;
  // Callbacks
  onFormDataChange: (data: any) => void;
  onFormStepChange: (step: "form" | "documents") => void;
  onCreateApplication: () => Promise<void>;
  onSaveDraft: () => void;
  onLookupUpn: (upn: string) => Promise<CitizenProperty | null>;
  onLoadCitizenProperties: () => void;
  onHandleLockerUpload: (file: File, docTypeId: string) => Promise<void>;
  onOpenProfileEditor: () => void;
  onSetProfileEditorOpen: (open: boolean) => void;
  onProfileDraftChange: (updater: (prev: Record<string, any>) => Record<string, any>) => void;
  onSaveProfileDraft: () => Promise<void>;
  onSetDraftConflictArn: (arn: string | null) => void;
  onReloadLatestDraftVersion: () => Promise<void>;
  onBack: () => void;
  onClearError: () => void;
  onOpenApplication: (arn: string) => void;
};

export default function CreateApplication({
  selectedService,
  serviceConfig,
  formData,
  formStep,
  error,
  feedback,
  configLoading,
  profileLoading,
  profileComplete,
  profileMissingFields,
  duplicateBanner,
  isOffline,
  language,
  citizenProperties,
  citizenDocuments,
  uploading,
  uploadProgress,
  hasDocumentTypes,
  ndcFormProps,
  ndcPaymentStatusPanel,
  resilienceBanner,
  profileEditorOpen,
  profileEditorSaving,
  profileEditorError,
  profileDraft,
  draftConflictArn,
  resolvingDraftConflict,
  onFormDataChange,
  onFormStepChange,
  onCreateApplication,
  onSaveDraft,
  onLookupUpn,
  onLoadCitizenProperties,
  onHandleLockerUpload,
  onOpenProfileEditor,
  onSetProfileEditorOpen,
  onProfileDraftChange,
  onSaveProfileDraft,
  onSetDraftConflictArn,
  onReloadLatestDraftVersion,
  onBack,
  onClearError,
  onOpenApplication,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="page">
      <a href="#citizen-main-create" className="skip-link">
        {t("common.skip_to_main")}
      </a>
      <Breadcrumb items={[
        { label: t("nav.services"), onClick: () => { onBack(); onClearError(); } },
        { label: selectedService.displayName }
      ]} />
      <h1>{selectedService.displayName}</h1>

      <main id="citizen-main-create" className="panel" role="main">
        {resilienceBanner}
        {feedback ? <Alert variant={feedback.variant} className="view-feedback">{feedback.text}</Alert> : null}
        {configLoading && (
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <SkeletonBlock height="2rem" width="50%" />
            <SkeletonBlock height="2.75rem" />
            <SkeletonBlock height="2.75rem" />
          </div>
        )}
        {profileLoading && <SkeletonBlock height="2rem" width="40%" />}
        {error ? <Alert variant="error">{error}</Alert> : null}
        {duplicateBanner && duplicateBanner.applications.length > 0 && (
          <Alert variant="warning" className="view-feedback">
            You already have {duplicateBanner.applications.length} in-progress application(s) for this service
            {formData?.property?.upn ? ` and property ${formData.property.upn}` : ""}:
            {duplicateBanner.applications.map((app) => (
              <span key={app.arn} style={{ display: "block", marginTop: "0.25rem" }}>
                <strong>{app.arn}</strong> — {getStatusLabel(app.state_id)} ({formatDate(app.created_at)})
                {" "}
                <Button
                  type="button"
                  variant="ghost"
                  className="ui-btn-ghost"
                  style={{ fontSize: "0.85em", padding: "0 0.25rem" }}
                  onClick={() => void onOpenApplication(app.arn)}
                >
                  View
                </Button>
              </span>
            ))}
          </Alert>
        )}
        {!profileLoading && !profileComplete && (
          <Alert variant="warning">
            Profile incomplete. Missing fields: {profileMissingFields.join(", ") || "Unknown fields"}. Please update your profile.
          </Alert>
        )}
        {!configLoading && serviceConfig?.form && (
          <>
            {/* FormRenderer: keep mounted, hide when on documents step */}
            <div style={{ display: formStep === "form" ? "block" : "none" }}>
              <ErrorBoundary fallback={<Alert variant="error">{t("create.form_error")}</Alert>}>
                <FormRenderer
                  config={serviceConfig.form as FormConfig}
                  initialData={formData}
                  onChange={(data) => { onFormDataChange(data); }}
                  onSubmit={
                    isOffline
                      ? undefined
                      : hasDocumentTypes
                        ? () => onFormStepChange("documents")
                        : async () => { await onCreateApplication(); }
                  }
                  readOnly={isOffline}
                  citizenProperties={citizenProperties}
                  onLookupUpn={onLookupUpn}
                  secondaryLanguage={language}
                  pageActions={[
                    {
                      pageId: "PAGE_APPLICATION",
                      label: t("profile.title"),
                      onClick: onOpenProfileEditor,
                      disabled: isOffline
                    }
                  ]}
                  pageSupplements={{
                    PAGE_PAYMENT: ndcPaymentStatusPanel
                  }}
                  {...ndcFormProps}
                  {...(hasDocumentTypes && !ndcFormProps.submitDisabled && !ndcFormProps.submitOverride
                    ? { submitLabel: t("docs.next_step") }
                    : {}
                  )}
                  appendSteps={hasDocumentTypes ? [{
                    id: "documents",
                    title: "Required Documents",
                    title_hi: "आवश्यक दस्तावेज़",
                    title_pa: "ਲੋੜੀਂਦੇ ਦਸਤਾਵੇਜ਼",
                    onClick: () => onFormStepChange("documents"),
                  }] : []}
                />
              </ErrorBoundary>
              <div className="form-actions-top">
                <Button
                  onClick={onSaveDraft}
                  className="save-draft-btn"
                  type="button"
                  variant="secondary"
                  disabled={isOffline || !profileComplete || profileLoading}
                >
                  {t("create.save_draft")}
                </Button>
              </div>
            </div>

            {/* Documents step: full-page */}
            {formStep === "documents" && hasDocumentTypes && (
              <div className="doc-step">
                <div className="doc-step__progress">
                  <Bilingual tKey="docs.step_label" /> — Step {(serviceConfig.form.pages?.length || 0) + 1} of {(serviceConfig.form.pages?.length || 0) + 1}
                </div>
                <Suspense fallback={null}>
                  <DocumentUploadPanel
                    mode="preview"
                    documentTypes={serviceConfig.documents.documentTypes}
                    citizenDocuments={citizenDocuments}
                    onDocumentUpload={onHandleLockerUpload}
                    uploading={uploading}
                    uploadProgress={uploadProgress}
                    isOffline={isOffline}
                  />
                </Suspense>
                <div className="doc-step__actions">
                  <Button variant="secondary" onClick={() => onFormStepChange("form")}>
                    {t("docs.back_to_form")}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={onSaveDraft}
                    disabled={isOffline || !profileComplete || profileLoading}
                  >
                    {t("create.save_draft")}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => void onCreateApplication()}
                    disabled={isOffline || !profileComplete || profileLoading}
                  >
                    {t("create.create_application")}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
        {!configLoading && serviceConfig && !serviceConfig.form && !error && (
          <Alert variant="warning">{t("create.form_unavailable")}</Alert>
        )}
      </main>
      <Modal
        open={profileEditorOpen}
        onClose={() => {
          if (!profileEditorSaving) onSetProfileEditorOpen(false);
        }}
        title={t("profile.title")}
        description={t("profile.description")}
        actions={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onSetProfileEditorOpen(false)}
              disabled={profileEditorSaving}
            >
              {t("profile.cancel")}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => void onSaveProfileDraft()}
              disabled={profileEditorSaving}
            >
              {profileEditorSaving ? t("profile.saving") : t("profile.save")}
            </Button>
          </>
        }
      >
        <div className="profile-editor-grid">
          {profileEditorError ? <Alert variant="error">{profileEditorError}</Alert> : null}
          <Field label={<Bilingual tKey="profile.salutation" />} htmlFor="profile-salutation">
            <Select
              id="profile-salutation"
              value={profileDraft.salutation || ""}
              onChange={(e) => onProfileDraftChange((prev) => ({ ...prev, salutation: e.target.value }))}
            >
              <option value="">{t("profile.select")}</option>
              <option value="MR">{t("profile.mr")}</option>
              <option value="MS">{t("profile.ms")}</option>
              <option value="MRS">{t("profile.mrs")}</option>
            </Select>
          </Field>
          <Field label={<Bilingual tKey="profile.first_name" />} htmlFor="profile-first-name" required>
            <Input
              id="profile-first-name"
              value={profileDraft.first_name || ""}
              onChange={(e) => onProfileDraftChange((prev) => ({ ...prev, first_name: e.target.value }))}
            />
          </Field>
          <Field label={<Bilingual tKey="profile.middle_name" />} htmlFor="profile-middle-name">
            <Input
              id="profile-middle-name"
              value={profileDraft.middle_name || ""}
              onChange={(e) => onProfileDraftChange((prev) => ({ ...prev, middle_name: e.target.value }))}
            />
          </Field>
          <Field label={<Bilingual tKey="profile.last_name" />} htmlFor="profile-last-name" required>
            <Input
              id="profile-last-name"
              value={profileDraft.last_name || ""}
              onChange={(e) => onProfileDraftChange((prev) => ({ ...prev, last_name: e.target.value }))}
            />
          </Field>
          <Field label={<Bilingual tKey="profile.full_name" />} htmlFor="profile-full-name" required>
            <Input
              id="profile-full-name"
              value={profileDraft.full_name || ""}
              onChange={(e) => onProfileDraftChange((prev) => ({ ...prev, full_name: e.target.value }))}
            />
          </Field>
          <Field label={<Bilingual tKey="profile.father_name" />} htmlFor="profile-father-name" required>
            <Input
              id="profile-father-name"
              value={profileDraft.father_name || ""}
              onChange={(e) => onProfileDraftChange((prev) => ({ ...prev, father_name: e.target.value }))}
            />
          </Field>
          <Field label={<Bilingual tKey="profile.gender" />} htmlFor="profile-gender" required>
            <Select
              id="profile-gender"
              value={profileDraft.gender || ""}
              onChange={(e) => onProfileDraftChange((prev) => ({ ...prev, gender: e.target.value }))}
            >
              <option value="">{t("profile.select")}</option>
              <option value="MALE">{t("profile.male")}</option>
              <option value="FEMALE">{t("profile.female")}</option>
              <option value="OTHER">{t("profile.other")}</option>
            </Select>
          </Field>
          <Field label={<Bilingual tKey="profile.marital_status" />} htmlFor="profile-marital-status" required>
            <Select
              id="profile-marital-status"
              value={profileDraft.marital_status || ""}
              onChange={(e) => onProfileDraftChange((prev) => ({ ...prev, marital_status: e.target.value }))}
            >
              <option value="">{t("profile.select")}</option>
              <option value="SINGLE">{t("profile.single")}</option>
              <option value="MARRIED">{t("profile.married")}</option>
            </Select>
          </Field>
          <Field label={<Bilingual tKey="profile.dob" />} htmlFor="profile-dob" required>
            <Input
              id="profile-dob"
              type="date"
              value={profileDraft.date_of_birth || ""}
              onChange={(e) => onProfileDraftChange((prev) => ({ ...prev, date_of_birth: e.target.value }))}
            />
          </Field>
          <Field label={<Bilingual tKey="profile.aadhaar" />} htmlFor="profile-aadhaar" required>
            <Input
              id="profile-aadhaar"
              value={profileDraft.aadhaar || ""}
              onChange={(e) => onProfileDraftChange((prev) => ({ ...prev, aadhaar: e.target.value }))}
            />
          </Field>
          <Field label={<Bilingual tKey="profile.pan" />} htmlFor="profile-pan" required>
            <Input
              id="profile-pan"
              value={profileDraft.pan || ""}
              onChange={(e) => onProfileDraftChange((prev) => ({ ...prev, pan: e.target.value.toUpperCase() }))}
            />
          </Field>
          <Field label={<Bilingual tKey="profile.email" />} htmlFor="profile-email" required>
            <Input
              id="profile-email"
              type="email"
              value={profileDraft.email || ""}
              onChange={(e) => onProfileDraftChange((prev) => ({ ...prev, email: e.target.value }))}
            />
          </Field>
          <Field label={<Bilingual tKey="profile.mobile" />} htmlFor="profile-mobile" required>
            <Input
              id="profile-mobile"
              value={profileDraft.mobile || ""}
              onChange={(e) => onProfileDraftChange((prev) => ({ ...prev, mobile: e.target.value }))}
            />
          </Field>
        </div>
      </Modal>
      <Modal
        open={Boolean(draftConflictArn)}
        onClose={() => {
          if (!resolvingDraftConflict) onSetDraftConflictArn(null);
        }}
        title="Draft Updated Elsewhere"
        description="A newer version of this draft exists from another session. Reloading will replace your unsaved local changes."
        actions={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onSetDraftConflictArn(null)}
              disabled={resolvingDraftConflict}
            >
              Keep Current Form
            </Button>
            <Button
              type="button"
              variant="warning"
              onClick={() => void onReloadLatestDraftVersion()}
              disabled={resolvingDraftConflict}
            >
              {resolvingDraftConflict ? "Reloading..." : "Reload Latest Draft"}
            </Button>
          </>
        }
      />
    </div>
  );
}
