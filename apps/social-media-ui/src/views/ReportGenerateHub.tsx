import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Select, useToast } from "@puda/shared";
import { Bilingual } from "../Bilingual";
import { apiBaseUrl } from "../types";

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean };

type ReportType = "case_summary" | "legal_references" | "final_submission";

interface CaseOption { case_id: string; case_ref?: string; title?: string }

const REPORT_TYPES: { value: ReportType; labelKey: string; descKey: string; icon: string }[] = [
  {
    value: "case_summary",
    labelKey: "report_gen.case_summary",
    descKey: "report_gen.case_summary_desc",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
  {
    value: "legal_references",
    labelKey: "report_gen.legal_references",
    descKey: "report_gen.legal_references_desc",
    icon: "M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3",
  },
  {
    value: "final_submission",
    labelKey: "report_gen.final_submission",
    descKey: "report_gen.final_submission_desc",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
  },
];

import { renderMarkdown } from "../utils/render-markdown";

export default function ReportGenerateHub({ authHeaders, isOffline }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ caseRef: string; provider: string; model: string; latencyMs: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch cases for selector
  useEffect(() => {
    setCasesLoading(true);
    fetch(`${apiBaseUrl}/api/v1/cases?limit=200&sort=created_at:desc`, authHeaders())
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load cases"))))
      .then((data) => setCases(data.cases || data.rows || []))
      .catch(() => setCases([]))
      .finally(() => setCasesLoading(false));
  }, [authHeaders]);

  const handleGenerate = useCallback(async () => {
    if (!selectedType || !selectedCaseId) return;
    setGenerating(true);
    setError(null);
    setMarkdown(null);
    setMeta(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/reports/generate`, {
        ...authHeaders(), method: "POST",
        body: JSON.stringify({ caseId: selectedCaseId, reportType: selectedType }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Generation failed" }));
        throw new Error(err.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setMarkdown(data.markdown);
      setMeta({ caseRef: data.caseRef, provider: data.provider, model: data.model, latencyMs: data.latencyMs });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setError(msg);
      showToast("error", msg);
    } finally {
      setGenerating(false);
    }
  }, [selectedType, selectedCaseId, authHeaders, showToast]);

  const handleDownloadPdf = useCallback(async () => {
    if (!markdown) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/reports/generate/pdf`, {
        ...authHeaders(), method: "POST",
        body: JSON.stringify({
          markdown,
          reportType: selectedType,
          caseRef: meta?.caseRef,
        }),
      });

      if (!res.ok) throw new Error("PDF generation failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedType}_${meta?.caseRef || "report"}_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast("error", t("report_gen.generation_failed"));
    }
  }, [markdown, selectedType, meta, authHeaders, showToast, t]);

  const handleDownloadMd = useCallback(() => {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedType}_${meta?.caseRef || "report"}_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [markdown, selectedType, meta]);

  const canGenerate = selectedType && selectedCaseId && !generating && !isOffline;

  return (
    <div className="rg-hub">
      <header className="rg-hub__header">
        <h1 className="rg-hub__title"><Bilingual tKey="report_gen.title" /></h1>
        <p className="rg-hub__subtitle">{t("report_gen.subtitle")}</p>
      </header>

      {/* Report type cards */}
      <section className="rg-hub__types" aria-label={t("report_gen.select_type")}>
        <h2 className="rg-hub__section-label"><Bilingual tKey="report_gen.select_type" /></h2>
        <div className="rg-type-cards">
          {REPORT_TYPES.map((rt) => (
            <button
              key={rt.value}
              type="button"
              className={`rg-type-card ${selectedType === rt.value ? "rg-type-card--selected" : ""}`}
              onClick={() => setSelectedType(rt.value)}
            >
              <span className="rg-type-card__icon" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={rt.icon} />
                </svg>
              </span>
              <span className="rg-type-card__label"><Bilingual tKey={rt.labelKey} /></span>
              <span className="rg-type-card__desc">{t(rt.descKey)}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Case selector */}
      <section className="rg-hub__case-select">
        <h2 className="rg-hub__section-label"><Bilingual tKey="report_gen.select_case" /></h2>
        {casesLoading ? (
          <p>{t("common.loading")}</p>
        ) : cases.length === 0 ? (
          <Alert variant="info">{t("report_gen.no_cases")}</Alert>
        ) : (
          <Select value={selectedCaseId} onChange={(e) => setSelectedCaseId(e.target.value)}>
            <option value="">{t("report_gen.select_case_placeholder")}</option>
            {cases.map((c) => (
              <option key={c.case_id} value={c.case_id}>
                {c.case_ref || c.case_id} — {c.title || "Untitled"}
              </option>
            ))}
          </Select>
        )}
      </section>

      {/* Generate button */}
      <div className="rg-hub__actions">
        <Button
          variant="primary"
          onClick={handleGenerate}
          disabled={!canGenerate}
          loading={generating}
        >
          {generating ? t("report_gen.generating") : markdown ? t("report_gen.regenerate") : t("report_gen.generate")}
        </Button>
      </div>

      {/* Error */}
      {error && <Alert variant="danger" className="rg-hub__error">{error}</Alert>}

      {/* Markdown preview */}
      {markdown && (
        <section className="rg-hub__preview">
          <h2 className="rg-hub__section-label"><Bilingual tKey="report_gen.preview" /></h2>
          {meta && (
            <p className="rg-hub__meta">
              {meta.provider}/{meta.model} &middot; {(meta.latencyMs / 1000).toFixed(1)}s
            </p>
          )}
          <div
            className="rg-preview-card"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}
          />

          {/* Download buttons */}
          <div className="rg-hub__downloads">
            <Button variant="primary" onClick={handleDownloadPdf}>
              {t("report_gen.download_pdf")}
            </Button>
            <Button variant="secondary" onClick={handleDownloadMd}>
              {t("report_gen.download_md")}
            </Button>
          </div>
        </section>
      )}

      <style>{`
        .rg-hub { max-width: 64rem; margin: 0 auto; }
        .rg-hub__header { margin-bottom: var(--space-5); }
        .rg-hub__title { font-size: clamp(1.25rem, 2vw + 0.5rem, 1.75rem); line-height: 1.2; margin: 0 0 var(--space-2); }
        .rg-hub__subtitle { color: var(--color-text-secondary); margin: 0; }
        .rg-hub__section-label { font-size: 1rem; font-weight: 600; margin: 0 0 var(--space-3); }
        .rg-hub__types { margin-bottom: var(--space-5); }

        .rg-type-cards { display: grid; gap: var(--space-3); grid-template-columns: 1fr; }
        @media (min-width: 48rem) { .rg-type-cards { grid-template-columns: repeat(3, 1fr); } }

        .rg-type-card {
          display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-2);
          padding: var(--space-4); border: 2px solid var(--color-border);
          border-radius: var(--radius-md); background: var(--color-surface);
          cursor: pointer; text-align: left; min-height: 2.75rem;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .rg-type-card:hover { border-color: var(--color-primary); }
        .rg-type-card:active { border-color: var(--color-primary); box-shadow: var(--shadow-sm); }
        .rg-type-card--selected { border-color: var(--color-primary); background: var(--color-primary-subtle, var(--color-surface)); box-shadow: 0 0 0 1px var(--color-primary); }
        .rg-type-card__icon { color: var(--color-primary); }
        .rg-type-card__label { font-weight: 600; font-size: 0.9375rem; }
        .rg-type-card__desc { font-size: 0.8125rem; color: var(--color-text-secondary); line-height: 1.4; }

        .rg-hub__case-select { margin-bottom: var(--space-4); max-width: 32rem; }
        .rg-hub__actions { margin-bottom: var(--space-5); }
        .rg-hub__error { margin-bottom: var(--space-4); }
        .rg-hub__meta { font-size: 0.8125rem; color: var(--color-text-secondary); margin: 0 0 var(--space-3); }

        .rg-hub__preview { margin-bottom: var(--space-6); }
        .rg-preview-card {
          padding: var(--space-4); border: 1px solid var(--color-border);
          border-radius: var(--radius-md); background: var(--color-surface);
          overflow-x: auto; line-height: 1.6; word-break: break-word;
        }
        .rg-preview-card h2 { font-size: 1.25rem; margin: var(--space-4) 0 var(--space-2); }
        .rg-preview-card h3 { font-size: 1.1rem; margin: var(--space-3) 0 var(--space-2); }
        .rg-preview-card h4 { font-size: 1rem; margin: var(--space-3) 0 var(--space-1); }
        .rg-preview-card ul { padding-left: var(--space-4); margin: var(--space-2) 0; }
        .rg-preview-card li { margin-bottom: var(--space-1); }

        .rg-table { width: 100%; border-collapse: collapse; margin: var(--space-3) 0; font-size: 0.875rem; }
        .rg-table th, .rg-table td { padding: var(--space-2); border: 1px solid var(--color-border); text-align: left; }
        .rg-table th { background: var(--color-surface-raised, var(--color-surface)); font-weight: 600; }

        .rg-hub__downloads { display: flex; gap: var(--space-3); margin-top: var(--space-4); flex-wrap: wrap; }
      `}</style>
    </div>
  );
}
