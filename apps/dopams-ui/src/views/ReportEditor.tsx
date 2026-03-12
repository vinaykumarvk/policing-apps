/**
 * Report Editor -- Tab-based editor for report content with evidence, legal provisions, and preview.
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Card, Button, Alert, Badge, Field, Textarea, SkeletonBlock, useToast } from "@puda/shared";
import { apiBaseUrl } from "../types";

type Props = {
  id: string;
  authHeaders: () => Record<string, string>;
  isOffline: boolean;
  onBack: () => void;
};

type Tab = "content" | "evidence" | "legal" | "preview";

type ReportInstance = {
  report_id: string; title: string; state_id: string;
  created_by: string; approved_by?: string; created_at: string;
  content_jsonb?: Record<string, unknown>;
};

interface EvidenceRow {
  evidence_ref: string;
  hash_sha256: string;
  platform: string;
  capture_date: string;
  source_url: string;
  description: string;
}

interface LegalMapping {
  mapping_id: string;
  statute_id: string;
  act_name: string;
  section: string;
  description: string;
  penalty_summary: string;
  confidence: number;
  mapping_source: string;
  confirmed: boolean;
}

export default function ReportEditor({ id, authHeaders, isOffline, onBack }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [report, setReport] = useState<ReportInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("content");

  // Content fields
  const [summary, setSummary] = useState("");
  const [findings, setFindings] = useState("");
  const [methodology, setMethodology] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [saving, setSaving] = useState(false);
  const [populating, setPopulating] = useState(false);

  // Evidence & legal data
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [mappings, setMappings] = useState<LegalMapping[]>([]);

  // Transitions
  const [transitions, setTransitions] = useState<Array<{ transitionId: string; label: string; toStateId: string }>>([]);

  const isDraft = report?.state_id === "DRAFT";
  const isApproved = report?.state_id === "APPROVED" || report?.state_id === "PUBLISHED";

  const fetchReport = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/reports/${id}`, authHeaders());
      if (!res.ok) throw new Error();
      const data = await res.json();
      const r = data.report as ReportInstance;
      setReport(r);
      const content = r.content_jsonb || {};
      setSummary((content.summary as string) || "");
      setFindings((content.findings as string) || "");
      setMethodology((content.methodology as string) || "");
      setConclusion((content.conclusion as string) || "");
      setRecommendations((content.recommendations as string) || "");
      if (content.evidence_items) setEvidence(content.evidence_items as EvidenceRow[]);
    } catch {
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [id, authHeaders, t]);

  const fetchTransitions = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/reports/${id}/transitions`, authHeaders());
      if (res.ok) {
        const data = await res.json();
        setTransitions(data.transitions || []);
      }
    } catch { /* non-critical */ }
  }, [id, authHeaders]);

  const fetchMappings = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/reports/${id}/legal-mappings`, authHeaders());
      if (res.ok) {
        const data = await res.json();
        setMappings(data.mappings || []);
      }
    } catch { /* non-critical */ }
  }, [id, authHeaders]);

  useEffect(() => {
    if (isOffline) return;
    fetchReport();
    fetchTransitions();
    fetchMappings();
  }, [fetchReport, fetchTransitions, fetchMappings, isOffline]);

  const saveContent = async () => {
    if (!isDraft || isOffline) return;
    setSaving(true);
    try {
      const content_jsonb = {
        ...(report?.content_jsonb || {}),
        summary,
        findings,
        methodology,
        conclusion,
        recommendations,
      };
      const res = await fetch(`${apiBaseUrl}/api/v1/reports/${id}`, {
        ...authHeaders(),
        method: "PATCH",
        body: JSON.stringify({ content_jsonb }),
      });
      if (res.ok) {
        const data = await res.json();
        setReport(data.report);
        showToast("success", t("reports.save_success"));
      } else {
        showToast("error", t("reports.save_error"));
      }
    } catch {
      showToast("error", t("reports.save_error"));
    } finally {
      setSaving(false);
    }
  };

  const handlePopulate = async () => {
    if (isOffline) return;
    setPopulating(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/reports/${id}/populate`, {
        ...authHeaders(),
        method: "POST",
      });
      if (res.ok) {
        showToast("success", t("reports.populated"));
        await fetchReport();
        await fetchMappings();
      } else {
        showToast("error", t("common.error"));
      }
    } catch {
      showToast("error", t("common.error"));
    } finally {
      setPopulating(false);
    }
  };

  const handleTransition = async (transitionId: string) => {
    if (isOffline) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/reports/${id}/transition`, {
        ...authHeaders(),
        method: "POST",
        body: JSON.stringify({ transitionId }),
      });
      if (res.ok) {
        showToast("success", t("common.success"));
        await fetchReport();
        await fetchTransitions();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast("error", err.message || t("common.error"));
      }
    } catch {
      showToast("error", t("common.error"));
    }
  };

  const handleExport = async (format: "pdf" | "docx") => {
    if (isOffline || !isApproved) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/reports/${id}/export?format=${format}`, {
        ...authHeaders(),
        method: "POST",
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `report-${id}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        showToast("error", t("reports.export_requires_approval"));
      }
    } catch {
      showToast("error", t("common.error"));
    }
  };

  const handleConfirmMapping = async (mappingId: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/legal/mappings/${mappingId}/confirm`, {
        ...authHeaders(),
        method: "PATCH",
      });
      if (res.ok) {
        await fetchMappings();
        showToast("success", t("common.success"));
      }
    } catch { showToast("error", t("common.error")); }
  };

  if (loading) return <div className="loading-center"><SkeletonBlock height="20rem" /></div>;
  if (error) return <Alert variant="error">{error}</Alert>;
  if (!report) return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: "content", label: t("reports.content") },
    { key: "evidence", label: t("reports.evidence") },
    { key: "legal", label: t("reports.legal_provisions") },
    { key: "preview", label: t("reports.preview") },
  ];

  return (
    <div className="panel">
      <div className="page__header" style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <Button variant="secondary" size="sm" onClick={onBack}>{t("reports.back_to_report")}</Button>
        <h1 style={{ flex: 1, margin: 0 }}>{t("reports.editor")}: {report.title}</h1>
        <Badge variant={isDraft ? "warning" : isApproved ? "success" : "info"}>{report.state_id}</Badge>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
        {isDraft && (
          <>
            <Button variant="primary" onClick={saveContent} disabled={saving || isOffline}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
            <Button variant="secondary" onClick={handlePopulate} disabled={populating || isOffline}>
              {populating ? t("reports.populating") : t("reports.populate")}
            </Button>
          </>
        )}
        {transitions.map((tr) => (
          <Button
            key={tr.transitionId}
            variant={tr.toStateId === "APPROVED" ? "primary" : "secondary"}
            onClick={() => handleTransition(tr.transitionId)}
            disabled={isOffline}
          >
            {tr.toStateId === "IN_REVIEW" ? t("reports.submit_review") : tr.toStateId === "APPROVED" ? t("reports.approve") : tr.label}
          </Button>
        ))}
        {isApproved && (
          <>
            <Button variant="primary" onClick={() => handleExport("pdf")} disabled={isOffline}>{t("reports.export_pdf")}</Button>
            <Button variant="secondary" onClick={() => handleExport("docx")} disabled={isOffline}>{t("reports.export_docx")}</Button>
          </>
        )}
      </div>

      {/* Tab bar */}
      <div className="tab-bar" role="tablist">
        {tabs.map((t_) => (
          <button
            key={t_.key}
            role="tab"
            aria-selected={tab === t_.key}
            className={`tab-btn ${tab === t_.key ? "tab-btn--active" : ""}`}
            onClick={() => setTab(t_.key)}
            type="button"
          >
            {t_.label}
          </button>
        ))}
      </div>

      {/* Content tab */}
      {tab === "content" && (
        <Card>
          <div style={{ display: "grid", gap: "var(--space-4)" }}>
            <Field label={t("reports.summary")} htmlFor="re-summary">
              <Textarea id="re-summary" value={summary} onChange={(e) => setSummary(e.target.value)} onBlur={isDraft ? saveContent : undefined} rows={4} disabled={!isDraft} />
            </Field>
            <Field label={t("reports.findings")} htmlFor="re-findings">
              <Textarea id="re-findings" value={findings} onChange={(e) => setFindings(e.target.value)} onBlur={isDraft ? saveContent : undefined} rows={6} disabled={!isDraft} />
            </Field>
            <Field label={t("reports.methodology")} htmlFor="re-methodology">
              <Textarea id="re-methodology" value={methodology} onChange={(e) => setMethodology(e.target.value)} onBlur={isDraft ? saveContent : undefined} rows={4} disabled={!isDraft} />
            </Field>
            <Field label={t("reports.conclusion")} htmlFor="re-conclusion">
              <Textarea id="re-conclusion" value={conclusion} onChange={(e) => setConclusion(e.target.value)} onBlur={isDraft ? saveContent : undefined} rows={4} disabled={!isDraft} />
            </Field>
            <Field label={t("reports.recommendations")} htmlFor="re-recommendations">
              <Textarea id="re-recommendations" value={recommendations} onChange={(e) => setRecommendations(e.target.value)} onBlur={isDraft ? saveContent : undefined} rows={4} disabled={!isDraft} />
            </Field>
          </div>
        </Card>
      )}

      {/* Evidence tab */}
      {tab === "evidence" && (
        <Card>
          {evidence.length === 0 ? (
            <p style={{ color: "var(--color-text-secondary)" }}>{t("reports.no_evidence")}</p>
          ) : (
            <div className="table-scroll">
              <table className="entity-table">
                <thead>
                  <tr>
                    <th>{t("reports.evidence")}</th>
                    <th>{t("reports.hash")}</th>
                    <th>{t("reports.platform")}</th>
                    <th>{t("reports.capture_date")}</th>
                    <th>{t("reports.description")}</th>
                  </tr>
                </thead>
                <tbody>
                  {evidence.map((ev, idx) => (
                    <tr key={idx}>
                      <td data-label={t("reports.evidence")}>{ev.evidence_ref}</td>
                      <td data-label={t("reports.hash")} style={{ fontFamily: "monospace", wordBreak: "break-all" }}>{ev.hash_sha256}</td>
                      <td data-label={t("reports.platform")}>{ev.platform}</td>
                      <td data-label={t("reports.capture_date")}>{ev.capture_date}</td>
                      <td data-label={t("reports.description")}>{ev.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Legal Provisions tab */}
      {tab === "legal" && (
        <Card>
          {mappings.length === 0 ? (
            <p style={{ color: "var(--color-text-secondary)" }}>{t("reports.no_legal")}</p>
          ) : (
            <div className="table-scroll">
              <table className="entity-table">
                <thead>
                  <tr>
                    <th>{t("legal.law_name")}</th>
                    <th>{t("legal.provision_code")}</th>
                    <th>{t("reports.description")}</th>
                    <th>{t("reports.confidence")}</th>
                    <th>{t("reports.source")}</th>
                    <th>{t("reports.confirmed")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((m) => (
                    <tr key={m.mapping_id}>
                      <td data-label={t("legal.law_name")}>{m.act_name}</td>
                      <td data-label={t("legal.provision_code")}>{m.section}</td>
                      <td data-label={t("reports.description")}>{m.description}</td>
                      <td data-label={t("reports.confidence")}>
                        <Badge variant={m.confidence >= 70 ? "success" : m.confidence >= 40 ? "warning" : "neutral"}>
                          {m.confidence}%
                        </Badge>
                      </td>
                      <td data-label={t("reports.source")}>
                        <Badge variant={m.mapping_source === "MANUAL" ? "info" : "neutral"}>
                          {m.mapping_source === "MANUAL" ? t("reports.manual") : t("reports.auto")}
                        </Badge>
                      </td>
                      <td data-label={t("reports.confirmed")}>
                        {m.confirmed ? <Badge variant="success">{t("reports.confirmed")}</Badge> : "\u2014"}
                      </td>
                      <td>
                        {!m.confirmed && (
                          <Button size="sm" variant="secondary" onClick={() => handleConfirmMapping(m.mapping_id)} disabled={isOffline}>
                            {t("reports.confirm_mapping")}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Preview tab */}
      {tab === "preview" && (
        <Card>
          <div style={{ maxWidth: "65ch" }}>
            <h2 style={{ marginBottom: "var(--space-2)" }}>{report.title}</h2>
            <p style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-4)" }}>
              {report.state_id} | {t("reports.capture_date")}: {new Date(report.created_at).toLocaleDateString()}
            </p>

            {summary && (
              <section style={{ marginBottom: "var(--space-4)" }}>
                <h3>{t("reports.summary")}</h3>
                <p style={{ whiteSpace: "pre-wrap" }}>{summary}</p>
              </section>
            )}

            {evidence.length > 0 && (
              <section style={{ marginBottom: "var(--space-4)" }}>
                <h3>{t("reports.evidence")} ({evidence.length})</h3>
                <ul>
                  {evidence.map((ev, idx) => (
                    <li key={idx}><strong>{ev.evidence_ref}</strong> -- {ev.platform}, {ev.capture_date}</li>
                  ))}
                </ul>
              </section>
            )}

            {mappings.length > 0 && (
              <section style={{ marginBottom: "var(--space-4)" }}>
                <h3>{t("reports.legal_provisions")} ({mappings.length})</h3>
                <ul>
                  {mappings.map((m) => (
                    <li key={m.mapping_id}>
                      <strong>{m.act_name} {m.section}</strong> -- {m.description}
                      {m.penalty_summary && <em> (Max: {m.penalty_summary})</em>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {findings && (
              <section style={{ marginBottom: "var(--space-4)" }}>
                <h3>{t("reports.findings")}</h3>
                <p style={{ whiteSpace: "pre-wrap" }}>{findings}</p>
              </section>
            )}

            {methodology && (
              <section style={{ marginBottom: "var(--space-4)" }}>
                <h3>{t("reports.methodology")}</h3>
                <p style={{ whiteSpace: "pre-wrap" }}>{methodology}</p>
              </section>
            )}

            {conclusion && (
              <section style={{ marginBottom: "var(--space-4)" }}>
                <h3>{t("reports.conclusion")}</h3>
                <p style={{ whiteSpace: "pre-wrap" }}>{conclusion}</p>
              </section>
            )}

            {recommendations && (
              <section style={{ marginBottom: "var(--space-4)" }}>
                <h3>{t("reports.recommendations")}</h3>
                <p style={{ whiteSpace: "pre-wrap" }}>{recommendations}</p>
              </section>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
