import { lazy, Suspense, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SkeletonBlock } from "@puda/shared";
import { Bilingual } from "../Bilingual";

const PlatformConnectors = lazy(() => import("./PlatformConnectors"));
const DetectionDictionary = lazy(() => import("./DetectionDictionary"));
const MonitoringConfig = lazy(() => import("./MonitoringConfig"));
const LegalRuleAdmin = lazy(() => import("./LegalRuleAdmin"));
const TemplateAdmin = lazy(() => import("./TemplateAdmin"));
const EarlyWarningDashboard = lazy(() => import("./EarlyWarningDashboard"));
const PlatformCooperation = lazy(() => import("./PlatformCooperation"));
const Admin = lazy(() => import("./Admin"));
const ModelAdmin = lazy(() => import("./ModelAdmin"));
const AuditLog = lazy(() => import("./AuditLog"));
const SupervisorAudit = lazy(() => import("./SupervisorAudit"));
const SlaDashboard = lazy(() => import("./SlaDashboard"));
const EscalationQueue = lazy(() => import("./EscalationQueue"));
const SupervisorDashboard = lazy(() => import("./SupervisorDashboard"));

type SectionKey =
  | "connectors" | "detection" | "monitoring"
  | "legal-rules" | "templates"
  | "early-warning" | "platform-coop"
  | "users" | "model-admin"
  | "audit-log" | "supervisor-audit" | "sla" | "escalation" | "supervisor-dash";

type Group = { label: string; sections: { key: SectionKey; label: string }[] };

const GROUPS: Group[] = [
  { label: "admin_hub.group_setup", sections: [
    { key: "connectors", label: "admin_hub.section_connectors" },
    { key: "detection", label: "admin_hub.section_detection" },
    { key: "monitoring", label: "admin_hub.section_monitoring" },
  ]},
  { label: "admin_hub.group_rules", sections: [
    { key: "legal-rules", label: "admin_hub.section_legal_rules" },
    { key: "templates", label: "admin_hub.section_templates" },
  ]},
  { label: "admin_hub.group_operations", sections: [
    { key: "early-warning", label: "admin_hub.section_early_warning" },
    { key: "platform-coop", label: "admin_hub.section_platform_coop" },
  ]},
  { label: "admin_hub.group_users_ai", sections: [
    { key: "users", label: "admin_hub.section_users" },
    { key: "model-admin", label: "admin_hub.section_model_admin" },
  ]},
  { label: "admin_hub.group_audit", sections: [
    { key: "audit-log", label: "admin_hub.section_audit_log" },
    { key: "supervisor-audit", label: "admin_hub.section_supervisor_audit" },
    { key: "sla", label: "admin_hub.section_sla" },
    { key: "escalation", label: "admin_hub.section_escalation" },
    { key: "supervisor-dash", label: "admin_hub.section_supervisor_dash" },
  ]},
];

const ALL_KEYS: SectionKey[] = GROUPS.flatMap((g) => g.sections.map((s) => s.key));

type Props = {
  subView: string | null;
  authHeaders: () => Record<string, string>;
  isOffline: boolean;
  isAdmin: boolean;
  onNavigate: (view: string, id?: string) => void;
};

export default function AdminHub({ subView, authHeaders, isOffline, isAdmin, onNavigate }: Props) {
  const { t } = useTranslation();
  const active: SectionKey = (ALL_KEYS.includes(subView as SectionKey) ? subView : "connectors") as SectionKey;

  useEffect(() => { window.scrollTo(0, 0); }, [active]);

  const handleSelect = (key: SectionKey) => {
    onNavigate("admin", key);
  };

  const fallback = (
    <div style={{ display: "grid", gap: "var(--space-3)" }}>
      <SkeletonBlock height="2rem" width="50%" />
      <SkeletonBlock height="10rem" />
    </div>
  );

  return (
    <div className="admin-hub">
      {/* Desktop sidebar */}
      <nav className="admin-hub__sidebar" aria-label={t("nav.admin_hub")}>
        {GROUPS.map((g) => (
          <div key={g.label}>
            <p className="admin-hub__group-label">{t(g.label)}</p>
            {g.sections.map((s) => (
              <button
                key={s.key}
                className={`admin-hub__nav-item ${s.key === active ? "admin-hub__nav-item--active" : ""}`}
                onClick={() => handleSelect(s.key)}
                type="button"
              >
                <Bilingual tKey={s.label} />
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Mobile dropdown */}
      <select
        className="admin-hub__mobile-select"
        value={active}
        onChange={(e) => handleSelect(e.target.value as SectionKey)}
        aria-label={t("nav.admin_hub")}
      >
        {GROUPS.map((g) => (
          <optgroup key={g.label} label={t(g.label)}>
            {g.sections.map((s) => (
              <option key={s.key} value={s.key}>{t(s.label)}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Content area */}
      <div className="admin-hub__content">
        <Suspense fallback={fallback}>
          {active === "connectors" && <PlatformConnectors authHeaders={authHeaders} isOffline={isOffline} />}
          {active === "detection" && <DetectionDictionary authHeaders={authHeaders} isOffline={isOffline} isAdmin={isAdmin} />}
          {active === "monitoring" && <MonitoringConfig authHeaders={authHeaders} isOffline={isOffline} isAdmin={isAdmin} />}
          {active === "legal-rules" && <LegalRuleAdmin authHeaders={authHeaders} isOffline={isOffline} />}
          {active === "templates" && <TemplateAdmin authHeaders={authHeaders} isOffline={isOffline} />}
          {active === "early-warning" && <EarlyWarningDashboard authHeaders={authHeaders} isOffline={isOffline} />}
          {active === "platform-coop" && <PlatformCooperation authHeaders={authHeaders} isOffline={isOffline} />}
          {active === "users" && <Admin authHeaders={authHeaders} isOffline={isOffline} />}
          {active === "model-admin" && <ModelAdmin authHeaders={authHeaders} isOffline={isOffline} />}
          {active === "audit-log" && <AuditLog authHeaders={authHeaders} isOffline={isOffline} />}
          {active === "supervisor-audit" && <SupervisorAudit authHeaders={authHeaders} isOffline={isOffline} />}
          {active === "sla" && <SlaDashboard authHeaders={authHeaders} isOffline={isOffline} />}
          {active === "escalation" && <EscalationQueue authHeaders={authHeaders} isOffline={isOffline} />}
          {active === "supervisor-dash" && <SupervisorDashboard authHeaders={authHeaders} isOffline={isOffline} onNavigate={onNavigate} />}
        </Suspense>
      </div>
    </div>
  );
}
