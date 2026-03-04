import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Input, SkeletonBlock } from "@puda/shared";
import { getStatusBadgeClass, getStatusLabel, formatDate } from "@puda/shared/utils";
import { Bilingual } from "./Bilingual";
import type { ServiceSummary } from "./citizen-types";

type DuplicateWarning = {
  serviceKey: string;
  applications: Array<{ arn: string; state_id: string; created_at: string }>;
  pendingService?: ServiceSummary;
} | null;

type Props = {
  services: ServiceSummary[];
  catalogSearch: string;
  onCatalogSearchChange: (value: string) => void;
  loading: boolean;
  error: string | null;
  feedback: { variant: "info" | "success" | "warning" | "error"; text: string } | null;
  isOffline: boolean;
  duplicateWarning: DuplicateWarning;
  onDismissDuplicateWarning: () => void;
  onStartApplication: (service: ServiceSummary) => void;
  onOpenApplication: (arn: string) => void;
  onProceedToCreate: (service: ServiceSummary) => void;
  resilienceBanner: ReactNode;
};

export default function ServiceCatalog({
  services,
  catalogSearch,
  onCatalogSearchChange,
  loading,
  error,
  feedback,
  isOffline,
  duplicateWarning,
  onDismissDuplicateWarning,
  onStartApplication,
  onOpenApplication,
  onProceedToCreate,
  resilienceBanner,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="page">
      <a href="#citizen-main-catalog" className="skip-link">
        {t("common.skip_to_main")}
      </a>
      <h1><Bilingual tKey="catalog.title" /></h1>
      <p className="subtitle">{t("catalog.subtitle")}</p>

      <main id="citizen-main-catalog" className="panel" role="main">
        {resilienceBanner}
        {feedback ? <Alert variant={feedback.variant} className="view-feedback">{feedback.text}</Alert> : null}
        {loading && (
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            {[1, 2, 3, 4].map((i) => <SkeletonBlock key={i} height="5rem" />)}
          </div>
        )}
        {error ? <Alert variant="error">{error}</Alert> : null}
        {!loading && !error && services.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <h3>{t("catalog.no_services")}</h3>
            <p>{t("catalog.no_services_desc")}</p>
          </div>
        )}
        {!loading && services.length > 0 && (
          <div className="catalog-search-bar">
            <svg className="catalog-search-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <Input
              placeholder={t("catalog.search_placeholder")}
              value={catalogSearch}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onCatalogSearchChange(e.target.value)}
              aria-label={t("catalog.search_placeholder")}
              className="catalog-search-input"
            />
            {catalogSearch && (
              <button type="button" className="catalog-search-clear" onClick={() => onCatalogSearchChange("")} aria-label={t("common.clear_filters")}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        )}
        {(() => {
          const q = catalogSearch.trim().toLowerCase();
          const filtered = q
            ? services.filter((s) => {
                const tKey = `service.${s.serviceKey}`;
                const en = t(tKey, { lng: "en" }).toLowerCase();
                const hi = t(tKey, { lng: "hi" }).toLowerCase();
                const pa = t(tKey, { lng: "pa" }).toLowerCase();
                return en.includes(q) || hi.includes(q) || pa.includes(q) ||
                  s.displayName.toLowerCase().includes(q) ||
                  s.category.toLowerCase().includes(q) ||
                  s.serviceKey.toLowerCase().includes(q);
              })
            : services;
          if (!loading && services.length > 0 && filtered.length === 0) {
            return (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <h3>{t("catalog.no_results")}</h3>
                <p>{t("catalog.no_results_desc")}</p>
              </div>
            );
          }
          return (
        <ul className="service-list">
          {filtered.map((service) => (
            <li key={service.serviceKey} className="service-card-group">
              <div className="service-card">
                <div>
                  <h2><Bilingual tKey={`service.${service.serviceKey}`} /></h2>
                </div>
                <div className="service-actions">
                  <Button onClick={() => onStartApplication(service)} className="action-button" disabled={isOffline}>
                    {t("catalog.apply_now")}
                  </Button>
                </div>
              </div>
              {duplicateWarning && duplicateWarning.serviceKey === service.serviceKey && (
                <Alert variant="warning" className="duplicate-inline-alert">
                  <p style={{ marginBottom: "0.5rem" }}>
                    <strong>You already have {duplicateWarning.applications.length} in-progress application(s) for this service.</strong>
                    {" "}You can view an existing one or continue to create a new application.
                  </p>
                  {duplicateWarning.applications.map((app) => (
                    <Button
                      key={app.arn}
                      type="button"
                      variant="ghost"
                      className="duplicate-app-link"
                      onClick={() => void onOpenApplication(app.arn)}
                    >
                      <span><strong>{app.arn}</strong></span>
                      <span className={`status-badge ${getStatusBadgeClass(app.state_id)}`}>
                        {getStatusLabel(app.state_id)}
                      </span>
                      <span style={{ color: "var(--color-text-subtle)", fontSize: "0.85em" }}>
                        {formatDate(app.created_at)}
                      </span>
                      <span className="app-card-action">{t("common.view")} →</span>
                    </Button>
                  ))}
                  <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "0.75rem" }}>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => {
                        if (duplicateWarning.pendingService) {
                          onProceedToCreate(duplicateWarning.pendingService);
                        }
                      }}
                    >
                      {t("catalog.duplicate_continue")}
                    </Button>
                    <Button type="button" variant="ghost" onClick={onDismissDuplicateWarning}>
                      {t("catalog.dismiss")}
                    </Button>
                  </div>
                </Alert>
              )}
            </li>
          ))}
        </ul>
          );
        })()}
      </main>
    </div>
  );
}
