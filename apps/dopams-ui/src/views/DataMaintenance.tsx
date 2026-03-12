import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, Alert } from "@puda/shared";
import { apiBaseUrl } from "../types";

type SyncStats = {
  subjectsProcessed: number;
  phonesUpserted: number;
  identityDocsUpserted: number;
  bankAccountsUpserted: number;
  socialAccountsUpserted: number;
  vehiclesUpserted: number;
  addressesUpserted: number;
  linksCreated: number;
  graphNodesUpserted: number;
  graphEdgesUpserted: number;
  errors: string[];
};

type Props = {
  authHeaders: () => Record<string, string>;
  isOffline: boolean;
};

export default function DataMaintenance({ authHeaders, isOffline }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const runSync = async () => {
    setLoading(true);
    setError(null);
    setStats(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/admin/sync-entities`, {
        method: "POST",
        ...authHeaders(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: "Request failed" }));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setStats(data.stats);
      setLastRun(new Date().toLocaleString());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("entity_sync.error"));
    } finally {
      setLoading(false);
    }
  };

  const statRows: Array<{ label: string; value: number }> = stats ? [
    { label: t("entity_sync.stats_subjects"), value: stats.subjectsProcessed },
    { label: t("entity_sync.stats_phones"), value: stats.phonesUpserted },
    { label: t("entity_sync.stats_identity"), value: stats.identityDocsUpserted },
    { label: t("entity_sync.stats_bank"), value: stats.bankAccountsUpserted },
    { label: t("entity_sync.stats_social"), value: stats.socialAccountsUpserted },
    { label: t("entity_sync.stats_vehicles"), value: stats.vehiclesUpserted },
    { label: t("entity_sync.stats_addresses"), value: stats.addressesUpserted },
    { label: t("entity_sync.stats_links"), value: stats.linksCreated },
    { label: t("entity_sync.stats_graph_nodes"), value: stats.graphNodesUpserted },
    { label: t("entity_sync.stats_graph_edges"), value: stats.graphEdgesUpserted },
  ] : [];

  return (
    <div>
      <h2>{t("entity_sync.title")}</h2>
      <p className="subtitle">{t("entity_sync.subtitle")}</p>

      <Card style={{ marginTop: "var(--space-4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <Button onClick={runSync} disabled={isOffline || loading}>
            {loading ? t("entity_sync.running") : t("entity_sync.run")}
          </Button>
          <span style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
            {t("entity_sync.last_run")}: {lastRun || t("entity_sync.never_run")}
          </span>
        </div>
      </Card>

      {error && (
        <Alert variant="error" style={{ marginTop: "var(--space-3)" }}>
          {t("entity_sync.error")}: {error}
        </Alert>
      )}

      {stats && (
        <Card style={{ marginTop: "var(--space-3)" }}>
          <Alert variant="success" style={{ marginBottom: "var(--space-3)" }}>
            {t("entity_sync.success")}
          </Alert>
          <table className="entity-table">
            <thead>
              <tr>
                <th>Entity</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {statRows.map((row) => (
                <tr key={row.label}>
                  <td data-label="Entity">{row.label}</td>
                  <td data-label="Count">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {stats.errors.length > 0 && (
            <div style={{ marginTop: "var(--space-3)" }}>
              <p style={{ fontWeight: 600, color: "var(--color-error)" }}>
                {t("entity_sync.stats_errors")} ({stats.errors.length})
              </p>
              <ul style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                {stats.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
