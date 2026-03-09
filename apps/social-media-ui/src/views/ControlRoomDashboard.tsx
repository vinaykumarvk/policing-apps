import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@puda/shared";
import { apiBaseUrl } from "../types";
import EmptyState from "../components/EmptyState";
import { GaugeChart, FunnelChart } from "../charts";

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean; onNavigate: (view: string) => void };

type QueueItem = {
  alert_id: string; alert_ref: string; title: string; priority: string;
  state_id: string; assigned_to: string | null; created_at: string;
  due_at: string | null; sla_status: string; sla_remaining_seconds: number | null;
};

type SlaData = { on_track: number; at_risk: number; breached: number };

function formatCountdown(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 0) {
    const abs = Math.abs(seconds);
    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60);
    return `-${h}h ${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function ControlRoomDashboard({ authHeaders, isOffline, onNavigate }: Props) {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [sla, setSla] = useState<SlaData>({ on_track: 0, at_risk: 0, breached: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tick, setTick] = useState(0);

  const fetchData = useCallback(() => {
    if (isOffline) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      fetch(`${apiBaseUrl}/api/v1/dashboard/control-room?limit=50`, authHeaders()).then(r => r.ok ? r.json() : null),
      fetch(`${apiBaseUrl}/api/v1/dashboard/analytics`, authHeaders()).then(r => r.ok ? r.json() : null),
    ])
      .then(([crData, analyticsData]) => {
        if (crData) setQueue(crData.queue || []);
        if (analyticsData) setSla(analyticsData.sla || { on_track: 0, at_risk: 0, breached: 0 });
      })
      .catch(err => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [authHeaders, isOffline]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Tick countdown every 60s
  useEffect(() => {
    timerRef.current = setInterval(() => setTick(t => t + 1), 60000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  if (loading) return <div className="loading-center">{t("common.loading")}</div>;

  const slaTotal = sla.on_track + sla.at_risk + sla.breached;
  const alertFunnel = [
    { label: "NEW", count: queue.filter(q => q.state_id === "NEW").length, color: "#3b82f6" },
    { label: "TRIAGED", count: queue.filter(q => q.state_id === "TRIAGED").length, color: "#8b5cf6" },
    { label: "IN REVIEW", count: queue.filter(q => q.state_id === "IN_REVIEW").length, color: "#06b6d4" },
    { label: "ESCALATED SUP.", count: queue.filter(q => q.state_id === "ESCALATED_SUPERVISOR").length, color: "#ef4444" },
    { label: "ESCALATED CR", count: queue.filter(q => q.state_id === "ESCALATED_CONTROL_ROOM").length, color: "#dc2626" },
  ].filter(s => s.count > 0);

  return (
    <>
      <div className="page__header">
        <h1>{t("dashboard.control_room_title")}</h1>
        <p className="subtitle">{t("dashboard.control_room_subtitle")}</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Row 1: SLA Gauges */}
      <div className="dashboard-row dashboard-row--3col" style={{ marginBottom: "var(--space-4)" }}>
        <div className="chart-section" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <GaugeChart value={sla.on_track} max={slaTotal} color="var(--color-success)" label={t("sla.on_track")} />
          <p className="stat-card__value" style={{ marginTop: "var(--space-2)" }}>{sla.on_track}</p>
        </div>
        <div className="chart-section" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <GaugeChart value={sla.at_risk} max={slaTotal} color="var(--color-warning)" label={t("sla.at_risk")} />
          <p className="stat-card__value" style={{ marginTop: "var(--space-2)" }}>{sla.at_risk}</p>
        </div>
        <div className="chart-section" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <GaugeChart value={sla.breached} max={slaTotal} color="var(--color-danger)" label={t("sla.breached")} />
          <p className="stat-card__value" style={{ marginTop: "var(--space-2)" }}>{sla.breached}</p>
        </div>
      </div>

      {/* Row 2: Priority Queue */}
      <div className="chart-section" style={{ marginBottom: "var(--space-4)" }}>
        <h2 className="chart-section__title">{t("dashboard.priority_queue")}</h2>
        {queue.length === 0 ? (
          <EmptyState icon="inbox" title={t("dashboard.no_activity")} />
        ) : (
          <div className="table-scroll">
            <table className="entity-table entity-table--compact">
              <thead>
                <tr>
                  <th>{t("alerts.priority")}</th>
                  <th>{t("dashboard.alert_ref")}</th>
                  <th>{t("common.title")}</th>
                  <th>{t("dashboard.sla_status")}</th>
                  <th>{t("dashboard.time_remaining")}</th>
                  <th>{t("alerts.assigned")}</th>
                </tr>
              </thead>
              <tbody>
                {queue.map(q => {
                  const rowClass = q.sla_status === "BREACHED" ? "priority-row--breached" : q.sla_status === "AT_RISK" ? "priority-row--at-risk" : "";
                  const remaining = q.sla_remaining_seconds != null ? q.sla_remaining_seconds - tick * 60 : null;
                  return (
                    <tr key={q.alert_id} className={`entity-table__clickable ${rowClass}`} onClick={() => onNavigate("alert-detail")}>
                      <td data-label={t("alerts.priority")}>
                        <span className={`badge badge--${q.priority?.toLowerCase() || "default"}`}>{q.priority}</span>
                      </td>
                      <td data-label={t("dashboard.alert_ref")}>{q.alert_ref || q.alert_id.slice(0, 8)}</td>
                      <td data-label={t("common.title")} style={{ whiteSpace: "normal", maxWidth: "20rem" }}>{q.title}</td>
                      <td data-label={t("dashboard.sla_status")}>
                        <span className={`badge badge--${q.sla_status === "BREACHED" ? "critical" : q.sla_status === "AT_RISK" ? "warning" : "success"}`}>
                          {t(`sla.${q.sla_status?.toLowerCase().replace("_", "_") || "no_sla"}`)}
                        </span>
                      </td>
                      <td data-label={t("dashboard.time_remaining")}>
                        <span className={`sla-countdown sla-countdown--${q.sla_status === "BREACHED" ? "breached" : q.sla_status === "AT_RISK" ? "at-risk" : "on-track"}`}>
                          {formatCountdown(remaining)}
                        </span>
                      </td>
                      <td data-label={t("alerts.assigned")}>{q.assigned_to || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Row 3: Escalation Pipeline */}
      <div className="dashboard-row dashboard-row--2col">
        <div className="chart-section">
          <h2 className="chart-section__title">{t("dashboard.escalation_pipeline")}</h2>
          <FunnelChart stages={alertFunnel} />
        </div>
        <div className="chart-section">
          <h2 className="chart-section__title">{t("dashboard.shift_summary")}</h2>
          <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            <div className="stat-card">
              <p className="stat-card__label">{t("dashboard.alerts_handled")}</p>
              <p className="stat-card__value">{queue.length}</p>
            </div>
            <div className="stat-card">
              <p className="stat-card__label">{t("dashboard.breaches_today")}</p>
              <p className="stat-card__value" style={{ color: sla.breached > 0 ? "var(--color-danger)" : undefined }}>{sla.breached}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
