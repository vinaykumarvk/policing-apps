import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Field, Input, Modal, Select, Textarea, useToast } from "@puda/shared";
import { apiBaseUrl } from "../types";

type Props = {
  open: boolean;
  entityType: string;
  entityId: string;
  onClose: () => void;
  onJustified: () => void;
  authHeaders: () => Record<string, string>;
  isOffline: boolean;
};

export default function AccessJustificationModal({ open, entityType, entityId, onClose, onJustified, authHeaders, isOffline }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [justificationType, setJustificationType] = useState("CASE_RELATED");
  const [caseRef, setCaseRef] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/access-justification`, {
        ...authHeaders(), method: "POST",
        body: JSON.stringify({
          entityType, entityId, justificationType, reasonText: reason,
          ...(caseRef ? { caseId: caseRef } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      showToast("success", t("privacy.justification_submitted"));
      onJustified();
    } catch {
      showToast("error", t("common.error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t("privacy.justification_required")}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={!reason.trim() || submitting || isOffline}>
            {submitting ? t("common.loading") : t("privacy.submit_justification")}
          </Button>
        </>
      }
    >
      <div style={{ display: "grid", gap: "var(--space-3)" }}>
        <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>{t("privacy.justification_message")}</p>
        <Field label={t("privacy.justification_type")} htmlFor="aj-type">
          <Select id="aj-type" value={justificationType} onChange={(e) => setJustificationType(e.target.value)}>
            <option value="CASE_RELATED">{t("privacy.type_case_related")}</option>
            <option value="SUPERVISOR_DIRECTED">{t("privacy.type_supervisor")}</option>
            <option value="TRAINING">{t("privacy.type_training")}</option>
            <option value="AUDIT">{t("privacy.type_audit")}</option>
            <option value="EMERGENCY">{t("privacy.type_emergency")}</option>
            <option value="OTHER">{t("privacy.type_other")}</option>
          </Select>
        </Field>
        <Field label={t("privacy.case_reference")} htmlFor="aj-case">
          <Input id="aj-case" value={caseRef} onChange={(e) => setCaseRef(e.target.value)} placeholder={t("privacy.case_reference_placeholder")} />
        </Field>
        <Field label={t("privacy.reason")} htmlFor="aj-reason">
          <Textarea id="aj-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("privacy.reason_placeholder")} />
        </Field>
      </div>
    </Modal>
  );
}
