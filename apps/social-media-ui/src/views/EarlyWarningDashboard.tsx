import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Tabs, useToast } from "@puda/shared";
import { apiBaseUrl } from "../types";

type Spike = { spike_id: string; term_type: string; term_value: string; baseline_count: number; spike_count: number; spike_ratio: number; created_at: string };
type NpsCandidate = { nps_id: string; term: string; occurrence_count: number; status: string; context_snippet: string; created_at: string };

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean };

export default function EarlyWarningDashboard({ authHeaders, isOffline }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [spikes, setSpikes] = useState<Spike[]>([]);
  const [nps, setNps] = useState<NpsCandidate[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="loading-center">{t("common.loading")}</div>;

  return (
    <>
      <div className="page__header">
        <h1>{t("ewa.title")}</h1>
        <p className="subtitle">{t("ewa.subtitle")}</p>
      </div>
      <Tabs tabs={[
        { key: "spikes", label: t("ewa.tab_spikes"), content: (
          <>
            {spikes.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)", padding: "var(--space-4)" }}>{t("ewa.no_spikes")}</p>
            ) : (
              <table className="entity-table">
                <thead><tr><th>{t("ewa.term")}</th><th>{t("ewa.spike_ratio")}</th><th>{t("ewa.baseline")}</th><th>{t("ewa.current")}</th><th>{t("alerts.created")}</th><th>{t("models.actions")}</th></tr></thead>
                <tbody>
                  {spikes.map((s) => (
                    <tr key={s.spike_id}>
                      <td data-label={t("ewa.term")}><strong>{s.term_value}</strong> <small>({s.term_type})</small></td>
                      <td data-label={t("ewa.spike_ratio")}><span className="badge badge--critical">{Number(s.spike_ratio).toFixed(1)}x</span></td>
                      <td data-label={t("ewa.baseline")}>{Number(s.baseline_count).toFixed(1)}</td>
                      <td data-label={t("ewa.current")}>{s.spike_count}</td>
                      <td data-label={t("alerts.created")}>{new Date(s.created_at).toLocaleString()}</td>
                      <td data-label={t("models.actions")}>
                        <Button size="sm" onClick={() => handleAckSpike(s.spike_id)} disabled={isOffline}>{t("ewa.acknowledge")}</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )},
        { key: "nps", label: t("ewa.tab_nps"), content: (
          <>
            {nps.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)", padding: "var(--space-4)" }}>{t("ewa.no_nps")}</p>
            ) : (
              <table className="entity-table">
                <thead><tr><th>{t("ewa.term")}</th><th>{t("ewa.occurrences")}</th><th>{t("ewa.context")}</th><th>{t("models.actions")}</th></tr></thead>
                <tbody>
                  {nps.map((n) => (
                    <tr key={n.nps_id}>
                      <td data-label={t("ewa.term")}><strong>{n.term}</strong></td>
                      <td data-label={t("ewa.occurrences")}>{n.occurrence_count}</td>
                      <td data-label={t("ewa.context")}>{n.context_snippet || "—"}</td>
                      <td data-label={t("models.actions")}>
                        <div style={{ display: "flex", gap: "var(--space-2)" }}>
                          <Button size="sm" onClick={() => handleReviewNps(n.nps_id, "CONFIRMED_NPS")} disabled={isOffline}>{t("ewa.confirm_nps")}</Button>
                          <Button size="sm" variant="secondary" onClick={() => handleReviewNps(n.nps_id, "FALSE_POSITIVE")} disabled={isOffline}>{t("ewa.false_positive")}</Button>
                          <Button size="sm" variant="secondary" onClick={() => handleReviewNps(n.nps_id, "KNOWN_SUBSTANCE")} disabled={isOffline}>{t("ewa.known_substance")}</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )},
      ]} />
    </>
  );
}
