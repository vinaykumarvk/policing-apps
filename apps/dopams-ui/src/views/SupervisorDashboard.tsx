import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@puda/shared";
import { apiBaseUrl } from "../types";
import EmptyState from "../components/EmptyState";
import { MiniBarChart } from "../charts";

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean; onNavigate: (view: string) => void };

type EscalationItem = {
  escalation_id: string; alert_id: string; alert_title?: string; priority: string;
  requested_by: string; escalation_level: number; reason: string; created_at: string;
};

type PendencyStage = {
  state_id: string; count: number; avg_hours: number;
  bucket_0_4h: number; bucket_4_12h: number; bucket_12_24h: number;
  bucket_1_3d: number; bucket_3_7d: number; bucket_7d_plus: number;
};

export default function SupervisorDashboard({ authHeaders, isOffline, onNavigate }: Props) {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<EscalationItem[]>([]);
  const [pendency, setPendency] = useState<PendencyStage[]>([]);
  const [sla, setSla] = useState({ on_track: 0, at_risk: 0, breached: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    if (isOffline) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`${apiBaseUrl}/api/v1/escalation/queue`, authHeaders()).then(r => r.ok ? r.json() : null),
      fetch(`${apiBaseUrl}/api/v1/dashboard/pendency?entityType=cases`, authHeaders()).then(r => r.ok ? r.json() : null),
      fetch(`${apiBaseUrl}/api/v1/dashboard/analytics`, authHeaders()).then(r => r.ok ? r.json() : null),
    ])
      .then(([escData, pendData, analyticsData]) => {
        if (escData) setQueue(escData.queue || escData.escalations || []);
        if (pendData) setPendency(pendData.stages || []);
        if (analyticsData) setSla(analyticsData.sla || { on_track: 0, at_risk: 0, breached: 0 });
      })
      .catch(err => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [authHeaders, isOffline]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="loading-center">{t("common.loading")}</div>;

  const slaTotal = sla.on_track + sla.at_risk + sla.breached;
  const slaPct = slaTotal > 0 ? Math.round((sla.on_track / slaTotal) * 100) : 0;
  const totalPending = pendency.reduce((s, p) => s + p.count, 0);

  // Aging data for bar chart
  const agingData = [
    { label: "0-4h", value: pendency.reduce((s, p) => s + (p.bucket_0_4h || 0), 0), color: "#10b981" },
    { label: "4-12h", value: pendency.reduce((s, p) => s + (p.bucket_4_12h || 0), 0), color: "#3b82f6" },
    { label: "12-24h", value: pendency.reduce((s, p) => s + (p.bucket_12_24h || 0), 0), color: "#f59e0b" },
    { label: "1-3d", value: pendency.reduce((s, p) => s + (p.bucket_1_3d || 0), 0), color: "#ef4444" },
    { label: "3-7d", value: pendency.reduce((s, p) => s + (p.bucket_3_7d || 0), 0), color: "#dc2626" },
    { label: "7d+", value: pendency.reduce((s, p) => s + (p.bucket_7d_plus || 0), 0), color: "#991b1b" },
  ];

  return (
    <>
      <div className="page__header">
        <h1>{t("dashboard.supervisor_title")}</h1>
        <p className="subtitle">{t("dashboard.supervisor_subtitle")}</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Row 1: Team KPIs */}
      <div className="kpi-grid" style={{ marginBottom: "var(--space-4)", gridTemplateColumns: "repeat(2, 1fr)" }}>
        <div className="stat-card">
          <p className="stat-card__label">{t("dashboard.pending_approvals")}</p>
          <p className="stat-card__value">{queue.length}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">{t("dashboard.team_sla")}</p>
          <p className="stat-card__value" style={{ color: slaPct >= 80 ? "var(--color-success)" : slaPct >= 60 ? "var(--color-warning)" : "var(--color-danger)" }}>{slaPct}%</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">{t("dashboard.breaches_today")}</p>
          <p className="stat-card__value" style={{ color: sla.breached > 0 ? "var(--color-danger)" : undefined }}>{sla.breached}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">{t("dashboard.open_items")}</p>
          <p className="stat-card__value">{totalPending}</p>
        </div>
      </div>

      {/* Row 2: Pending Approvals Queue */}
      <div className="chart-section" style={{ marginBottom: "var(--space-4)" }}>
        <h2 className="chart-section__title">{t("dashboard.pending_approvals")}</h2>
        {queue.length === 0 ? (
          <EmptyState icon="inbox" title={t("escalation.no_pending")} />
        ) : (
          <div className="table-scroll">
            <table className="entity-table entity-table--compact">
              <thead>
                <tr>
                  <th>{t("alerts.priority")}</th>
                  <th>{t("common.title")}</th>
                  <th>{t("escalation.requested_by")}</th>
                  <th>{t("escalation.reason")}</th>
                  <th>{t("escalation.level")}</th>
                  <th>{t("alerts.created")}</th>
                </tr>
              </thead>
              <tbody>
                {queue.map(item => (
                  <tr key={item.escalation_id} className="entity-table__clickable" onClick={() => onNavigate("escalation-queue")} tabIndex={0} role="link" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavigate("escalation-queue"); } }}>
                    <td data-label={t("alerts.priority")}>
                      <span className={`badge badge--${item.priority?.toLowerCase() || "default"}`}>{item.priority}</span>
                    </td>
                    <td data-label={t("common.title")}>{item.alert_title || item.alert_id?.slice(0, 8)}</td>
                    <td data-label={t("escalation.requested_by")}>{item.requested_by}</td>
                    <td data-label={t("escalation.reason")} style={{ whiteSpace: "normal", maxWidth: "16rem" }}>{item.reason}</td>
                    <td data-label={t("escalation.level")}>{item.escalation_level}</td>
                    <td data-label={t("alerts.created")}>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "\u2014"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Row 3: Case Aging Analysis */}
      <div className="chart-section">
        <h2 className="chart-section__title">{t("dashboard.case_aging")}</h2>
        <MiniBarChart data={agingData} height={220} />
      </div>
    </>
  );
}
