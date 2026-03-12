import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert, Badge, Button, Field, Input, Modal, Select, Tabs, Textarea, useToast,
} from "@puda/shared";
import { apiBaseUrl } from "../types";

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean };

type LegalMappingRule = {
  rule_id: string;
  rule_code: string;
  law_name: string;
  provision_code: string;
  severity_weight: number;
  version_no: number;
  approval_status: string;
  effective_from?: string | null;
  effective_to?: string | null;
  rule_expression?: {
    operator: "AND" | "OR";
    conditions: Array<{ field: string; op: string; value?: unknown; values?: string[] }>;
  };
};

const STATUS_COLORS: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  DRAFT: "neutral",
  PENDING_REVIEW: "warning",
  APPROVED: "info",
  PUBLISHED: "success",
  REJECTED: "danger",
  SUPERSEDED: "neutral",
  ROLLED_BACK: "danger",
};

const FIELDS = ["category", "threat_score", "platform", "language", "keywords", "sentiment"];
const OPS = ["eq", "neq", "in", "not_in", "gte", "lte", "gt", "lt", "contains_any", "contains_all"];

const emptyCondition = () => ({ field: "category", op: "eq", value: "", values: [] as string[] });

export default function LegalRuleAdmin({ authHeaders, isOffline }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  // Rules list
  const [rules, setRules] = useState<LegalMappingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterLaw, setFilterLaw] = useState("");

  // Create / edit modal
  const [editing, setEditing] = useState<LegalMappingRule | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formCode, setFormCode] = useState("");
  const [formLaw, setFormLaw] = useState("");
  const [formProvision, setFormProvision] = useState("");
  const [formSeverity, setFormSeverity] = useState(5);
  const [formOperator, setFormOperator] = useState<"AND" | "OR">("AND");
  const [formConditions, setFormConditions] = useState([emptyCondition()]);
  const [formEffFrom, setFormEffFrom] = useState("");
  const [formEffTo, setFormEffTo] = useState("");
  const [saving, setSaving] = useState(false);

  // Test panel
  const [testRuleId, setTestRuleId] = useState("");
  const [testCategory, setTestCategory] = useState("");
  const [testThreat, setTestThreat] = useState(0);
  const [testPlatform, setTestPlatform] = useState("");
  const [testKeywords, setTestKeywords] = useState("");
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const fetchRules = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (filterLaw) params.set("law_name", filterLaw);
    fetch(`${apiBaseUrl}/api/v1/legal/rules?${params}`, authHeaders())
      .then((r) => r.ok ? r.json() : { rules: [] })
      .then((data) => setRules(data.rules || []))
      .catch(() => setRules([]))
      .finally(() => setLoading(false));
  }, [authHeaders, filterStatus, filterLaw]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const openCreate = () => {
    setEditing(null);
    setFormCode(""); setFormLaw(""); setFormProvision("");
    setFormSeverity(5); setFormOperator("AND");
    setFormConditions([emptyCondition()]);
    setFormEffFrom(""); setFormEffTo("");
    setFormOpen(true);
  };

  const openEdit = (rule: LegalMappingRule) => {
    setEditing(rule);
    setFormCode(rule.rule_code);
    setFormLaw(rule.law_name);
    setFormProvision(rule.provision_code);
    setFormSeverity(rule.severity_weight);
    setFormOperator(rule.rule_expression?.operator || "AND");
    setFormConditions(
      rule.rule_expression?.conditions?.length
        ? rule.rule_expression.conditions.map((c) => ({
            field: c.field, op: c.op,
            value: c.value != null ? String(c.value) : "",
            values: c.values || [],
          }))
        : [emptyCondition()]
    );
    setFormEffFrom(rule.effective_from ? rule.effective_from.slice(0, 10) : "");
    setFormEffTo(rule.effective_to ? rule.effective_to.slice(0, 10) : "");
    setFormOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const body = {
      rule_code: formCode,
      law_name: formLaw,
      provision_code: formProvision,
      severity_weight: formSeverity,
      rule_expression: {
        operator: formOperator,
        conditions: formConditions.map((c) => {
          const base: any = { field: c.field, op: c.op };
          if (["in", "not_in", "contains_any", "contains_all"].includes(c.op)) {
            base.values = c.values.length ? c.values : c.value.split(",").map((v: string) => v.trim()).filter(Boolean);
          } else {
            base.value = ["gte", "lte", "gt", "lt"].includes(c.op) ? Number(c.value) : c.value;
          }
          return base;
        }),
      },
      effective_from: formEffFrom || null,
      effective_to: formEffTo || null,
    };
    try {
      const url = editing
        ? `${apiBaseUrl}/api/v1/legal/rules/${editing.rule_id}`
        : `${apiBaseUrl}/api/v1/legal/rules`;
      const res = await fetch(url, {
        ...authHeaders(),
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      showToast("success", t(editing ? "legal.rule_updated" : "legal.rule_created"));
      setFormOpen(false);
      fetchRules();
    } catch { showToast("error", t("common.error")); }
    finally { setSaving(false); }
  };

  const handleLifecycle = async (ruleId: string, action: string, method = "PATCH") => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/legal/rules/${ruleId}/${action}`, {
        ...authHeaders(), method,
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      showToast("success", t(`legal.${action === "submit" ? "submitted" : action === "approve" ? "approved" : action === "reject" ? "rejected" : action === "publish" ? "published" : "rolled_back"}`));
      fetchRules();
    } catch { showToast("error", t("common.error")); }
  };

  const handleTest = async () => {
    if (!testRuleId) return;
    setTesting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/legal/rules/${testRuleId}/test`, {
        ...authHeaders(), method: "POST",
        body: JSON.stringify({
          context: {
            category: testCategory,
            threat_score: testThreat,
            platform: testPlatform,
            keywords: testKeywords,
            language: "", sentiment: "",
          },
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      setTestResult(await res.json());
    } catch { showToast("error", t("common.error")); }
    finally { setTesting(false); }
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      DRAFT: t("legal.status_draft"), PENDING_REVIEW: t("legal.status_pending"),
      APPROVED: t("legal.status_approved"), PUBLISHED: t("legal.status_published"),
      REJECTED: t("legal.status_rejected"), SUPERSEDED: t("legal.status_superseded"),
      ROLLED_BACK: t("legal.status_rolled_back"),
    };
    return map[s] || s;
  };

  const updateCondition = (idx: number, key: string, val: any) => {
    setFormConditions((prev) => prev.map((c, i) => i === idx ? { ...c, [key]: val } : c));
  };

  const rulesTab = (
    <>
      <div className="filter-bar">
        <Field label={t("legal.filter_status")} htmlFor="filter-status">
          <Select id="filter-status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">{t("legal.all_statuses")}</option>
            {["DRAFT", "PENDING_REVIEW", "APPROVED", "PUBLISHED", "REJECTED", "SUPERSEDED", "ROLLED_BACK"].map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("legal.filter_law")} htmlFor="filter-law">
          <Input id="filter-law" value={filterLaw} onChange={(e) => setFilterLaw(e.target.value)} placeholder={t("legal.all_laws")} />
        </Field>
        <div className="filter-bar__actions">
          <Button onClick={openCreate} disabled={isOffline}>{t("legal.create_rule")}</Button>
        </div>
      </div>

      {loading ? (
        <p>{t("common.loading")}</p>
      ) : rules.length === 0 ? (
        <Alert variant="info">{t("legal.no_rules")}</Alert>
      ) : (
        <div className="table-scroll">
          <table className="entity-table">
            <thead>
              <tr>
                <th>{t("legal.rule_code")}</th>
                <th>{t("legal.law_name")}</th>
                <th>{t("legal.provision_code")}</th>
                <th>{t("legal.severity_weight")}</th>
                <th>{t("legal.version")}</th>
                <th>{t("legal.status")}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.rule_id}>
                  <td data-label={t("legal.rule_code")}>{rule.rule_code}</td>
                  <td data-label={t("legal.law_name")}>{rule.law_name}</td>
                  <td data-label={t("legal.provision_code")}>{rule.provision_code}</td>
                  <td data-label={t("legal.severity_weight")}>{rule.severity_weight}</td>
                  <td data-label={t("legal.version")}>{rule.version_no}</td>
                  <td data-label={t("legal.status")}>
                    <Badge variant={STATUS_COLORS[rule.approval_status] || "neutral"}>
                      {statusLabel(rule.approval_status)}
                    </Badge>
                  </td>
                  <td data-label={t("common.actions")}>
                    <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap" }}>
                      {rule.approval_status === "DRAFT" && (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => openEdit(rule)}>{t("legal.edit_rule")}</Button>
                          <Button size="sm" onClick={() => handleLifecycle(rule.rule_id, "submit")}>{t("legal.submit_review")}</Button>
                        </>
                      )}
                      {rule.approval_status === "PENDING_REVIEW" && (
                        <>
                          <Button size="sm" variant="primary" onClick={() => handleLifecycle(rule.rule_id, "approve")}>{t("legal.approve")}</Button>
                          <Button size="sm" variant="danger" onClick={() => handleLifecycle(rule.rule_id, "reject")}>{t("legal.reject")}</Button>
                        </>
                      )}
                      {rule.approval_status === "APPROVED" && (
                        <Button size="sm" onClick={() => handleLifecycle(rule.rule_id, "publish")}>{t("legal.publish")}</Button>
                      )}
                      {rule.approval_status === "PUBLISHED" && (
                        <Button size="sm" variant="danger" onClick={() => handleLifecycle(rule.rule_id, "rollback", "POST")}>{t("legal.rollback")}</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={formOpen}
        title={editing ? t("legal.edit_rule") : t("legal.create_rule")}
        onClose={() => setFormOpen(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving || !formCode || !formLaw || !formProvision}>
              {saving ? t("common.loading") : t("common.save")}
            </Button>
          </>
        }
      >
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <div className="detail-grid">
            <Field label={t("legal.rule_code")} htmlFor="rc"><Input id="rc" value={formCode} onChange={(e) => setFormCode(e.target.value)} /></Field>
            <Field label={t("legal.law_name")} htmlFor="ln"><Input id="ln" value={formLaw} onChange={(e) => setFormLaw(e.target.value)} /></Field>
            <Field label={t("legal.provision_code")} htmlFor="pc"><Input id="pc" value={formProvision} onChange={(e) => setFormProvision(e.target.value)} /></Field>
            <Field label={t("legal.severity_weight")} htmlFor="sw"><Input id="sw" type="number" value={String(formSeverity)} onChange={(e) => setFormSeverity(Number(e.target.value))} /></Field>
            <Field label={t("legal.effective_from")} htmlFor="ef"><Input id="ef" type="date" value={formEffFrom} onChange={(e) => setFormEffFrom(e.target.value)} /></Field>
            <Field label={t("legal.effective_to")} htmlFor="et"><Input id="et" type="date" value={formEffTo} onChange={(e) => setFormEffTo(e.target.value)} /></Field>
          </div>

          <h3 style={{ margin: 0 }}>{t("legal.expression")}</h3>
          <Field label={t("legal.operator")} htmlFor="op-sel">
            <Select id="op-sel" value={formOperator} onChange={(e) => setFormOperator(e.target.value as "AND" | "OR")}>
              <option value="AND">AND</option>
              <option value="OR">OR</option>
            </Select>
          </Field>

          {formConditions.map((cond, idx) => (
            <div key={idx} style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-end", flexWrap: "wrap" }}>
              <Field label={t("legal.field")} htmlFor={`f-${idx}`}>
                <Select id={`f-${idx}`} value={cond.field} onChange={(e) => updateCondition(idx, "field", e.target.value)}>
                  {FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                </Select>
              </Field>
              <Field label={t("legal.op")} htmlFor={`o-${idx}`}>
                <Select id={`o-${idx}`} value={cond.op} onChange={(e) => updateCondition(idx, "op", e.target.value)}>
                  {OPS.map((o) => <option key={o} value={o}>{o}</option>)}
                </Select>
              </Field>
              <Field label={t("legal.value")} htmlFor={`v-${idx}`}>
                <Input id={`v-${idx}`} value={cond.value} onChange={(e) => updateCondition(idx, "value", e.target.value)} placeholder={["in", "not_in", "contains_any", "contains_all"].includes(cond.op) ? t("legal.comma_separated") : ""} />
              </Field>
              <Button size="sm" variant="danger" onClick={() => setFormConditions((p) => p.filter((_, i) => i !== idx))} disabled={formConditions.length <= 1}>
                {t("legal.remove_condition")}
              </Button>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={() => setFormConditions((p) => [...p, emptyCondition()])}>
            {t("legal.add_condition")}
          </Button>
        </div>
      </Modal>
    </>
  );

  const testTab = (
    <div style={{ maxWidth: "48rem" }}>
      <h3 style={{ marginBottom: "var(--space-3)" }}>{t("legal.test_title")}</h3>
      <Field label={t("legal.rule_code")} htmlFor="test-rule">
        <Select id="test-rule" value={testRuleId} onChange={(e) => setTestRuleId(e.target.value)}>
          <option value="">-- {t("legal.rule_code")} --</option>
          {rules.map((r) => <option key={r.rule_id} value={r.rule_id}>{r.rule_code} — {r.law_name} {r.provision_code}</option>)}
        </Select>
      </Field>
      <div className="detail-grid" style={{ marginTop: "var(--space-3)" }}>
        <Field label={t("legal.test_category")} htmlFor="tc"><Input id="tc" value={testCategory} onChange={(e) => setTestCategory(e.target.value)} placeholder="NARCOTICS" /></Field>
        <Field label={t("legal.test_threat_score")} htmlFor="ts"><Input id="ts" type="number" value={String(testThreat)} onChange={(e) => setTestThreat(Number(e.target.value))} /></Field>
        <Field label={t("legal.test_platform")} htmlFor="tp"><Input id="tp" value={testPlatform} onChange={(e) => setTestPlatform(e.target.value)} placeholder="cctns" /></Field>
        <Field label={t("legal.test_keywords")} htmlFor="tk"><Input id="tk" value={testKeywords} onChange={(e) => setTestKeywords(e.target.value)} placeholder="ganja sale delivery" /></Field>
      </div>
      <Button onClick={handleTest} disabled={!testRuleId || testing || isOffline} style={{ marginTop: "var(--space-3)" }}>
        {testing ? t("common.loading") : t("legal.test_run")}
      </Button>

      {testResult && (
        <div style={{ marginTop: "var(--space-4)", padding: "var(--space-3)", background: "var(--color-surface-alt)", borderRadius: "var(--radius-md)" }}>
          <h4>{t("legal.test_result")}</h4>
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", marginTop: "var(--space-2)" }}>
            <Badge variant={testResult.matched ? "success" : "danger"}>
              {testResult.matched ? t("legal.test_matched") : t("legal.test_not_matched")}
            </Badge>
            <span><strong>{t("legal.confidence")}:</strong> {testResult.confidence}%</span>
          </div>
          {testResult.rationale && (
            <p style={{ marginTop: "var(--space-2)", fontSize: "0.875rem" }}>
              <strong>{t("legal.rationale")}:</strong> {testResult.rationale}
            </p>
          )}
          {testResult.matchedConditions && (
            <ul style={{ marginTop: "var(--space-2)", paddingLeft: "var(--space-4)", fontSize: "0.875rem" }}>
              {testResult.matchedConditions.map((c: any, i: number) => (
                <li key={i}>
                  <Badge variant={c.matched ? "success" : "danger"} style={{ marginRight: "var(--space-1)" }}>
                    {c.matched ? "PASS" : "FAIL"}
                  </Badge>
                  {c.field} {c.op}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="view-container">
      <h1>{t("legal.rules_title")}</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--space-4)" }}>{t("legal.rules_subtitle")}</p>
      <Tabs tabs={[
        { key: "rules", label: t("legal.tab_rules"), content: rulesTab },
        { key: "test", label: t("legal.tab_test"), content: testTab },
      ]} />
    </div>
  );
}
