import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Field, Input, Modal, useToast } from "@puda/shared";
import { apiBaseUrl } from "../types";

type Props = {
  open: boolean;
  evidenceId: string;
  onClose: () => void;
  authHeaders: () => Record<string, string>;
  isOffline: boolean;
};

export default function CourtExportWizard({ open, evidenceId, onClose, authHeaders, isOffline }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [officerName, setOfficerName] = useState("");
  const [officerBadge, setOfficerBadge] = useState("");
  const [caseId, setCaseId] = useState("");
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!officerName.trim()) return;
    setExporting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/evidence/${evidenceId}/court-export`, {
        method: "POST",
        ...authHeaders(),
        body: JSON.stringify({ officerName, officerBadge: officerBadge || undefined, caseId: caseId || undefined }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `court-export-${evidenceId}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("success", t("osint.export_success"));
      onClose();
    } catch {
      showToast("error", t("common.error"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t("osint.court_export")}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={handleExport} disabled={!officerName.trim() || exporting || isOffline}>
            {exporting ? t("common.loading") : t("osint.download_package")}
          </Button>
        </>
      }
    >
      <div style={{ display: "grid", gap: "var(--space-3)" }}>
        <Field label={t("osint.officer_name")} htmlFor="ce-officer">
          <Input id="ce-officer" value={officerName} onChange={(e) => setOfficerName(e.target.value)} placeholder={t("osint.officer_name_placeholder")} />
        </Field>
        <Field label={t("osint.officer_badge")} htmlFor="ce-badge">
          <Input id="ce-badge" value={officerBadge} onChange={(e) => setOfficerBadge(e.target.value)} placeholder={t("osint.officer_badge_placeholder")} />
        </Field>
        <Field label={t("osint.case_reference")} htmlFor="ce-case">
          <Input id="ce-case" value={caseId} onChange={(e) => setCaseId(e.target.value)} placeholder={t("osint.case_reference_placeholder")} />
        </Field>
        <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>{t("osint.export_description")}</p>
      </div>
    </Modal>
  );
}
