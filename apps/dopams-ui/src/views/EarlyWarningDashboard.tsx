import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Tabs, useToast } from "@puda/shared";
import { apiBaseUrl } from "../types";
import EmptyState from "../components/EmptyState";
import { Sparkline } from "../charts";

type Spike = { spike_id: string; term_type: string; term_value: string; baseline_count: number; spike_count: number; spike_ratio: number; created_at: string };
type NpsCandidate = { nps_id: string; term: string; occurrence_count: number; status: string; context_snippet: string; created_at: string };

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean };

function spikeRatioBadge(ratio: number): string {
  if (ratio >= 5) return "badge--critical";
  if (ratio >= 3) return "badge--high";
  if (ratio >= 2) return "badge--medium";
  return "badge--default";
}

function relativeTime(iso: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return t("ewa.less_than_1h");
  if (hours < 24) return t("ewa.hours_ago", { count: hours });
  const days = Math.floor(hours / 24);
  return t("ewa.days_ago", { count: days });
}

export default function EarlyWarningDashboard({ authHeaders, isOffline }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [spikes, setSpikes] = useState<Spike[]>([]);
  const [nps, setNps] = useState<NpsCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNps, setExpandedNps] = useState<Set<string>>(new Set());

  const fetchData = () => {
    Promise.all([
      fetch(`${apiBaseUrl}/api/v1/early-warning/spikes`, authHeaders()).then((r) => r.ok ? r.json() : { spikes: [] }),
      fetch(`${apiBaseUrl}/api/v1/early-warning/nps`, authHeaders()).then((r) => r.ok ? r.json() : { candidates: [] }),
    ])
      .then(([spData, npsData]) => { setSpikes(spData.spikes || []); setNps(npsData.candidates || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [authHeaders]);

  const handleAckSpike = async (spikeId: string) => {
    try {
      await fetch(`${apiBaseUrl}/api/v1/early-warning/spikes/${spikeId}/acknowledge`, { ...authHeaders(), method: "POST" });
      showToast("success", t("ewa.spike_acknowledged"));
      fetchData();
    } catch { showToast("error", t("common.error")); }
  };

  const handleReviewNps = async (npsId: string, status: string) => {
    try {
      await fetch(`${apiBaseUrl}/api/v1/early-warning/nps/${npsId}`, {
        ...authHeaders(), method: "PATCH", body: JSON.stringify({ status }),
      });
      showToast("success", t("ewa.nps_reviewed"));
      fetchData();
    } catch { showToast("error", t("common.error")); }
  };

  const toggleNpsExpand = (id: string) => {
    setExpandedNps(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (loading) return <div className="loading-center">{t("common.loading")}</div>;

  // Summary stats
  const now = Date.now();
  const spikes7d = spikes.filter(s => now - new Date(s.created_at).getTime() < 7 * 86400000);
  const pendingNps = nps.filter(n => n.status === "PENDING" || !n.status);
  const lastSpikeTime = spikes.length > 0
    ? relativeTime(spikes.reduce((latest, s) => new Date(s.created_at) > new Date(latest.created_at) ? s : latest).created_at, t)
    : "\u2014";

  // Sparkline from spike ratios (recent spikes)
  const sparkData = spikes.slice(0, 10).map(s => Number(s.spike_ratio) || 0).reverse();

  return (
    <>
      <div className="page__header">
        <h1>{t("ewa.title")}</h1>
        <p className="subtitle">{t("ewa.subtitle")}</p>
      </div>

      {/* Summary Stat Cards */}
      <div className="dashboard-grid" style={{ marginBottom: "var(--space-4)" }}>
        <div className="stat-card">
          <p className="stat-card__label">{t("ewa.spikes_this_week")}</p>
          <p className="stat-card__value" style={{ color: spikes7d.length > 0 ? "var(--color-danger)" : "var(--color-success)" }}>
            {spikes7d.length}
          </p>
          {sparkData.length > 1 && (
            <div className="stat-card__trend">
              <Sparkline data={sparkData} color={spikes7d.length > 3 ? "#dc2626" : "#3b82f6"} />
            </div>
          )}
        </div>
        <div className="stat-card">
          <p className="stat-card__label">{t("ewa.pending_nps_count")}</p>
          <p className="stat-card__value" style={{ color: pendingNps.length > 0 ? "var(--color-warning)" : undefined }}>
            {pendingNps.length}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">{t("ewa.last_spike_time")}</p>
          <p className="stat-card__value" style={{ fontSize: "1.1rem" }}>{lastSpikeTime}</p>
        </div>
      </div>

      <Tabs tabs={[
        { key: "spikes", label: t("ewa.tab_spikes"), content: (
          <>
            {spikes.length === 0 ? (
              <EmptyState icon="shield" title={t("ewa.no_spikes")} subtitle={t("ewa.no_spikes_subtitle")} />
            ) : (
              <div className="table-scroll">
              <table className="entity-table">
                <thead><tr><th>{t("ewa.term")}</th><th>{t("ewa.spike_ratio")}</th><th>{t("ewa.baseline")}</th><th>{t("ewa.current")}</th><th>{t("alerts.created")}</th><th>{t("models.actions")}</th></tr></thead>
                <tbody>
                  {spikes.map((s) => {
                    const ratio = Number(s.spike_ratio);
                    return (
                      <tr key={s.spike_id}>
                        <td data-label={t("ewa.term")}><strong>{s.term_value}</strong> <small>({s.term_type})</small></td>
                        <td data-label={t("ewa.spike_ratio")}>
                          <span className={`badge ${spikeRatioBadge(ratio)}`}>{ratio.toFixed(1)}x</span>
                        </td>
                        <td data-label={t("ewa.baseline")}>{Number(s.baseline_count).toFixed(1)}</td>
                        <td data-label={t("ewa.current")}>{s.spike_count}</td>
                        <td data-label={t("alerts.created")}>{relativeTime(s.created_at, t)}</td>
                        <td data-label={t("models.actions")}>
                          <Button size="sm" onClick={() => handleAckSpike(s.spike_id)} disabled={isOffline}>{t("ewa.acknowledge")}</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </>
        )},
        { key: "nps", label: t("ewa.tab_nps"), content: (
          <>
            {nps.length === 0 ? (
              <EmptyState icon="shield" title={t("ewa.no_nps")} subtitle={t("ewa.no_nps_subtitle")} />
            ) : (
              <div className="table-scroll">
              <table className="entity-table">
                <thead><tr><th>{t("ewa.term")}</th><th>{t("ewa.occurrences")}</th><th>{t("ewa.context")}</th><th>{t("models.actions")}</th></tr></thead>
                <tbody>
                  {nps.map((n) => {
                    const snippet = n.context_snippet || "\u2014";
                    const isLong = snippet.length > 80;
                    const isExpanded = expandedNps.has(n.nps_id);
                    return (
                      <tr key={n.nps_id}>
                        <td data-label={t("ewa.term")}><strong>{n.term}</strong></td>
                        <td data-label={t("ewa.occurrences")}>{n.occurrence_count}</td>
                        <td data-label={t("ewa.context")} style={{ whiteSpace: "normal", maxWidth: "20rem" }}>
                          {isLong && !isExpanded ? snippet.slice(0, 80) + "\u2026" : snippet}
                          {isLong && (
                            <button
                              type="button"
                              className="link-btn"
                              onClick={() => toggleNpsExpand(n.nps_id)}
                              style={{ display: "block", marginTop: "var(--space-1)", fontSize: "0.75rem" }}
                            >
                              {isExpanded ? t("common.show_less") : t("common.show_more")}
                            </button>
                          )}
                        </td>
                        <td data-label={t("models.actions")}>
                          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                            <Button size="sm" onClick={() => handleReviewNps(n.nps_id, "CONFIRMED_NPS")} disabled={isOffline}>{t("ewa.confirm_nps")}</Button>
                            <Button size="sm" variant="secondary" onClick={() => handleReviewNps(n.nps_id, "FALSE_POSITIVE")} disabled={isOffline}>{t("ewa.false_positive")}</Button>
                            <Button size="sm" variant="secondary" onClick={() => handleReviewNps(n.nps_id, "KNOWN_SUBSTANCE")} disabled={isOffline}>{t("ewa.known_substance")}</Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </>
        )},
      ]} />
    </>
  );
}
