import { lazy, Suspense, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { SkeletonBlock } from "@puda/shared";

const Dashboard = lazy(() => import("./Dashboard"));
const ControlRoomDashboard = lazy(() => import("./ControlRoomDashboard"));
const LeadershipDashboard = lazy(() => import("./LeadershipDashboard"));
const SupervisorDashboard = lazy(() => import("./SupervisorDashboard"));
const EarlyWarningDashboard = lazy(() => import("./EarlyWarningDashboard"));
const GeoDashboard = lazy(() => import("./GeoDashboard"));
const PendencyDashboard = lazy(() => import("./PendencyDashboard"));

type TabKey = "overview" | "control-room" | "leadership" | "supervisor" | "early-warning" | "geo" | "pendency";

const TABS: { key: TabKey; i18n: string }[] = [
  { key: "overview", i18n: "hub.tab_overview" },
  { key: "control-room", i18n: "hub.tab_control_room" },
  { key: "leadership", i18n: "hub.tab_leadership" },
  { key: "supervisor", i18n: "hub.tab_supervisor" },
  { key: "early-warning", i18n: "hub.tab_early_warning" },
  { key: "geo", i18n: "hub.tab_geo" },
  { key: "pendency", i18n: "hub.tab_pendency" },
];

type Props = {
  subView: string | null;
  authHeaders: () => Record<string, string>;
  isOffline: boolean;
  roles: string[];
  onNavigate: (view: string, id?: string) => void;
};

export default function DashboardHub({ subView, authHeaders, isOffline, onNavigate }: Props) {
  const { t } = useTranslation();
  const activeTab: TabKey = (TABS.find((tb) => tb.key === subView)?.key) || "overview";
  const tabBarRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll active tab into view
  useEffect(() => {
    if (activeRef.current && tabBarRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeTab]);

  // Scroll to top when sub-view changes
  useEffect(() => { window.scrollTo(0, 0); }, [activeTab]);

  const fallback = (
    <div className="panel" style={{ display: "grid", gap: "var(--space-3)" }}>
      <SkeletonBlock height="2rem" width="50%" />
      <SkeletonBlock height="10rem" />
    </div>
  );

  return (
    <div className="panel">
      <div className="tab-bar tab-bar--scrollable" ref={tabBarRef} role="tablist">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            ref={tb.key === activeTab ? activeRef : undefined}
            role="tab"
            aria-selected={tb.key === activeTab}
            className={`tab-btn ${tb.key === activeTab ? "tab-btn--active" : ""}`}
            onClick={() => onNavigate("dashboards", tb.key === "overview" ? undefined : tb.key)}
            type="button"
          >
            {t(tb.i18n)}
          </button>
        ))}
      </div>

      <Suspense fallback={fallback}>
        {activeTab === "overview" && <Dashboard authHeaders={authHeaders} isOffline={isOffline} onNavigate={onNavigate} />}
        {activeTab === "control-room" && <ControlRoomDashboard authHeaders={authHeaders} isOffline={isOffline} onNavigate={onNavigate} />}
        {activeTab === "leadership" && <LeadershipDashboard authHeaders={authHeaders} isOffline={isOffline} onNavigate={onNavigate} />}
        {activeTab === "supervisor" && <SupervisorDashboard authHeaders={authHeaders} isOffline={isOffline} onNavigate={onNavigate} />}
        {activeTab === "early-warning" && <EarlyWarningDashboard authHeaders={authHeaders} isOffline={isOffline} />}
        {activeTab === "geo" && <GeoDashboard authHeaders={authHeaders} isOffline={isOffline} onNavigate={onNavigate} />}
        {activeTab === "pendency" && <PendencyDashboard authHeaders={authHeaders} isOffline={isOffline} onNavigate={onNavigate} />}
      </Suspense>
    </div>
  );
}
