import { Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import { Button, SkeletonBlock } from "@puda/shared";
import { Bilingual } from "./Bilingual";
import type { Application, FeedbackMessage } from "./citizen-types";

const ApplicationDetail = lazy(() => import("./ApplicationDetail"));

type SubmissionConfirmation = {
  arn: string;
  serviceName: string;
  submittedAt: string;
} | null;

type Props = {
  currentApplication: Application;
  serviceConfig: any;
  applicationDetail: any;
  feedback: FeedbackMessage | null;
  userId: string;
  submissionConfirmation: SubmissionConfirmation;
  citizenDocuments: any[];
  uploading: boolean;
  uploadProgress: number;
  isOffline: boolean;
  staleAt: number | null;
  onDismissConfirmation: () => void;
  onQueryResponded: () => Promise<void>;
  onBack: () => void;
  onSubmit: (() => Promise<void>) | undefined;
  onDocumentUpload: (file: File, docTypeId: string) => Promise<void>;
  onReuseDocument: (docId: string, docTypeId: string) => void;
};

export default function TrackApplication({
  currentApplication,
  serviceConfig,
  applicationDetail,
  feedback,
  userId,
  submissionConfirmation,
  citizenDocuments,
  uploading,
  uploadProgress,
  isOffline,
  staleAt,
  onDismissConfirmation,
  onQueryResponded,
  onBack,
  onSubmit,
  onDocumentUpload,
  onReuseDocument,
}: Props) {
  const { t } = useTranslation();

  return (
    <Suspense fallback={<div className="page"><div className="panel" style={{display:"grid",gap:"var(--space-3)"}}><SkeletonBlock height="2rem" width="50%" /><SkeletonBlock height="4rem" /><SkeletonBlock height="4rem" /></div></div>}>
      {submissionConfirmation && (
        <div className="submission-confirmation">
          <div className="submission-confirmation__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h2 className="submission-confirmation__title"><Bilingual tKey="confirm.title" /></h2>
          <div className="submission-confirmation__details">
            <div className="submission-confirmation__row">
              <span className="submission-confirmation__label"><Bilingual tKey="confirm.arn_label" /></span>
              <span className="submission-confirmation__value submission-confirmation__arn">{submissionConfirmation.arn}</span>
            </div>
            {submissionConfirmation.serviceName && (
              <div className="submission-confirmation__row">
                <span className="submission-confirmation__label"><Bilingual tKey="app_detail.service" /></span>
                <span className="submission-confirmation__value">{submissionConfirmation.serviceName}</span>
              </div>
            )}
            <div className="submission-confirmation__row">
              <span className="submission-confirmation__label"><Bilingual tKey="confirm.submitted_at" /></span>
              <span className="submission-confirmation__value">{new Date(submissionConfirmation.submittedAt).toLocaleString()}</span>
            </div>
          </div>
          <div className="submission-confirmation__next">
            <h3><Bilingual tKey="confirm.what_next" /></h3>
            <ol className="submission-confirmation__steps">
              <li>{t("confirm.step1")}</li>
              <li>{t("confirm.step2")}</li>
              <li>{t("confirm.step3")}</li>
            </ol>
          </div>
          <Button variant="primary" onClick={onDismissConfirmation}>
            {t("confirm.view_application")}
          </Button>
        </div>
      )}
      {!submissionConfirmation && <ApplicationDetail
        application={currentApplication}
        serviceConfig={serviceConfig}
        detail={applicationDetail || { documents: [], queries: [], tasks: [], timeline: [] }}
        feedback={feedback}
        userId={userId}
        onQueryResponded={onQueryResponded}
        onBack={onBack}
        onSubmit={onSubmit}
        onDocumentUpload={onDocumentUpload}
        onReuseDocument={onReuseDocument}
        citizenDocuments={citizenDocuments}
        uploading={uploading}
        uploadProgress={uploadProgress}
        isOffline={isOffline}
        staleAt={staleAt}
      />}
    </Suspense>
  );
}
