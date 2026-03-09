import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Field, Input, Modal, Select, useToast } from "@puda/shared";
import { apiBaseUrl, ConnectorHealth, DeadLetterItem, RetentionFlaggedItem } from "../types";
import { Bilingual } from "../Bilingual";
import EmptyState from "../components/EmptyState";

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean };
type Tab = "health" | "connectors" | "dead-letters" | "retention";

type ConnectorRow = {
  connector_id: string; platform: string; connector_type: string;
  config_jsonb: Record<string, unknown>; is_active: boolean;
  last_poll_at: string | null; created_at: string; updated_at: string;
};

const PLATFORMS = ["facebook", "instagram", "twitter", "x", "telegram", "whatsapp", "youtube"] as const;

function statusDotClass(status: string): string {
  const s = status.toUpperCase();
  if (s === "HEALTHY") return "health-card__dot--healthy";
  if (s === "DEGRADED") return "health-card__dot--degraded";
  if (s === "UNHEALTHY") return "health-card__dot--unhealthy";
  return "health-card__dot--unknown";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function PlatformConnectors({ authHeaders, isOffline }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("health");
  const [error, setError] = useState("");

  // Health tab
  const [health, setHealth] = useState<ConnectorHealth[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);

  // Connectors tab
  const [connectors, setConnectors] = useState<ConnectorRow[]>([]);
  const [connTotal, setConnTotal] = useState(0);
  const [connPage, setConnPage] = useState(0);
  const [connLoading, setConnLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ platform: "facebook", connectorType: "apify", configJsonb: "{}", isActive: true, defaultLegalBasis: "", defaultRetentionDays: "365" });

  // Dead letters tab
  const [deadLetters, setDeadLetters] = useState<DeadLetterItem[]>([]);
  const [dlTotal, setDlTotal] = useState(0);
  const [dlPage, setDlPage] = useState(0);
  const [dlLoading, setDlLoading] = useState(false);

  // Retention tab
  const [retention, setRetention] = useState<RetentionFlaggedItem[]>([]);
  const [retTotal, setRetTotal] = useState(0);
  const [retPage, setRetPage] = useState(0);
  const [retLoading, setRetLoading] = useState(false);

  const PAGE_SIZE = 25;

  const loadHealth = useCallback(() => {
    setHealthLoading(true);
    fetch(`${apiBaseUrl}/api/v1/connectors/health`, authHeaders())
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => setHealth(d.connectors || []))
      .catch(() => setError(t("common.something_went_wrong")))
      .finally(() => setHealthLoading(false));
  }, [authHeaders, t]);

  const loadConnectors = useCallback(() => {
    setConnLoading(true);
    fetch(`${apiBaseUrl}/api/v1/connectors?limit=${PAGE_SIZE}&offset=${connPage * PAGE_SIZE}`, authHeaders())
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => { setConnectors(d.connectors || []); setConnTotal(d.total || 0); })
      .catch(() => setError(t("common.something_went_wrong")))
      .finally(() => setConnLoading(false));
  }, [authHeaders, connPage, t]);

  const loadDeadLetters = useCallback(() => {
    setDlLoading(true);
    fetch(`${apiBaseUrl}/api/v1/connectors/dead-letter?limit=${PAGE_SIZE}&offset=${dlPage * PAGE_SIZE}`, authHeaders())
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => { setDeadLetters(d.items || []); setDlTotal(d.total || 0); })
      .catch(() => setError(t("common.something_went_wrong")))
      .finally(() => setDlLoading(false));
  }, [authHeaders, dlPage, t]);

  const loadRetention = useCallback(() => {
    setRetLoading(true);
    fetch(`${apiBaseUrl}/api/v1/connectors/retention-flagged?limit=${PAGE_SIZE}&offset=${retPage * PAGE_SIZE}`, authHeaders())
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => { setRetention(d.content || []); setRetTotal(d.total || 0); })
      .catch(() => setError(t("common.something_went_wrong")))
      .finally(() => setRetLoading(false));
  }, [authHeaders, retPage, t]);

  useEffect(() => {
    if (tab === "health") loadHealth();
    else if (tab === "connectors") loadConnectors();
    else if (tab === "dead-letters") loadDeadLetters();
    else if (tab === "retention") loadRetention();
  }, [tab, loadHealth, loadConnectors, loadDeadLetters, loadRetention]);

  const resetHealth = async (id: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/connectors/${id}/reset-health`, { method: "POST", ...authHeaders() });
      if (!res.ok) throw new Error();
      showToast(t("connectors.reset_success"), "success");
      loadHealth();
    } catch { showToast(t("common.something_went_wrong"), "error"); }
  };

  const retryDeadLetter = async (id: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/connectors/dead-letter/${id}/retry`, { method: "POST", ...authHeaders() });
      if (!res.ok) throw new Error();
      showToast(t("connectors.retry_success"), "success");
      loadDeadLetters();
    } catch { showToast(t("common.something_went_wrong"), "error"); }
  };

  const flagExpired = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/connectors/flag-expired`, { method: "POST", ...authHeaders() });
      if (!res.ok) throw new Error();
      const d = await res.json();
      showToast(t("connectors.flag_expired_success", { count: d.flaggedCount }), "success");
      loadRetention();
    } catch { showToast(t("common.something_went_wrong"), "error"); }
  };

  const openCreate = () => {
    setEditId(null);
    setForm({ platform: "facebook", connectorType: "apify", configJsonb: "{}", isActive: true, defaultLegalBasis: "", defaultRetentionDays: "365" });
    setModalOpen(true);
  };

  const openEdit = (c: ConnectorRow) => {
    setEditId(c.connector_id);
    setForm({ platform: c.platform, connectorType: c.connector_type, configJsonb: JSON.stringify(c.config_jsonb, null, 2), isActive: c.is_active, defaultLegalBasis: "", defaultRetentionDays: "365" });
    setModalOpen(true);
  };

  const saveConnector = async () => {
    try {
      let parsedConfig: Record<string, unknown> = {};
      try { parsedConfig = JSON.parse(form.configJsonb); } catch { /* keep empty */ }

      const body: Record<string, unknown> = {
        platform: form.platform,
        connectorType: form.connectorType,
        configJsonb: parsedConfig,
        isActive: form.isActive,
      };
      if (!editId) {
        if (form.defaultLegalBasis) body.defaultLegalBasis = form.defaultLegalBasis;
        body.defaultRetentionDays = parseInt(form.defaultRetentionDays, 10) || 365;
      }

      const url = editId ? `${apiBaseUrl}/api/v1/connectors/${editId}` : `${apiBaseUrl}/api/v1/connectors`;
      const method = editId ? "PUT" : "POST";
      const hdrs = authHeaders();
      const res = await fetch(url, {
        method,
        headers: { ...hdrs.headers, "Content-Type": "application/json" } as Record<string, string>,
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      showToast(t(editId ? "connectors.connector_updated" : "connectors.connector_created"), "success");
      setModalOpen(false);
      loadConnectors();
    } catch { showToast(t("common.something_went_wrong"), "error"); }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "health", label: t("connectors.tab_health") },
    { key: "connectors", label: t("connectors.tab_connectors") },
    { key: "dead-letters", label: t("connectors.tab_dead_letters") },
    { key: "retention", label: t("connectors.tab_retention") },
  ];

  return (
    <div className="panel">
      <div className="page__header">
        <h1><Bilingual tKey="connectors.title" /></h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>{t("connectors.subtitle")}</p>
      </div>

      {error && <Alert variant="error" onClose={() => setError("")}>{error}</Alert>}

      <div className="tab-bar">
        {tabs.map((tb) => (
          <button key={tb.key} className={`tab-btn ${tab === tb.key ? "tab-btn--active" : ""}`} onClick={() => setTab(tb.key)} type="button">{tb.label}</button>
        ))}
      </div>

      {/* Health Tab */}
      {tab === "health" && (
        healthLoading ? <div className="loading-center">{t("common.loading")}</div> :
        health.length === 0 ? <EmptyState title={t("connectors.no_health_data")} /> :
        <div className="health-grid">
          {health.map((h) => (
            <div className="health-card" key={h.connector_id}>
              <div className="health-card__header">
                <span className="health-card__platform">{h.platform}</span>
                <span className={`health-card__dot ${statusDotClass(h.health_status)}`} title={h.health_status} />
              </div>
              <div className="health-card__meta">{t("connectors.last_polled")}: {fmtDate(h.last_poll_at)}</div>
              <div className="health-card__meta">{t("connectors.error_count")}: {h.error_count}</div>
              {h.last_error && <div className="health-card__error">{h.last_error}</div>}
              <Button size="sm" variant="outline" disabled={isOffline} onClick={() => resetHealth(h.connector_id)}>{t("connectors.reset")}</Button>
            </div>
          ))}
        </div>
      )}

      {/* Connectors Tab */}
      {tab === "connectors" && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-3)" }}>
            <Button size="sm" disabled={isOffline} onClick={openCreate}>{t("connectors.add_connector")}</Button>
          </div>
          {connLoading ? <div className="loading-center">{t("common.loading")}</div> :
          connectors.length === 0 ? <EmptyState title={t("connectors.no_connectors")} /> :
          <>
            <div className="table-scroll">
              <table className="entity-table entity-table--compact">
                <thead>
                  <tr>
                    <th>{t("connectors.platform")}</th>
                    <th>{t("connectors.type")}</th>
                    <th>{t("connectors.active")}</th>
                    <th>{t("connectors.last_polled")}</th>
                    <th>{t("connectors.created")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {connectors.map((c) => (
                    <tr key={c.connector_id}>
                      <td data-label={t("connectors.platform")}>{c.platform}</td>
                      <td data-label={t("connectors.type")}>{c.connector_type}</td>
                      <td data-label={t("connectors.active")}>{c.is_active ? t("common.yes") : t("common.no")}</td>
                      <td data-label={t("connectors.last_polled")}>{fmtDate(c.last_poll_at)}</td>
                      <td data-label={t("connectors.created")}>{fmtDate(c.created_at)}</td>
                      <td>
                        <Button size="sm" variant="outline" onClick={() => openEdit(c)}>{t("connectors.edit_connector")}</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {connTotal > PAGE_SIZE && (
              <div className="pagination">
                <Button size="sm" variant="outline" disabled={connPage === 0} onClick={() => setConnPage((p) => p - 1)}>{t("audit.prev_page")}</Button>
                <span className="pagination__info">{t("audit.page_label", { page: connPage + 1 })}</span>
                <Button size="sm" variant="outline" disabled={(connPage + 1) * PAGE_SIZE >= connTotal} onClick={() => setConnPage((p) => p + 1)}>{t("audit.next_page")}</Button>
              </div>
            )}
          </>}
        </>
      )}

      {/* Dead Letters Tab */}
      {tab === "dead-letters" && (
        dlLoading ? <div className="loading-center">{t("common.loading")}</div> :
        deadLetters.length === 0 ? <EmptyState title={t("connectors.no_dead_letters")} /> :
        <>
          <div className="table-scroll">
            <table className="entity-table entity-table--compact">
              <thead>
                <tr>
                  <th>{t("connectors.dead_letter_id")}</th>
                  <th>{t("connectors.platform")}</th>
                  <th>{t("connectors.error_message")}</th>
                  <th>{t("connectors.retry_count")}</th>
                  <th>{t("connectors.created")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {deadLetters.map((dl) => (
                  <tr key={dl.id}>
                    <td data-label={t("connectors.dead_letter_id")} style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{dl.id.slice(0, 8)}</td>
                    <td data-label={t("connectors.platform")}>{dl.platform}</td>
                    <td data-label={t("connectors.error_message")} style={{ maxWidth: "20rem", overflow: "hidden", textOverflow: "ellipsis" }}>{dl.error_message}</td>
                    <td data-label={t("connectors.retry_count")}>{dl.retry_count}</td>
                    <td data-label={t("connectors.created")}>{fmtDate(dl.created_at)}</td>
                    <td>
                      <Button size="sm" variant="outline" disabled={isOffline} onClick={() => retryDeadLetter(dl.id)}>{t("connectors.retry")}</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {dlTotal > PAGE_SIZE && (
            <div className="pagination">
              <Button size="sm" variant="outline" disabled={dlPage === 0} onClick={() => setDlPage((p) => p - 1)}>{t("audit.prev_page")}</Button>
              <span className="pagination__info">{t("audit.page_label", { page: dlPage + 1 })}</span>
              <Button size="sm" variant="outline" disabled={(dlPage + 1) * PAGE_SIZE >= dlTotal} onClick={() => setDlPage((p) => p + 1)}>{t("audit.next_page")}</Button>
            </div>
          )}
        </>
      )}

      {/* Retention Tab */}
      {tab === "retention" && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-3)" }}>
            <Button size="sm" variant="danger" disabled={isOffline} onClick={flagExpired}>{t("connectors.flag_expired")}</Button>
          </div>
          {retLoading ? <div className="loading-center">{t("common.loading")}</div> :
          retention.length === 0 ? <EmptyState title={t("connectors.no_retention_items")} /> :
          <>
            <div className="table-scroll">
              <table className="entity-table entity-table--compact">
                <thead>
                  <tr>
                    <th>{t("connectors.content_id")}</th>
                    <th>{t("connectors.platform")}</th>
                    <th>{t("connectors.author")}</th>
                    <th>{t("connectors.legal_basis")}</th>
                    <th>{t("connectors.retention_until")}</th>
                  </tr>
                </thead>
                <tbody>
                  {retention.map((r) => (
                    <tr key={r.content_id}>
                      <td data-label={t("connectors.content_id")} style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{r.content_id.slice(0, 8)}</td>
                      <td data-label={t("connectors.platform")}>{r.platform}</td>
                      <td data-label={t("connectors.author")}>{r.author_handle}</td>
                      <td data-label={t("connectors.legal_basis")}>{r.legal_basis || "—"}</td>
                      <td data-label={t("connectors.retention_until")}>{fmtDate(r.retention_until)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {retTotal > PAGE_SIZE && (
              <div className="pagination">
                <Button size="sm" variant="outline" disabled={retPage === 0} onClick={() => setRetPage((p) => p - 1)}>{t("audit.prev_page")}</Button>
                <span className="pagination__info">{t("audit.page_label", { page: retPage + 1 })}</span>
                <Button size="sm" variant="outline" disabled={(retPage + 1) * PAGE_SIZE >= retTotal} onClick={() => setRetPage((p) => p + 1)}>{t("audit.next_page")}</Button>
              </div>
            )}
          </>}
        </>
      )}

      {/* Create/Edit Connector Modal */}
      <Modal open={modalOpen} title={editId ? t("connectors.edit_connector") : t("connectors.add_connector")} onClose={() => setModalOpen(false)} actions={
        <>
          <Button variant="outline" onClick={() => setModalOpen(false)}>{t("common.cancel")}</Button>
          <Button disabled={isOffline} onClick={saveConnector}>{t("common.save")}</Button>
        </>
      }>
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <Field label={t("connectors.platform")}>
            <Select value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label={t("connectors.connector_type")}>
            <Input value={form.connectorType} onChange={(e) => setForm((f) => ({ ...f, connectorType: e.target.value }))} />
          </Field>
          <Field label={t("connectors.config_json")}>
            <textarea className="ui-input" rows={4} value={form.configJsonb} onChange={(e) => setForm((f) => ({ ...f, configJsonb: e.target.value }))} style={{ fontFamily: "monospace", fontSize: "0.85rem" }} />
          </Field>
          <Field label={t("connectors.is_active")}>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
              {form.isActive ? t("common.yes") : t("common.no")}
            </label>
          </Field>
          {!editId && (
            <>
              <Field label={t("connectors.legal_basis")}>
                <Input value={form.defaultLegalBasis} onChange={(e) => setForm((f) => ({ ...f, defaultLegalBasis: e.target.value }))} />
              </Field>
              <Field label={t("connectors.retention_days")}>
                <Input type="number" value={form.defaultRetentionDays} onChange={(e) => setForm((f) => ({ ...f, defaultRetentionDays: e.target.value }))} />
              </Field>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
