import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, useToast } from "@puda/shared";
import { apiBaseUrl } from "../types";

type EscalationItem = {
  alert_id: string;
  alert_ref: string;
  title: string;
  priority: string;
  escalation_reason: string;
  requested_by_name: string;
  approval_requested_at: string;
  escalation_level: number;
};

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean };

export default function EscalationQueue({ authHeaders, isOffline }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [queue, setQueue] = useState<EscalationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = () => {
    fetch(`${apiBaseUrl}/api/v1/escalation/queue`, authHeaders())
      .then((r) => r.ok ? r.json() : { queue: [] })
      .then((data) => setQueue(data.queue || []))
      .catch(() => setQueue([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchQueue(); }, [authHeaders]);

  const handleAction = async (alertId: string, action: "approve" | "reject") => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/alerts/${alertId}/escalation/${action}`, {
        ...authHeaders(), method: "POST",
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      showToast("success", t(`escalation.${action}_success`));
      fetchQueue();
    } catch {
      showToast("error", t("common.error"));
    }
  };

  if (loading) return <div className="loading-center">{t("common.loading")}</div>;

  return (
    <>
      <div className="page__header">
        <h1>{t("escalation.title")}</h1>
        <p className="subtitle">{t("escalation.subtitle")}</p>
      </div>
      {queue.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", padding: "var(--space-4)" }}>{t("escalation.no_pending")}</p>
      ) : (
        <table className="entity-table">
          <thead>
            <tr>
              <th>{t("common.title")}</th>
              <th>{t("alerts.priority")}</th>
              <th>{t("escalation.reason")}</th>
              <th>{t("escalation.requested_by")}</th>
              <th>{t("escalation.level")}</th>
              <th>{t("models.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((item) => (
              <tr key={item.alert_id}>
                <td data-label={t("common.title")}>{item.title}</td>
                <td data-label={t("alerts.priority")}>
                  <span className={`badge badge--${item.priority?.toLowerCase() || "default"}`}>{item.priority}</span>
                </td>
                <td data-label={t("escalation.reason")}>{item.escalation_reason}</td>
                <td data-label={t("escalation.requested_by")}>{item.requested_by_name}</td>
                <td data-label={t("escalation.level")}>{item.escalation_level}</td>
                <td data-label={t("models.actions")}>
                  <div style={{ display: "flex", gap: "var(--space-2)" }}>
                    <Button size="sm" onClick={() => handleAction(item.alert_id, "approve")} disabled={isOffline}>{t("escalation.approve")}</Button>
                    <Button size="sm" variant="secondary" onClick={() => handleAction(item.alert_id, "reject")} disabled={isOffline}>{t("escalation.reject")}</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
