import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Card, Input, Select, SkeletonBlock, timeAgo } from "@puda/shared";
import { getStatusBadgeClass, getServiceDisplayName, formatDate } from "@puda/shared/utils";
import { Bilingual } from "./Bilingual";
import type { Application, FeedbackMessage } from "./citizen-types";

type Props = {
  applications: Application[];
  loading: boolean;
  error: string | null;
  feedback: FeedbackMessage | null;
  isOffline: boolean;
  appSearchQuery: string;
  onAppSearchQueryChange: (value: string) => void;
  appStatusFilter: string;
  onAppStatusFilterChange: (value: string) => void;
  onBack: () => void;
  onOpenApplication: (arn: string) => void;
  onNavigateToCatalog: () => void;
  resilienceBanner: ReactNode;
};

const HIGH_LEVEL_STATUS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  RESUBMITTED: "Submitted",
  PENDING_AT_CLERK: "In Progress",
  PENDING_AT_SR_ASSISTANT: "In Progress",
  PENDING_AT_SR_ASSISTANT_ACCOUNTS: "In Progress",
  PENDING_AT_ACCOUNT_OFFICER: "In Progress",
  PENDING_AT_JUNIOR_ENGINEER: "In Progress",
  PENDING_AT_SDE: "In Progress",
  PENDING_AT_SDO: "In Progress",
  PENDING_AT_SDO_PH: "In Progress",
  PENDING_AT_DRAFTSMAN: "In Progress",
  IN_PROGRESS: "In Progress",
  QUERY_PENDING: "Query Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CLOSED: "Closed",
};

function getHighLevelStatus(stateId: string) {
  return HIGH_LEVEL_STATUS[stateId] || "In Progress";
}

export default function AllApplications({
  applications,
  loading,
  error,
  feedback,
  isOffline,
  appSearchQuery,
  onAppSearchQueryChange,
  appStatusFilter,
  onAppStatusFilterChange,
  onBack,
  onOpenApplication,
  onNavigateToCatalog,
  resilienceBanner,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="page">
      <a href="#citizen-main-applications" className="skip-link">
        {t("common.skip_to_main")}
      </a>
      <Button variant="ghost" onClick={onBack} className="back-btn" aria-label={t("common.back")}>
        ← {t("common.back")}
      </Button>
      <h1><Bilingual tKey="common.all_applications" /></h1>
      <p className="subtitle">{t("common.manage_applications")}</p>

      <main id="citizen-main-applications" className="panel" role="main">
        {resilienceBanner}
        {feedback ? <Alert variant={feedback.variant} className="view-feedback">{feedback.text}</Alert> : null}
        {loading && (
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            {[1, 2, 3].map((i) => <SkeletonBlock key={i} height="4.5rem" />)}
          </div>
        )}
        {error ? <Alert variant="error">{error}</Alert> : null}
        {!loading && !error && applications.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M7 3h7l5 5v13H7z" />
                <path d="M14 3v6h5" />
              </svg>
            </div>
            <h3>{t("dashboard.empty_title")}</h3>
            <p>{t("dashboard.empty_message")}</p>
            <Button
              onClick={onNavigateToCatalog}
              fullWidth
              className="empty-state-action"
              disabled={isOffline}
            >
              {t("dashboard.apply_now")}
            </Button>
          </div>
        )}
        {!loading && !error && applications.length > 0 && (() => {
          const q = appSearchQuery.trim().toLowerCase();
          const filteredApps = applications.filter((app) => {
            if (appStatusFilter && getHighLevelStatus(app.state_id) !== appStatusFilter) return false;
            if (!q) return true;
            const serviceName = getServiceDisplayName(app.service_key).toLowerCase();
            const arn = app.arn.toLowerCase();
            const status = getHighLevelStatus(app.state_id).toLowerCase();
            return serviceName.includes(q) || arn.includes(q) || status.includes(q);
          });
          const statusOptions = Array.from(new Set(applications.map((a) => getHighLevelStatus(a.state_id)))).sort();
          return (
            <>
              <div className="app-search-bar">
                <Input
                  placeholder={t("common.search_placeholder")}
                  value={appSearchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onAppSearchQueryChange(e.target.value)}
                  aria-label="Search applications"
                />
                <Select
                  value={appStatusFilter}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onAppStatusFilterChange(e.target.value)}
                  aria-label="Filter by status"
                >
                  <option value="">{t("common.all_statuses")}</option>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              </div>
              {filteredApps.length === 0 ? (
                <div className="empty-state">
                  <h3>{t("common.no_matching")}</h3>
                  <p>{t("common.clear_filters")}</p>
                  <Button variant="ghost" onClick={() => { onAppSearchQueryChange(""); onAppStatusFilterChange(""); }}>
                    {t("common.clear_filters")}
                  </Button>
                </div>
              ) : (
                <div className="application-cards">
                  {filteredApps.map((app) => (
                    <Card key={app.arn} className="application-card-wrap">
                      <Button
                        type="button"
                        variant="ghost"
                        className="application-card"
                        onClick={() => onOpenApplication(app.arn)}
                      >
                        <div className="app-card-header">
                          <div className="app-service-name">{getServiceDisplayName(app.service_key)}</div>
                          <span className={`status-badge ${getStatusBadgeClass(app.state_id)}`}>
                            {getHighLevelStatus(app.state_id)}
                          </span>
                        </div>
                        <div className="app-card-arn">{app.arn}</div>
                        <div className="app-card-footer">
                          <span className="app-card-date" title={app.submitted_at ? formatDate(app.submitted_at) : formatDate(app.created_at)}>
                            {timeAgo(app.submitted_at || app.created_at)}
                          </span>
                          <span className="app-card-action">{t("common.view_details")} →</span>
                        </div>
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </>
          );
        })()}
      </main>
    </div>
  );
}
