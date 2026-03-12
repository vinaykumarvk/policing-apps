import { lazy, Suspense, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SkeletonBlock } from "@puda/shared";

const IngestionHub = lazy(() => import("./IngestionHub"));
const PlatformConnectors = lazy(() => import("./PlatformConnectors"));
const DetectionDictionary = lazy(() => import("./DetectionDictionary"));
const MonitoringConfig = lazy(() => import("./MonitoringConfig"));
const LegalRuleAdmin = lazy(() => import("./LegalRuleAdmin"));
const TemplateAdmin = lazy(() => import("./TemplateAdmin"));
const EarlyWarningDashboard = lazy(() => import("./EarlyWarningDashboard"));
const Admin = lazy(() => import("./Admin"));
const ModelAdmin = lazy(() => import("./ModelAdmin"));
const AuditLog = lazy(() => import("./AuditLog"));
const SupervisorAudit = lazy(() => import("./SupervisorAudit"));
const SlaDashboard = lazy(() => import("./SlaDashboard"));
const EscalationQueue = lazy(() => import("./EscalationQueue"));
const SupervisorDashboard = lazy(() => import("./SupervisorDashboard"));
const DataMaintenance = lazy(() => import("./DataMaintenance"));

type SectionKey =
  | "ingestion" | "connectors" | "detection" | "monitoring"
  | "legal-rules" | "templates"
  | "early-warning"
  | "users" | "model-admin"
  | "audit-log" | "supervisor-audit" | "sla" | "escalation" | "supervisor-dash"
  | "entity-sync";

type Section = { key: SectionKey; label: string; icon: string };
type Group = { label: string; sections: Section[] };

const GROUPS: Group[] = [
  { label: "admin_hub.group_ingestion", sections: [
    { key: "ingestion",  label: "admin_hub.section_ingestion",  icon: "\u{1F4E5}" },
    { key: "connectors", label: "admin_hub.section_connectors", icon: "\u{1F517}" },
  ]},
  { label: "admin_hub.group_setup", sections: [
    { key: "detection",  label: "admin_hub.section_detection",  icon: "\u{1F50D}" },
    { key: "monitoring", label: "admin_hub.section_monitoring", icon: "\u{1F514}" },
  ]},
  { label: "admin_hub.group_rules", sections: [
    { key: "legal-rules", label: "admin_hub.section_legal_rules", icon: "\u{2696}" },
    { key: "templates",   label: "admin_hub.section_templates",   icon: "\u{1F4DD}" },
  ]},
  { label: "admin_hub.group_operations", sections: [
    { key: "early-warning", label: "admin_hub.section_early_warning", icon: "\u{26A0}" },
  ]},
  { label: "admin_hub.group_users_ai", sections: [
    { key: "users",       label: "admin_hub.section_users",       icon: "\u{1F465}" },
    { key: "model-admin", label: "admin_hub.section_model_admin", icon: "\u{1F916}" },
  ]},
  { label: "admin_hub.group_maintenance", sections: [
    { key: "entity-sync", label: "admin_hub.section_entity_sync", icon: "\u{1F504}" },
  ]},
  { label: "admin_hub.group_audit", sections: [
    { key: "audit-log",       label: "admin_hub.section_audit_log",       icon: "\u{1F4DC}" },
    { key: "supervisor-audit", label: "admin_hub.section_supervisor_audit", icon: "\u{1F441}" },
    { key: "sla",             label: "admin_hub.section_sla",             icon: "\u{23F1}" },
    { key: "escalation",     label: "admin_hub.section_escalation",     icon: "\u{1F6A8}" },
    { key: "supervisor-dash", label: "admin_hub.section_supervisor_dash", icon: "\u{1F4CA}" },
  ]},
];

const ALL_KEYS: SectionKey[] = GROUPS.flatMap((g) => g.sections.map((s) => s.key));

type Props = {
  authHeaders: () => Record<string, string>;
  isOffline: boolean;
  onNavigate: (view: string, id?: string) => void;
};

export default function AdminHub({ authHeaders, isOffline, onNavigate }: Props) {
  const { t } = useTranslation();

  // Read sub-view from URL hash: #admin-hub/ingestion
  const hashParts = (typeof window !== "undefined" ? window.location.hash : "").replace("#", "").split("/");
  const subViewFromHash = hashParts.length > 1 ? hashParts[1] : null;
  const active: SectionKey = (ALL_KEYS.includes(subViewFromHash as SectionKey) ? subViewFromHash : "ingestion") as SectionKey;

  useEffect(() => { window.scrollTo(0, 0); }, [active]);

  const handleSelect = (key: SectionKey) => {
    window.location.hash = `admin-hub/${key}`;
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
      <nav className="admin-hub__sidebar" aria-label={t("admin_hub.title")}>
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
                <span className="admin-hub__nav-icon">{s.icon}</span>
                {t(s.label)}
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
        aria-label={t("admin_hub.title")}
      >
        {GROUPS.map((g) => (
          <optgroup key={g.label} label={t(g.label)}>
            {g.sections.map((s) => (
              <option key={s.key} value={s.key}>{s.icon} {t(s.label)}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Content area */}
      <div className="admin-hub__content">
        <Suspense fallback={fallback}>
          {active === "ingestion" && <IngestionHub authHeaders={authHeaders} isOffline={isOffline} />}
          {active === "connectors" && <PlatformConnectors authHeaders={authHeaders} isOffline={isOffline} />}
          {active === "detection" && <DetectionDictionary authHeaders={authHeaders} isOffline={isOffline} isAdmin />}
          {active === "monitoring" && <MonitoringConfig authHeaders={authHeaders} isOffline={isOffline} isAdmin />}
          {active === "legal-rules" && <LegalRuleAdmin authHeaders={authHeaders} isOffline={isOffline} />}
          {active === "templates" && <TemplateAdmin authHeaders={authHeaders} isOffline={isOffline} />}
          {active === "early-warning" && <EarlyWarningDashboard authHeaders={authHeaders} isOffline={isOffline} />}
          {active === "users" && <Admin authHeaders={authHeaders} isOffline={isOffline} />}
          {active === "model-admin" && <ModelAdmin authHeaders={authHeaders} isOffline={isOffline} />}
          {active === "entity-sync" && <DataMaintenance authHeaders={authHeaders} isOffline={isOffline} />}
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
