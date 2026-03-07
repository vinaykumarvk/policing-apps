/**
 * Social Media Intel UI — Main App shell with sidebar nav, bottom nav, and hash routing.
 */
import { useState, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import "./app.css";
import {
  Alert, Button, Modal, Drawer, useToast, useIdleTimeout, SkeletonBlock,
  parseHash, buildHash, pushHash, replaceHash, isSuppressed, validateView,
} from "@puda/shared";
import { useAuth } from "./useAuth";
import Login from "./Login";
import { useTheme } from "./theme";
import { clearCachedState } from "./cache";
import { apiBaseUrl } from "./types";

const Dashboard = lazy(() => import("./views/Dashboard"));
const AlertList = lazy(() => import("./views/AlertList"));
const AlertDetail = lazy(() => import("./views/AlertDetail"));
const CaseList = lazy(() => import("./views/CaseList"));
const CaseDetail = lazy(() => import("./views/CaseDetail"));
const ContentList = lazy(() => import("./views/ContentList"));
const ContentDetail = lazy(() => import("./views/ContentDetail"));
const EvidenceDetail = lazy(() => import("./views/EvidenceDetail"));
const WatchlistManager = lazy(() => import("./views/WatchlistManager"));
const ReportDetail = lazy(() => import("./views/ReportDetail"));
const TaskInbox = lazy(() => import("./views/TaskInbox"));
const QueryAssistant = lazy(() => import("./views/QueryAssistant"));
const NetworkGraph = lazy(() => import("./views/NetworkGraph"));
const ModelAdmin = lazy(() => import("./views/ModelAdmin"));
const Settings = lazy(() => import("./views/Settings"));
const Admin = lazy(() => import("./views/Admin"));
const AuditLog = lazy(() => import("./views/AuditLog"));

type View =
  | "dashboard" | "alerts" | "alert-detail"
  | "cases" | "case-detail"
  | "content" | "content-detail"
  | "evidence-detail" | "watchlists" | "report-detail"
  | "inbox" | "query-assistant" | "network-graph" | "model-admin"
  | "settings" | "admin"
  | "audit-log";

const VALID_VIEWS = [
  "", "dashboard", "alerts", "cases", "content", "evidence", "watchlists", "reports", "inbox",
  "query-assistant", "network-graph", "model-admin",
  "settings", "admin", "audit-log",
] as const;

const NAV_ITEMS: { view: View; key: string; icon: string }[] = [
  { view: "dashboard", key: "nav.dashboard", icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
  { view: "alerts", key: "nav.alerts", icon: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" },
  { view: "cases", key: "nav.cases", icon: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" },
  { view: "content", key: "nav.content", icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { view: "watchlists", key: "nav.watchlists", icon: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" },
];

function SvgIcon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export default function App() {
  const { auth, login, logout, authHeaders, roles } = useAuth();
  const { theme, setTheme } = useTheme("sm_theme");
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [view, setView] = useState<View>("dashboard");
  const [resourceId, setResourceId] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== "undefined" ? !navigator.onLine : false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const avatarBtnRef = useRef<HTMLButtonElement>(null);
  const hashInitializedRef = useRef(false);

  // Notification bell state
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ notification_id: string; title: string; message: string; entity_type?: string; entity_id?: string; is_read: boolean; created_at: string }>>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  // Search bar state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ entity_type: string; entity_id: string; title: string; snippet?: string }>>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAdmin = roles.includes("admin");

  const handleLogout = useCallback(() => { clearCachedState(); window.location.hash = ""; logout(); }, [logout]);

  const { showWarning: idleWarning, dismissWarning } = useIdleTimeout(handleLogout);

  useEffect(() => {
    const on = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    if (!avatarMenuOpen) return;
    const handleDown = (e: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node) && avatarBtnRef.current && !avatarBtnRef.current.contains(e.target as Node)) setAvatarMenuOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setAvatarMenuOpen(false); };
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleDown); document.removeEventListener("keydown", handleKey); };
  }, [avatarMenuOpen]);

  // Poll for unread notification count every 30s
  useEffect(() => {
    if (!auth) return;
    const fetchCount = () => {
      fetch(`${apiBaseUrl}/api/v1/notifications/count`, authHeaders())
        .then((r) => r.ok ? r.json() : { count: 0 })
        .then((data) => setUnreadCount(data.count || 0))
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [auth, authHeaders]);

  // Close notif panel on outside click
  useEffect(() => {
    if (!notifOpen) return;
    const handleDown = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [notifOpen]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetch(`${apiBaseUrl}/api/v1/search?q=${encodeURIComponent(searchQuery)}&limit=10`, authHeaders())
        .then((r) => r.ok ? r.json() : { results: [] })
        .then((data) => setSearchResults(data.results || []))
        .catch(() => setSearchResults([]));
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery, authHeaders]);

  // Close search on outside click
  useEffect(() => {
    if (!searchOpen && !searchQuery) return;
    const handleDown = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) { setSearchOpen(false); }
    };
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [searchOpen, searchQuery]);

  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  // Hash routing
  const viewToHash = useCallback((): string => {
    if (view === "alert-detail" && resourceId) return buildHash("alerts", resourceId);
    if (view === "case-detail" && resourceId) return buildHash("cases", resourceId);
    if (view === "content-detail" && resourceId) return buildHash("content", resourceId);
    if (view === "evidence-detail" && resourceId) return buildHash("evidence", resourceId);
    if (view === "report-detail" && resourceId) return buildHash("reports", resourceId);
    if (view === "dashboard") return buildHash("dashboard");
    if (view === "alerts") return buildHash("alerts");
    if (view === "cases") return buildHash("cases");
    if (view === "content") return buildHash("content");
    if (view === "watchlists") return buildHash("watchlists");
    if (view === "inbox") return buildHash("inbox");
    if (view === "query-assistant") return buildHash("query-assistant");
    if (view === "network-graph") return buildHash("network-graph");
    if (view === "model-admin") return buildHash("model-admin");
    if (view === "settings") return buildHash("settings");
    if (view === "admin") return buildHash("admin");
    if (view === "audit-log") return buildHash("audit-log");
    return buildHash("dashboard");
  }, [view, resourceId]);

  useEffect(() => { if (!auth || !hashInitializedRef.current) return; pushHash(viewToHash()); }, [auth, view, resourceId]);

  useEffect(() => {
    if (!auth || hashInitializedRef.current) return;
    hashInitializedRef.current = true;
    const hash = window.location.hash;
    if (!hash || hash === "#" || hash === "#/") { replaceHash(buildHash("dashboard")); return; }
    const parsed = parseHash(hash);
    const v = validateView(parsed.view, VALID_VIEWS, "dashboard");
    if (parsed.resourceId) {
      const dm: Record<string, View> = { alerts: "alert-detail", cases: "case-detail", content: "content-detail", evidence: "evidence-detail", reports: "report-detail" };
      if (dm[v]) { setView(dm[v]); setResourceId(parsed.resourceId); return; }
    }
    const sm: Record<string, View> = { dashboard: "dashboard", alerts: "alerts", cases: "cases", content: "content", watchlists: "watchlists", inbox: "inbox", "query-assistant": "query-assistant", "network-graph": "network-graph", "model-admin": "model-admin", settings: "settings", admin: "admin", "audit-log": "audit-log" };
    setView(sm[v] || "dashboard");
  }, [auth]);

  useEffect(() => {
    if (!auth) return;
    const handle = () => {
      if (isSuppressed()) return;
      const parsed = parseHash(window.location.hash);
      const v = validateView(parsed.view, VALID_VIEWS, "dashboard");
      if (parsed.resourceId) {
        const dm: Record<string, View> = { alerts: "alert-detail", cases: "case-detail", content: "content-detail", evidence: "evidence-detail", reports: "report-detail" };
        if (dm[v]) { setView(dm[v]); setResourceId(parsed.resourceId); return; }
      }
      const sm: Record<string, View> = { dashboard: "dashboard", alerts: "alerts", cases: "cases", content: "content", watchlists: "watchlists", inbox: "inbox", "query-assistant": "query-assistant", "network-graph": "network-graph", "model-admin": "model-admin", settings: "settings", admin: "admin", "audit-log": "audit-log" };
      setView(sm[v] || "dashboard"); setResourceId(null);
    };
    window.addEventListener("popstate", handle);
    return () => window.removeEventListener("popstate", handle);
  }, [auth]);

  useEffect(() => { if (auth) return; hashInitializedRef.current = false; window.location.hash = ""; }, [auth]);

  const navigate = (target: View, id?: string) => { setResourceId(id || null); setView(target); setDrawerOpen(false); };

  const entityTypeToView = (entityType: string): View => {
    const map: Record<string, View> = {
      alerts: "alert-detail",
      cases: "case-detail",
      content: "content-detail",
      evidence: "evidence-detail",
      reports: "report-detail",
    };
    return map[entityType] || "dashboard";
  };

  const handleNotifToggle = () => {
    if (!notifOpen) {
      fetch(`${apiBaseUrl}/api/v1/notifications?unread=true&limit=10`, authHeaders())
        .then((r) => r.ok ? r.json() : { notifications: [] })
        .then((data) => setNotifications(data.notifications || []))
        .catch(() => setNotifications([]));
    }
    setNotifOpen((o) => !o);
  };

  const handleMarkRead = (notifId: string, entityType?: string, entityId?: string) => {
    fetch(`${apiBaseUrl}/api/v1/notifications/${notifId}/read`, { ...authHeaders(), method: "PATCH" }).catch(() => {});
    setNotifications((prev) => prev.filter((n) => n.notification_id !== notifId));
    setUnreadCount((c) => Math.max(0, c - 1));
    setNotifOpen(false);
    if (entityType && entityId) navigate(entityTypeToView(entityType), entityId);
  };

  const handleSearchSelect = (entityType: string, entityId: string) => {
    setSearchQuery(""); setSearchOpen(false); setSearchResults([]);
    navigate(entityTypeToView(entityType), entityId);
  };

  if (!auth) return <Login onLogin={login} />;

  const userName = auth.user.full_name || auth.user.username;
  const initial = userName.charAt(0).toUpperCase();

  const renderNavContent = (context: "sidebar" | "drawer") => (
    <>
      {context === "drawer" && (
        <div className="sidebar__header">
          <p className="sidebar__portal-name">{t("app.brand")}</p>
          <p className="sidebar__user-name">{userName}</p>
        </div>
      )}
      <ul className="sidebar__nav">
        {NAV_ITEMS.map((item) => (
          <li key={item.view}>
            <button className={`sidebar__item ${view === item.view || (item.view === "alerts" && view === "alert-detail") || (item.view === "cases" && view === "case-detail") || (item.view === "content" && view === "content-detail") ? "sidebar__item--active" : ""}`} onClick={() => navigate(item.view)} title={t(item.key)} type="button">
              <span className="sidebar__item-icon" aria-hidden="true"><SvgIcon d={item.icon} /></span>
              <span>{t(item.key)}</span>
            </button>
          </li>
        ))}
        <li>
          <button className={`sidebar__item ${view === "inbox" ? "sidebar__item--active" : ""}`} onClick={() => navigate("inbox")} title={t("nav.inbox")} type="button">
            <span className="sidebar__item-icon" aria-hidden="true"><SvgIcon d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6" /></span>
            <span>{t("nav.inbox")}</span>
          </button>
        </li>
        <li>
          <button className={`sidebar__item ${view === "query-assistant" ? "sidebar__item--active" : ""}`} onClick={() => navigate("query-assistant")} title={t("nav.query_assistant")} type="button">
            <span className="sidebar__item-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
            <span>{t("nav.query_assistant")}</span>
          </button>
        </li>
        <li>
          <button className={`sidebar__item ${view === "network-graph" ? "sidebar__item--active" : ""}`} onClick={() => navigate("network-graph")} title={t("nav.network_graph")} type="button">
            <span className="sidebar__item-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></span>
            <span>{t("nav.network_graph")}</span>
          </button>
        </li>
        <li>
          <button className={`sidebar__item ${view === "model-admin" ? "sidebar__item--active" : ""}`} onClick={() => navigate("model-admin")} title={t("nav.model_admin")} type="button">
            <span className="sidebar__item-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg></span>
            <span>{t("nav.model_admin")}</span>
          </button>
        </li>
        <li className="sidebar__divider" role="separator" />
        <li>
          <button className={`sidebar__item ${view === "settings" ? "sidebar__item--active" : ""}`} onClick={() => navigate("settings")} title={t("nav.settings")} type="button">
            <span className="sidebar__item-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>
            <span>{t("nav.settings")}</span>
          </button>
        </li>
        {isAdmin && (
          <>
          <li>
            <button className={`sidebar__item ${view === "admin" ? "sidebar__item--active" : ""}`} onClick={() => navigate("admin")} title={t("nav.admin")} type="button">
              <span className="sidebar__item-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>
              <span>{t("nav.admin")}</span>
            </button>
          </li>
          <li>
            <button className={`sidebar__item ${view === "audit-log" ? "sidebar__item--active" : ""}`} onClick={() => navigate("audit-log")} title={t("nav.audit_log")} type="button">
              <span className="sidebar__item-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>
              <span>{t("nav.audit_log")}</span>
            </button>
          </li>
          </>
        )}
      </ul>
      <div className="sidebar__footer">
        <button className="sidebar__item" onClick={handleLogout} title={t("nav.logout")} type="button">
          <span className="sidebar__item-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></span>
          <span>{t("nav.logout")}</span>
        </button>
      </div>
    </>
  );

  const suspenseFallback = (
    <div className="panel" style={{ display: "grid", gap: "var(--space-3)" }}>
      <SkeletonBlock height="2rem" width="50%" />
      <SkeletonBlock height="4rem" />
      <SkeletonBlock height="4rem" />
    </div>
  );

  return (
    <>
      <a href="#sm-main" className="skip-link">{t("common.skip_to_main")}</a>
      <header className="app-bar">
        <div className="app-bar__inner">
          <div className="app-bar__brand"><span className="app-bar__brand-name">{t("app.brand")}</span></div>
          <div className="app-bar__search-wrap" ref={searchRef} style={{ position: "relative" }}>
            <input
              className="app-bar__search-input"
              type="search"
              placeholder={t("search.placeholder")}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
            />
            {searchOpen && searchResults.length > 0 && (
              <ul className="search-results" role="listbox">
                {searchResults.map((r) => (
                  <li key={`${r.entity_type}-${r.entity_id}`}>
                    <button className="search-results__item" onClick={() => handleSearchSelect(r.entity_type, r.entity_id)} type="button" role="option">
                      <span className="search-results__type">{r.entity_type}</span>
                      <span className="search-results__title">{r.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {searchOpen && searchQuery && searchResults.length === 0 && (
              <div className="search-results search-results--empty">{t("search.no_results")}</div>
            )}
          </div>
          <div className="app-bar__notif-wrap" style={{ position: "relative" }} ref={notifRef}>
            <button className="app-bar__notif-btn" onClick={handleNotifToggle} aria-label={t("notifications.title")} type="button">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              {unreadCount > 0 && <span className="app-bar__notif-badge">{unreadCount}</span>}
            </button>
            {notifOpen && (
              <div className="notif-panel" role="menu">
                <div className="notif-panel__header"><strong>{t("notifications.title")}</strong></div>
                {notifications.length === 0 ? (
                  <div className="notif-panel__empty">{t("notifications.empty")}</div>
                ) : (
                  <ul className="notif-panel__list">
                    {notifications.map((n) => (
                      <li key={n.notification_id}>
                        <button className="notif-panel__item" onClick={() => handleMarkRead(n.notification_id, n.entity_type, n.entity_id)} type="button">
                          <span className="notif-panel__title">{n.title}</span>
                          <small className="notif-panel__time">{new Date(n.created_at).toLocaleString()}</small>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <div className="app-bar__avatar-wrap" style={{ position: "relative" }}>
            <button ref={avatarBtnRef} className="app-bar__avatar" onClick={() => setAvatarMenuOpen((o) => !o)} aria-label={t("nav.account_menu")} aria-expanded={avatarMenuOpen} type="button">{initial}</button>
            {avatarMenuOpen && (
              <div className="avatar-menu" ref={avatarMenuRef} role="menu">
                <div className="avatar-menu__header"><span className="avatar-menu__initial">{initial}</span><span className="avatar-menu__name">{userName}</span></div>
                <div className="avatar-menu__divider" />
                <button className="avatar-menu__item" onClick={() => { setAvatarMenuOpen(false); navigate("settings"); }} role="menuitem" type="button">{t("nav.settings")}</button>
                <div className="avatar-menu__divider" />
                <button className="avatar-menu__item avatar-menu__item--danger" onClick={() => { setAvatarMenuOpen(false); handleLogout(); }} role="menuitem" type="button">{t("nav.logout")}</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <aside className="sidebar">{renderNavContent("sidebar")}</aside>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>{renderNavContent("drawer")}</Drawer>
      <nav className="bottom-nav" aria-label="Main navigation">
        {NAV_ITEMS.slice(0, 4).map((item) => (
          <button key={item.view} className={`bottom-nav__tab ${view === item.view ? "bottom-nav__tab--active" : ""}`} onClick={() => navigate(item.view)} type="button">
            <span className="bottom-nav__icon" aria-hidden="true"><SvgIcon d={item.icon} /></span>
            <span className="bottom-nav__label">{t(item.key)}</span>
          </button>
        ))}
        <button className="bottom-nav__tab" onClick={() => setDrawerOpen(true)} type="button" aria-label="More">
          <span className="bottom-nav__icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg></span>
          <span className="bottom-nav__label">{t("nav.more")}</span>
        </button>
      </nav>
      <div className="app-layout">
        <div className="app-layout__main">
          {isOffline && <Alert variant="warning" className="view-feedback">{t("offline.banner")}</Alert>}
          <main id="sm-main" role="main">
            <Suspense fallback={suspenseFallback}>
              {view === "dashboard" && <Dashboard authHeaders={authHeaders} isOffline={isOffline} onNavigate={navigate} />}
              {view === "alerts" && <AlertList authHeaders={authHeaders} isOffline={isOffline} onSelect={(id) => navigate("alert-detail", id)} />}
              {view === "alert-detail" && resourceId && <AlertDetail id={resourceId} authHeaders={authHeaders} isOffline={isOffline} onBack={() => navigate("alerts")} />}
              {view === "cases" && <CaseList authHeaders={authHeaders} isOffline={isOffline} onSelect={(id) => navigate("case-detail", id)} />}
              {view === "case-detail" && resourceId && <CaseDetail id={resourceId} authHeaders={authHeaders} isOffline={isOffline} onBack={() => navigate("cases")} />}
              {view === "content" && <ContentList authHeaders={authHeaders} isOffline={isOffline} onSelect={(id) => navigate("content-detail", id)} />}
              {view === "content-detail" && resourceId && <ContentDetail id={resourceId} authHeaders={authHeaders} isOffline={isOffline} onBack={() => navigate("content")} />}
              {view === "evidence-detail" && resourceId && <EvidenceDetail id={resourceId} authHeaders={authHeaders} isOffline={isOffline} onBack={() => window.history.back()} />}
              {view === "watchlists" && <WatchlistManager authHeaders={authHeaders} isOffline={isOffline} />}
              {view === "report-detail" && resourceId && <ReportDetail id={resourceId} authHeaders={authHeaders} isOffline={isOffline} onBack={() => window.history.back()} />}
              {view === "inbox" && <TaskInbox authHeaders={authHeaders} isOffline={isOffline} />}
              {view === "query-assistant" && <QueryAssistant authHeaders={authHeaders} isOffline={isOffline} onNavigate={navigate} />}
              {view === "network-graph" && <NetworkGraph authHeaders={authHeaders} isOffline={isOffline} onNavigate={navigate} />}
              {view === "model-admin" && <ModelAdmin authHeaders={authHeaders} isOffline={isOffline} />}
              {view === "settings" && <Settings />}
              {view === "audit-log" && <AuditLog authHeaders={authHeaders} isOffline={isOffline} />}
              {view === "admin" && <Admin authHeaders={authHeaders} isOffline={isOffline} />}
            </Suspense>
          </main>
        </div>
      </div>
      <Modal open={idleWarning} title={t("idle.warning_title")} onClose={dismissWarning} actions={<Button onClick={dismissWarning}>{t("idle.continue")}</Button>}>
        <p>{t("idle.warning_message")}</p>
      </Modal>
    </>
  );
}
