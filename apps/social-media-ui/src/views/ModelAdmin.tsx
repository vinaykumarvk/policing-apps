import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, Button, Alert, Badge, SkeletonBlock, useToast } from "@puda/shared";
import { apiBaseUrl } from "../types";

type Model = {
  model_id: string;
  name: string;
  version: string;
  status: string;
  accuracy?: number;
  last_evaluated_at?: string;
  created_at: string;
};

type Props = {
  authHeaders: () => Record<string, string>;
  isOffline: boolean;
};

export default function ModelAdmin({ authHeaders, isOffline }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchModels = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/models`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setModels(data.models || data || []);
      }
    } catch {
      setError(t("common.error"));
    }
    setLoading(false);
  };

  useEffect(() => { if (!isOffline) fetchModels(); else setLoading(false); }, []);

  const handleStatusChange = async (modelId: string, newStatus: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/models/${modelId}/status`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        showToast("success", t("models.status_updated"));
        fetchModels();
      } else {
        showToast("error", t("common.error"));
      }
    } catch {
      showToast("error", t("common.error"));
    }
  };

  const statusVariant = (s: string): "success" | "warning" | "danger" | "neutral" | "info" => {
    switch (s) {
      case "ACTIVE": return "success";
      case "TRAINING": return "warning";
      case "DEPRECATED": return "danger";
      case "DRAFT": return "neutral";
      default: return "info";
    }
  };

  if (loading) return <div className="loading-center"><SkeletonBlock height="20rem" /></div>;

  return (
    <div>
      <div className="page__header">
        <h1>{t("models.title")}</h1>
        <p className="subtitle">{t("models.subtitle")}</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {models.length > 0 ? (
        <table className="entity-table">
          <thead>
            <tr>
              <th>{t("models.name")}</th>
              <th>{t("models.version")}</th>
              <th>{t("models.status")}</th>
              <th>{t("models.accuracy")}</th>
              <th>{t("models.last_evaluated")}</th>
              <th>{t("models.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.model_id}>
                <td data-label={t("models.name")}>{m.name}</td>
                <td data-label={t("models.version")}>{m.version}</td>
                <td data-label={t("models.status")}><Badge variant={statusVariant(m.status)}>{m.status}</Badge></td>
                <td data-label={t("models.accuracy")}>{m.accuracy != null ? `${Math.round(m.accuracy * 100)}%` : "\u2014"}</td>
                <td data-label={t("models.last_evaluated")}>{m.last_evaluated_at ? new Date(m.last_evaluated_at).toLocaleDateString() : "\u2014"}</td>
                <td data-label={t("models.actions")}>
                  <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap" }}>
                    {m.status !== "ACTIVE" && (
                      <Button variant="secondary" size="sm" onClick={() => handleStatusChange(m.model_id, "ACTIVE")} disabled={isOffline}>
                        {t("models.activate")}
                      </Button>
                    )}
                    {m.status === "ACTIVE" && (
                      <Button variant="secondary" size="sm" onClick={() => handleStatusChange(m.model_id, "DEPRECATED")} disabled={isOffline}>
                        {t("models.deprecate")}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Card><p style={{ color: "var(--color-text-secondary)", textAlign: "center" }}>{t("models.no_models")}</p></Card>
      )}
    </div>
  );
}
