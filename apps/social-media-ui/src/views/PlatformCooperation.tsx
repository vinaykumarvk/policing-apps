import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Field, Input, Modal, Select, Tabs, Textarea, useToast } from "@puda/shared";
import { apiBaseUrl } from "../types";

type PlatformRequest = {
  request_id: string; request_ref: string; platform: string; request_type: string;
  status: string; legal_authority: string; created_by_name: string;
  created_at: string; valid_from: string; valid_until: string;
};

type LegalTemplate = { template_id: string; template_name: string; template_type: string; platform: string | null };

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean };

export default function PlatformCooperation({ authHeaders, isOffline }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [requests, setRequests] = useState<PlatformRequest[]>([]);
  const [templates, setTemplates] = useState<LegalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [platform, setPlatform] = useState("facebook");
  const [requestType, setRequestType] = useState("PRESERVATION");
  const [legalAuthority, setLegalAuthority] = useState("");
  const [targetAccounts, setTargetAccounts] = useState("");

  const fetchData = () => {
    Promise.all([
      fetch(`${apiBaseUrl}/api/v1/platform-cooperation/requests`, authHeaders()).then((r) => r.ok ? r.json() : { requests: [] }),
      fetch(`${apiBaseUrl}/api/v1/platform-cooperation/templates`, authHeaders()).then((r) => r.ok ? r.json() : { templates: [] }),
    ])
      .then(([reqData, tplData]) => { setRequests(reqData.requests || []); setTemplates(tplData.templates || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [authHeaders]);

  const handleCreate = async () => {
    try {
      const accounts = targetAccounts.split(",").map((s) => s.trim()).filter(Boolean);
      const res = await fetch(`${apiBaseUrl}/api/v1/platform-cooperation/requests`, {
        ...authHeaders(), method: "POST",
        body: JSON.stringify({ platform, requestType, legalAuthority, targetAccounts: accounts }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      showToast("success", t("platform.request_created"));
      setShowCreate(false);
      setPlatform("facebook"); setRequestType("PRESERVATION"); setLegalAuthority(""); setTargetAccounts("");
      fetchData();
    } catch { showToast("error", t("common.error")); }
  };

  const STATUS_COLORS: Record<string, string> = {
    DRAFT: "default", SENT: "info", ACKNOWLEDGED: "warning", FULFILLED: "success", REJECTED: "danger", EXPIRED: "default",
  };

  if (loading) return <div className="loading-center">{t("common.loading")}</div>;

  return (
    <>
      <div className="page__header">
        <h1>{t("platform.title")}</h1>
        <p className="subtitle">{t("platform.subtitle")}</p>
      </div>
      <Tabs tabs={[
        { key: "requests", label: t("platform.tab_requests"), content: (
          <>
            <div style={{ marginBottom: "var(--space-3)" }}>
              <Button onClick={() => setShowCreate(true)} disabled={isOffline}>{t("platform.create_request")}</Button>
            </div>
            {requests.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)" }}>{t("platform.no_requests")}</p>
            ) : (
              <table className="entity-table">
                <thead><tr><th>{t("platform.ref")}</th><th>{t("monitoring.platform")}</th><th>{t("platform.type")}</th><th>{t("alerts.status")}</th><th>{t("alerts.created")}</th></tr></thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.request_id}>
                      <td data-label={t("platform.ref")}>{r.request_ref}</td>
                      <td data-label={t("monitoring.platform")}>{r.platform}</td>
                      <td data-label={t("platform.type")}>{r.request_type}</td>
                      <td data-label={t("alerts.status")}>
                        <span className={`badge badge--${STATUS_COLORS[r.status] || "default"}`}>{r.status}</span>
                      </td>
                      <td data-label={t("alerts.created")}>{new Date(r.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )},
        { key: "templates", label: t("platform.tab_templates"), content: (
          <>
            {templates.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)" }}>{t("platform.no_templates")}</p>
            ) : (
              <table className="entity-table">
                <thead><tr><th>{t("watchlists.name")}</th><th>{t("platform.type")}</th><th>{t("monitoring.platform")}</th></tr></thead>
                <tbody>
                  {templates.map((tpl) => (
                    <tr key={tpl.template_id}>
                      <td data-label={t("watchlists.name")}>{tpl.template_name}</td>
                      <td data-label={t("platform.type")}>{tpl.template_type}</td>
                      <td data-label={t("monitoring.platform")}>{tpl.platform || t("platform.all_platforms")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )},
      ]} />
      <Modal open={showCreate} title={t("platform.create_request")} onClose={() => setShowCreate(false)} actions={
        <>
          <Button variant="secondary" onClick={() => setShowCreate(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleCreate} disabled={isOffline}>{t("common.create")}</Button>
        </>
      }>
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <Field label={t("monitoring.platform")} htmlFor="pc-platform">
            <Select id="pc-platform" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="twitter">Twitter/X</option>
              <option value="youtube">YouTube</option>
              <option value="reddit">Reddit</option>
            </Select>
          </Field>
          <Field label={t("platform.type")} htmlFor="pc-type">
            <Select id="pc-type" value={requestType} onChange={(e) => setRequestType(e.target.value)}>
              <option value="PRESERVATION">{t("platform.type_preservation")}</option>
              <option value="PRODUCTION">{t("platform.type_production")}</option>
              <option value="EMERGENCY_DISCLOSURE">{t("platform.type_emergency")}</option>
              <option value="TAKEDOWN">{t("platform.type_takedown")}</option>
            </Select>
          </Field>
          <Field label={t("platform.legal_authority")} htmlFor="pc-legal">
            <Input id="pc-legal" value={legalAuthority} onChange={(e) => setLegalAuthority(e.target.value)} />
          </Field>
          <Field label={t("platform.target_accounts")} htmlFor="pc-accounts">
            <Textarea id="pc-accounts" value={targetAccounts} onChange={(e) => setTargetAccounts(e.target.value)} placeholder={t("monitoring.comma_separated")} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
