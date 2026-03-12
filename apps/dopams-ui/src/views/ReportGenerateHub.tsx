import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Select, useToast } from "@puda/shared";
import { apiBaseUrl } from "../types";
import { renderMarkdown } from "../utils/render-markdown";

type Props = {
  authHeaders: () => RequestInit;
  isOffline: boolean;
  onNavigate?: (view: string, resourceId?: string) => void;
};

/* ── Types ── */

type Tab = "dossiers" | "interrogation" | "monthly" | "mis" | "ai-reports";

/* ── AI Report types ── */

type AiReportType = "case_summary" | "legal_references" | "final_submission";

const AI_REPORT_TYPES: { value: AiReportType; labelKey: string; descKey: string; icon: string }[] = [
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

interface DossierRow {
  dossier_id: string;
  dossier_ref: string;
  title: string;
  state_id: string;
  subject_id: string | null;
  case_id: string | null;
  created_at: string;
}

interface InterrogationRow {
  report_id: string;
  report_ref: string;
  subject_id: string | null;
  case_id: string | null;
  interrogation_date: string | null;
  location: string | null;
  state_id: string;
  created_at: string;
}

interface MonthlyReportRow {
  report_id: string;
  report_month: string;
  unit_id: string | null;
  state_id: string;
  generated_at: string | null;
  published_at: string | null;
}

interface MisData {
  title: string;
  rows: Record<string, unknown>[];
}

interface SubjectOption {
  subject_id: string;
  full_name: string;
  subject_ref: string;
}

interface CaseOption {
  case_id: string;
  case_number?: string;
  title?: string;
}

/* ── Tab config ── */

const TABS: { key: Tab; labelKey: string; icon: string }[] = [
  {
    key: "dossiers",
    labelKey: "reports.tab_dossiers",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
  {
    key: "interrogation",
    labelKey: "reports.tab_interrogation",
    icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z",
  },
  {
    key: "monthly",
    labelKey: "reports.tab_monthly",
    icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  },
  {
    key: "mis",
    labelKey: "reports.tab_mis",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
  {
    key: "ai-reports",
    labelKey: "reports.tab_ai_reports",
    icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  },
];

const STATE_COLORS: Record<string, string> = {
  DRAFT: "var(--color-warning)",
  ASSEMBLED: "var(--color-info)",
  REVIEWED: "var(--color-info)",
  EXPORTED: "var(--color-success)",
  COMPLETED: "var(--color-info)",
  SIGNED: "var(--color-success)",
  GENERATED: "var(--color-info)",
  PUBLISHED: "var(--color-success)",
};

/* ── Component ── */

export default function ReportGenerateHub({ authHeaders, isOffline, onNavigate }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>("dossiers");
  const [loading, setLoading] = useState(false);

  // Dossier state
  const [dossiers, setDossiers] = useState<DossierRow[]>([]);
  const [dossierTotal, setDossierTotal] = useState(0);

  // Interrogation state
  const [interrogations, setInterrogations] = useState<InterrogationRow[]>([]);
  const [interrogationTotal, setInterrogationTotal] = useState(0);

  // Monthly state
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReportRow[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [generateMonth, setGenerateMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // MIS state
  const [misType, setMisType] = useState("severity-summary");
  const [misData, setMisData] = useState<MisData | null>(null);
  const [misLoading, setMisLoading] = useState(false);

  // AI Reports state
  const [aiReportType, setAiReportType] = useState<AiReportType | null>(null);
  const [aiCaseId, setAiCaseId] = useState("");
  const [aiCases, setAiCases] = useState<CaseOption[]>([]);
  const [aiCasesLoading, setAiCasesLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiMarkdown, setAiMarkdown] = useState<string | null>(null);
  const [aiMeta, setAiMeta] = useState<{ caseRef: string; provider: string; model: string; latencyMs: number } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // E-Court ingestion state
  const [ecourtUrl, setEcourtUrl] = useState("");
  const [ecourtName, setEcourtName] = useState("");
  const [ecourtConnectors, setEcourtConnectors] = useState<Array<{ connector_id: string; name: string; connector_type: string; config: Record<string, unknown>; is_active: boolean; last_polled_at: string | null; health_status: string | null }>>([]);
  const [addingConnector, setAddingConnector] = useState(false);

  // Create dossier form
  const [showCreateDossier, setShowCreateDossier] = useState(false);
  const [dossierTitle, setDossierTitle] = useState("");
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [creating, setCreating] = useState(false);

  /* ── Data loaders ── */

  const loadDossiers = useCallback(() => {
    setLoading(true);
    fetch(`${apiBaseUrl}/api/v1/dossiers?limit=50`, authHeaders())
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((data) => {
        setDossiers(data.dossiers || []);
        setDossierTotal(data.total || 0);
      })
      .catch(() => setDossiers([]))
      .finally(() => setLoading(false));
  }, [authHeaders]);

  const loadInterrogations = useCallback(() => {
    setLoading(true);
    fetch(`${apiBaseUrl}/api/v1/interrogation-reports?limit=50`, authHeaders())
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((data) => {
        setInterrogations(data.reports || []);
        setInterrogationTotal(data.total || 0);
      })
      .catch(() => setInterrogations([]))
      .finally(() => setLoading(false));
  }, [authHeaders]);

  const loadMonthly = useCallback(() => {
    setLoading(true);
    fetch(`${apiBaseUrl}/api/v1/monthly-reports?limit=50`, authHeaders())
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((data) => {
        setMonthlyReports(data.reports || []);
        setMonthlyTotal(data.total || 0);
      })
      .catch(() => setMonthlyReports([]))
      .finally(() => setLoading(false));
  }, [authHeaders]);

  const loadMis = useCallback(
    (type: string) => {
      setMisLoading(true);
      setMisData(null);
      fetch(`${apiBaseUrl}/api/v1/reports/mis/${type}`, authHeaders())
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
        .then((data) => {
          const rows = data.rows || data.pipeline || data.metrics || data.funnel
            || data.trends || data.officers || [data];
          setMisData({ title: type.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()), rows: Array.isArray(rows) ? rows : [rows] });
        })
        .catch(() => showToast("error", t("reports.mis_load_failed")))
        .finally(() => setMisLoading(false));
    },
    [authHeaders, showToast, t],
  );

  const loadAiCases = useCallback(() => {
    setAiCasesLoading(true);
    fetch(`${apiBaseUrl}/api/v1/cases?limit=200&sort=created_at:desc`, authHeaders())
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .then((data) => setAiCases(data.rows || data.cases || []))
      .catch(() => setAiCases([]))
      .finally(() => setAiCasesLoading(false));
  }, [authHeaders]);

  const handleAiGenerate = useCallback(async () => {
    if (!aiReportType || !aiCaseId) return;
    setAiGenerating(true);
    setAiError(null);
    setAiMarkdown(null);
    setAiMeta(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/reports/generate`, {
        ...authHeaders(),
        method: "POST",
        body: JSON.stringify({ caseId: aiCaseId, reportType: aiReportType }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Generation failed" }));
        throw new Error(err.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setAiMarkdown(data.markdown);
      setAiMeta({ caseRef: data.caseRef, provider: data.provider, model: data.model, latencyMs: data.latencyMs });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setAiError(msg);
      showToast("error", msg);
    } finally {
      setAiGenerating(false);
    }
  }, [aiReportType, aiCaseId, authHeaders, showToast]);

  const handleAiDownloadPdf = useCallback(async () => {
    if (!aiMarkdown) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/reports/generate/pdf`, {
        ...authHeaders(),
        method: "POST",
        body: JSON.stringify({
          markdown: aiMarkdown,
          reportType: aiReportType,
          caseRef: aiMeta?.caseRef,
        }),
      });

      if (!res.ok) throw new Error("PDF generation failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${aiReportType}_${aiMeta?.caseRef || "report"}_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast("error", t("report_gen.generation_failed"));
    }
  }, [aiMarkdown, aiReportType, aiMeta, authHeaders, showToast, t]);

  const handleAiDownloadMd = useCallback(() => {
    if (!aiMarkdown) return;
    const blob = new Blob([aiMarkdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${aiReportType}_${aiMeta?.caseRef || "report"}_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [aiMarkdown, aiReportType, aiMeta]);

  const loadEcourtConnectors = useCallback(() => {
    fetch(`${apiBaseUrl}/api/v1/ingestion/connectors`, authHeaders())
      .then((r) => (r.ok ? r.json() : { connectors: [] }))
      .then((data) => {
        const all = data.connectors || data.rows || [];
        setEcourtConnectors(all.filter((c: { connector_type: string }) => c.connector_type === "ECOURTS"));
      })
      .catch(() => setEcourtConnectors([]));
  }, [authHeaders]);

  // Load reference data for create form
  const loadReferenceData = useCallback(() => {
    Promise.all([
      fetch(`${apiBaseUrl}/api/v1/subjects?limit=200`, authHeaders())
        .then((r) => (r.ok ? r.json() : { rows: [] }))
        .then((d) => setSubjects(d.rows || d.subjects || [])),
      fetch(`${apiBaseUrl}/api/v1/cases?limit=200`, authHeaders())
        .then((r) => (r.ok ? r.json() : { rows: [] }))
        .then((d) => setCases(d.rows || d.cases || [])),
    ]).catch(() => {});
  }, [authHeaders]);

  // Load data on tab change
  useEffect(() => {
    if (activeTab === "dossiers") loadDossiers();
    else if (activeTab === "interrogation") loadInterrogations();
    else if (activeTab === "monthly") { loadMonthly(); loadEcourtConnectors(); }
    else if (activeTab === "mis") loadMis(misType);
    else if (activeTab === "ai-reports") loadAiCases();
  }, [activeTab, loadDossiers, loadInterrogations, loadMonthly, loadEcourtConnectors, loadMis, misType, loadAiCases]);

  /* ── Actions ── */

  const handleCreateDossier = async () => {
    if (!dossierTitle.trim()) return;
    setCreating(true);
    try {
      const body: Record<string, string> = { title: dossierTitle.trim() };
      if (selectedSubjectId) body.subjectId = selectedSubjectId;
      if (selectedCaseId) body.caseId = selectedCaseId;

      const res = await fetch(`${apiBaseUrl}/api/v1/dossiers`, {
        ...authHeaders(),
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      showToast("success", t("reports.dossier_created"));
      setShowCreateDossier(false);
      setDossierTitle("");
      setSelectedSubjectId("");
      setSelectedCaseId("");
      loadDossiers();
    } catch {
      showToast("error", t("reports.create_failed"));
    } finally {
      setCreating(false);
    }
  };

  const handleAssembleDossier = async (id: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/dossiers/${id}/assemble`, {
        ...authHeaders(),
        method: "POST",
      });
      if (!res.ok) throw new Error(`${res.status}`);
      showToast("success", t("reports.dossier_assembled"));
      loadDossiers();
    } catch {
      showToast("error", t("reports.assemble_failed"));
    }
  };

  const handleExportDossier = async (id: string, format: "PDF" | "DOCX") => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/dossiers/${id}/export?format=${format}`, authHeaders());
      if (!res.ok) throw new Error(`${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dossier-${id}.${format.toLowerCase()}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast("error", t("reports.export_failed"));
    }
  };

  const handleExportInterrogation = async (id: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/interrogation-reports/${id}/pdf`, authHeaders());
      if (!res.ok) throw new Error(`${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `interrogation-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast("error", t("reports.export_failed"));
    }
  };

  const handleAddEcourtSource = async () => {
    if (!ecourtUrl.trim() || !ecourtName.trim()) return;
    setAddingConnector(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/ingestion/connectors`, {
        ...authHeaders(),
        method: "POST",
        body: JSON.stringify({
          connectorType: "ECOURTS",
          name: ecourtName.trim(),
          config: {
            baseUrl: ecourtUrl.trim(),
            dataTypes: ["case_status", "bail_orders", "hearings", "convictions"],
            pollingIntervalSeconds: 21600,
          },
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      showToast("success", t("reports.ecourt_added"));
      setEcourtUrl("");
      setEcourtName("");
      loadEcourtConnectors();
    } catch {
      showToast("error", t("reports.ecourt_add_failed"));
    } finally {
      setAddingConnector(false);
    }
  };

  const handleGenerateMonthly = async () => {
    if (!generateMonth) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/monthly-reports/generate`, {
        ...authHeaders(),
        method: "POST",
        body: JSON.stringify({ month: generateMonth }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      showToast("success", t("reports.monthly_generated"));
      loadMonthly();
    } catch {
      showToast("error", t("reports.generate_failed"));
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try { return new Date(d).toLocaleDateString(); } catch { return d; }
  };

  const stateBadge = (state: string) => (
    <span className="rpt-badge" style={{ backgroundColor: STATE_COLORS[state] || "var(--color-neutral)" }}>
      {state}
    </span>
  );

  /* ── Render ── */

  return (
    <div className="rpt-hub">
      <header className="rpt-hub__header">
        <h1 className="rpt-hub__title">{t("reports.title")}</h1>
        <p className="rpt-hub__subtitle">{t("reports.subtitle")}</p>
      </header>

      {/* Tab bar */}
      <nav className="rpt-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`rpt-tab ${activeTab === tab.key ? "rpt-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={tab.icon} />
            </svg>
            <span>{t(tab.labelKey)}</span>
          </button>
        ))}
      </nav>

      {/* ── Dossiers Tab ── */}
      {activeTab === "dossiers" && (
        <section className="rpt-section">
          <div className="rpt-section__header">
            <h2>{t("reports.tab_dossiers")} ({dossierTotal})</h2>
            <Button
              variant="primary"
              onClick={() => {
                setShowCreateDossier(true);
                loadReferenceData();
              }}
              disabled={isOffline}
            >
              {t("reports.create_dossier")}
            </Button>
          </div>

          {showCreateDossier && (
            <div className="rpt-create-form">
              <div className="rpt-create-form__field">
                <label>{t("reports.dossier_title_label")}</label>
                <input
                  type="text"
                  value={dossierTitle}
                  onChange={(e) => setDossierTitle(e.target.value)}
                  placeholder={t("reports.dossier_title_placeholder")}
                  className="rpt-input"
                />
              </div>
              <div className="rpt-create-form__field">
                <label>{t("reports.linked_subject")}</label>
                <Select value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(e.target.value)}>
                  <option value="">{t("reports.optional")}</option>
                  {subjects.map((s) => (
                    <option key={s.subject_id} value={s.subject_id}>
                      {s.subject_ref} — {s.full_name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="rpt-create-form__field">
                <label>{t("reports.linked_case")}</label>
                <Select value={selectedCaseId} onChange={(e) => setSelectedCaseId(e.target.value)}>
                  <option value="">{t("reports.optional")}</option>
                  {cases.map((c) => (
                    <option key={c.case_id} value={c.case_id}>
                      {c.case_number || c.case_id} — {c.title || "Untitled"}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="rpt-create-form__actions">
                <Button variant="primary" onClick={handleCreateDossier} disabled={!dossierTitle.trim() || creating}>
                  {creating ? t("common.saving") : t("reports.create")}
                </Button>
                <Button variant="secondary" onClick={() => setShowCreateDossier(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="rpt-loading">{t("common.loading")}</p>
          ) : dossiers.length === 0 ? (
            <Alert variant="info">{t("reports.no_dossiers")}</Alert>
          ) : (
            <div className="rpt-table-wrap">
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th>{t("reports.col_ref")}</th>
                    <th>{t("reports.col_title")}</th>
                    <th>{t("reports.col_state")}</th>
                    <th>{t("reports.col_created")}</th>
                    <th>{t("reports.col_actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {dossiers.map((d) => (
                    <tr key={d.dossier_id}>
                      <td data-label={t("reports.col_ref")}>{d.dossier_ref}</td>
                      <td data-label={t("reports.col_title")}>{d.title}</td>
                      <td data-label={t("reports.col_state")}>{stateBadge(d.state_id)}</td>
                      <td data-label={t("reports.col_created")}>{formatDate(d.created_at)}</td>
                      <td data-label={t("reports.col_actions")}>
                        <div className="rpt-actions">
                          {d.state_id === "DRAFT" && (
                            <Button variant="secondary" onClick={() => handleAssembleDossier(d.dossier_id)}>
                              {t("reports.assemble")}
                            </Button>
                          )}
                          {(d.state_id === "ASSEMBLED" || d.state_id === "EXPORTED" || d.state_id === "REVIEWED") && (
                            <>
                              <Button variant="primary" onClick={() => handleExportDossier(d.dossier_id, "PDF")}>
                                PDF
                              </Button>
                              <Button variant="secondary" onClick={() => handleExportDossier(d.dossier_id, "DOCX")}>
                                DOCX
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Interrogation Tab ── */}
      {activeTab === "interrogation" && (
        <section className="rpt-section">
          <div className="rpt-section__header">
            <h2>{t("reports.tab_interrogation")} ({interrogationTotal})</h2>
          </div>

          {loading ? (
            <p className="rpt-loading">{t("common.loading")}</p>
          ) : interrogations.length === 0 ? (
            <Alert variant="info">{t("reports.no_interrogations")}</Alert>
          ) : (
            <div className="rpt-table-wrap">
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th>{t("reports.col_ref")}</th>
                    <th>{t("reports.col_date")}</th>
                    <th>{t("reports.col_location")}</th>
                    <th>{t("reports.col_state")}</th>
                    <th>{t("reports.col_actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {interrogations.map((r) => (
                    <tr key={r.report_id}>
                      <td data-label={t("reports.col_ref")}>{r.report_ref}</td>
                      <td data-label={t("reports.col_date")}>{formatDate(r.interrogation_date)}</td>
                      <td data-label={t("reports.col_location")}>{r.location || "—"}</td>
                      <td data-label={t("reports.col_state")}>{stateBadge(r.state_id)}</td>
                      <td data-label={t("reports.col_actions")}>
                        <Button variant="secondary" onClick={() => handleExportInterrogation(r.report_id)}>
                          PDF
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Monthly Reports Tab ── */}
      {activeTab === "monthly" && (
        <section className="rpt-section">
          <div className="rpt-section__header">
            <h2>{t("reports.tab_monthly")} ({monthlyTotal})</h2>
            <div className="rpt-monthly-gen">
              <input
                type="month"
                value={generateMonth}
                onChange={(e) => setGenerateMonth(e.target.value)}
                className="rpt-input"
              />
              <Button variant="primary" onClick={handleGenerateMonthly} disabled={isOffline || !generateMonth}>
                {t("reports.generate_monthly")}
              </Button>
            </div>
          </div>

          {loading ? (
            <p className="rpt-loading">{t("common.loading")}</p>
          ) : monthlyReports.length === 0 ? (
            <Alert variant="info">{t("reports.no_monthly")}</Alert>
          ) : (
            <div className="rpt-table-wrap">
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th>{t("reports.col_month")}</th>
                    <th>{t("reports.col_state")}</th>
                    <th>{t("reports.col_generated")}</th>
                    <th>{t("reports.col_published")}</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyReports.map((r) => (
                    <tr key={r.report_id}>
                      <td data-label={t("reports.col_month")}>{r.report_month?.slice(0, 7) || "—"}</td>
                      <td data-label={t("reports.col_state")}>{stateBadge(r.state_id)}</td>
                      <td data-label={t("reports.col_generated")}>{formatDate(r.generated_at)}</td>
                      <td data-label={t("reports.col_published")}>{formatDate(r.published_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── E-Court Ingestion Sources ── */}
          <div className="rpt-ecourt-section">
            <h3 className="rpt-ecourt-section__title">{t("reports.ecourt_sources_title")}</h3>
            <p className="rpt-ecourt-section__desc">{t("reports.ecourt_sources_desc")}</p>

            {/* Add new source form */}
            <div className="rpt-ecourt-form">
              <div className="rpt-ecourt-form__row">
                <div className="rpt-ecourt-form__field">
                  <label>{t("reports.ecourt_name")}</label>
                  <input
                    type="text"
                    value={ecourtName}
                    onChange={(e) => setEcourtName(e.target.value)}
                    placeholder={t("reports.ecourt_name_placeholder")}
                    className="rpt-input"
                  />
                </div>
                <div className="rpt-ecourt-form__field rpt-ecourt-form__field--url">
                  <label>{t("reports.ecourt_url")}</label>
                  <input
                    type="url"
                    value={ecourtUrl}
                    onChange={(e) => setEcourtUrl(e.target.value)}
                    placeholder="https://districts.ecourts.gov.in/..."
                    className="rpt-input"
                  />
                </div>
                <div className="rpt-ecourt-form__action">
                  <Button
                    variant="primary"
                    onClick={handleAddEcourtSource}
                    disabled={!ecourtUrl.trim() || !ecourtName.trim() || addingConnector || isOffline}
                  >
                    {addingConnector ? t("common.saving") : t("reports.ecourt_add")}
                  </Button>
                </div>
              </div>
            </div>

            {/* Existing sources table */}
            {ecourtConnectors.length > 0 && (
              <div className="rpt-table-wrap">
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th>{t("reports.ecourt_col_name")}</th>
                      <th>{t("reports.ecourt_col_url")}</th>
                      <th>{t("reports.ecourt_col_status")}</th>
                      <th>{t("reports.ecourt_col_last_sync")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ecourtConnectors.map((c) => (
                      <tr key={c.connector_id}>
                        <td data-label={t("reports.ecourt_col_name")}>{c.name}</td>
                        <td data-label={t("reports.ecourt_col_url")} style={{ wordBreak: "break-all", fontSize: "0.8125rem" }}>
                          {(c.config as { baseUrl?: string })?.baseUrl || "—"}
                        </td>
                        <td data-label={t("reports.ecourt_col_status")}>
                          <span className="rpt-badge" style={{ backgroundColor: c.is_active ? "var(--color-success)" : "var(--color-warning)" }}>
                            {c.is_active ? (c.health_status || "ACTIVE") : "INACTIVE"}
                          </span>
                        </td>
                        <td data-label={t("reports.ecourt_col_last_sync")}>{formatDate(c.last_polled_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {ecourtConnectors.length === 0 && (
              <Alert variant="info">{t("reports.no_ecourt_sources")}</Alert>
            )}
          </div>
        </section>
      )}

      {/* ── MIS Reports Tab ── */}
      {activeTab === "mis" && (
        <section className="rpt-section">
          <div className="rpt-section__header">
            <h2>{t("reports.tab_mis")}</h2>
          </div>

          <div className="rpt-mis-selector">
            <Select
              value={misType}
              onChange={(e) => {
                setMisType(e.target.value);
                loadMis(e.target.value);
              }}
            >
              <option value="severity-summary">{t("reports.mis_severity")}</option>
              <option value="lead-pipeline">{t("reports.mis_pipeline")}</option>
              <option value="response-time">{t("reports.mis_response_time")}</option>
              <option value="category-trends">{t("reports.mis_category_trends")}</option>
              <option value="officer-workload">{t("reports.mis_officer_workload")}</option>
              <option value="escalation-funnel">{t("reports.mis_escalation_funnel")}</option>
            </Select>
          </div>

          {misLoading ? (
            <p className="rpt-loading">{t("common.loading")}</p>
          ) : misData ? (
            <div className="rpt-table-wrap">
              <h3 className="rpt-mis-title">{misData.title}</h3>
              {misData.rows.length === 0 ? (
                <Alert variant="info">{t("reports.no_data")}</Alert>
              ) : (
                <table className="rpt-table">
                  <thead>
                    <tr>
                      {Object.keys(misData.rows[0]).map((key) => (
                        <th key={key}>{key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {misData.rows.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((val, j) => (
                          <td key={j} data-label={Object.keys(row)[j]?.replace(/_/g, " ")}>
                            {val === null || val === undefined ? "—" : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : null}
        </section>
      )}

      {/* ── AI Reports Tab ── */}
      {activeTab === "ai-reports" && (
        <section className="rpt-section">
          <div className="rpt-section__header">
            <h2>{t("reports.tab_ai_reports")}</h2>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem", margin: 0 }}>
              {t("report_gen.subtitle")}
            </p>
          </div>

          {/* Report type cards */}
          <div className="rg-type-cards">
            {AI_REPORT_TYPES.map((rt) => (
              <button
                key={rt.value}
                type="button"
                className={`rg-type-card ${aiReportType === rt.value ? "rg-type-card--selected" : ""}`}
                onClick={() => setAiReportType(rt.value)}
              >
                <span className="rg-type-card__icon" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d={rt.icon} />
                  </svg>
                </span>
                <span className="rg-type-card__label">{t(rt.labelKey)}</span>
                <span className="rg-type-card__desc">{t(rt.descKey)}</span>
              </button>
            ))}
          </div>

          {/* Case selector */}
          <div className="rg-case-select">
            <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 var(--space-2)" }}>{t("report_gen.select_case")}</h3>
            {aiCasesLoading ? (
              <p>{t("common.loading")}</p>
            ) : aiCases.length === 0 ? (
              <Alert variant="info">{t("report_gen.no_cases")}</Alert>
            ) : (
              <Select value={aiCaseId} onChange={(e) => setAiCaseId(e.target.value)}>
                <option value="">{t("report_gen.select_case_placeholder")}</option>
                {aiCases.map((c) => (
                  <option key={c.case_id} value={c.case_id}>
                    {c.case_number || c.case_id} — {c.title || "Untitled"}
                  </option>
                ))}
              </Select>
            )}
          </div>

          {/* Generate button */}
          <div style={{ marginBottom: "var(--space-4)" }}>
            <Button
              variant="primary"
              onClick={handleAiGenerate}
              disabled={!aiReportType || !aiCaseId || aiGenerating || isOffline}
            >
              {aiGenerating ? t("report_gen.generating") : aiMarkdown ? t("report_gen.regenerate") : t("report_gen.generate")}
            </Button>
          </div>

          {/* Error */}
          {aiError && <Alert variant="danger" style={{ marginBottom: "var(--space-4)" }}>{aiError}</Alert>}

          {/* Markdown preview */}
          {aiMarkdown && (
            <div className="rg-preview-section">
              <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 var(--space-2)" }}>{t("report_gen.preview")}</h3>
              {aiMeta && (
                <p style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", margin: "0 0 var(--space-3)" }}>
                  {aiMeta.provider}/{aiMeta.model} &middot; {(aiMeta.latencyMs / 1000).toFixed(1)}s
                </p>
              )}
              <div
                className="rg-preview-card"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(aiMarkdown) }}
              />
              <div className="rg-downloads">
                <Button variant="primary" onClick={handleAiDownloadPdf}>
                  {t("report_gen.download_pdf")}
                </Button>
                <Button variant="secondary" onClick={handleAiDownloadMd}>
                  {t("report_gen.download_md")}
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      <style>{`
        .rpt-hub { max-width: 82rem; margin: 0 auto; padding: var(--space-4); }
        .rpt-hub__header { margin-bottom: var(--space-4); }
        .rpt-hub__title { font-size: clamp(1.25rem, 2vw, 1.5rem); font-weight: 700; margin: 0; }
        .rpt-hub__subtitle { color: var(--color-text-secondary); margin: var(--space-1) 0 0; font-size: 0.875rem; }

        .rpt-tabs { display: flex; gap: var(--space-1); border-bottom: 2px solid var(--color-border); margin-bottom: var(--space-4); overflow-x: auto; }
        .rpt-tab {
          display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3);
          border: none; background: none; cursor: pointer; font-size: 0.875rem; font-weight: 500;
          color: var(--color-text-secondary); border-bottom: 2px solid transparent;
          margin-bottom: -2px; white-space: nowrap; min-height: 2.75rem;
          transition: color 0.15s, border-color 0.15s;
        }
        .rpt-tab:hover, .rpt-tab:active { color: var(--color-primary); }
        .rpt-tab--active { color: var(--color-primary); border-bottom-color: var(--color-primary); }

        .rpt-section__header {
          display: flex; justify-content: space-between; align-items: center;
          flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-3);
        }
        .rpt-section__header h2 { font-size: 1.125rem; font-weight: 600; margin: 0; }

        .rpt-create-form {
          background: var(--color-surface); border: 1px solid var(--color-border);
          border-radius: var(--radius-md); padding: var(--space-3); margin-bottom: var(--space-3);
          display: grid; gap: var(--space-3);
        }
        .rpt-create-form__field label { display: block; font-size: 0.8125rem; font-weight: 500; margin-bottom: var(--space-1); }
        .rpt-create-form__actions { display: flex; gap: var(--space-2); }

        .rpt-input {
          width: 100%; padding: var(--space-2); border: 1px solid var(--color-border);
          border-radius: var(--radius-sm); font-size: 1rem; background: var(--color-bg);
        }

        .rpt-table-wrap { overflow-x: auto; }
        .rpt-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
        .rpt-table th { text-align: left; padding: var(--space-2); border-bottom: 2px solid var(--color-border); font-weight: 600; white-space: nowrap; }
        .rpt-table td { padding: var(--space-2); border-bottom: 1px solid var(--color-border); }
        .rpt-table tbody tr:hover { background: var(--color-surface-hover, rgba(0,0,0,0.02)); }

        .rpt-badge {
          display: inline-block; padding: 0.125rem 0.5rem; border-radius: var(--radius-sm);
          font-size: 0.75rem; font-weight: 600; color: #fff;
        }

        .rpt-actions { display: flex; gap: var(--space-1); flex-wrap: wrap; }
        .rpt-loading { color: var(--color-text-secondary); font-style: italic; }

        .rpt-monthly-gen { display: flex; gap: var(--space-2); align-items: center; }
        .rpt-monthly-gen .rpt-input { width: auto; }

        .rpt-mis-selector { margin-bottom: var(--space-3); max-width: 20rem; }
        .rpt-mis-title { font-size: 1rem; font-weight: 600; margin: 0 0 var(--space-2); }

        .rpt-ecourt-section { margin-top: var(--space-5); padding-top: var(--space-4); border-top: 2px solid var(--color-border); }
        .rpt-ecourt-section__title { font-size: 1rem; font-weight: 600; margin: 0 0 var(--space-1); }
        .rpt-ecourt-section__desc { font-size: 0.8125rem; color: var(--color-text-secondary); margin: 0 0 var(--space-3); }
        .rpt-ecourt-form { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-3); margin-bottom: var(--space-3); }
        .rpt-ecourt-form__row { display: grid; grid-template-columns: 1fr 2fr auto; gap: var(--space-2); align-items: end; }
        .rpt-ecourt-form__field label { display: block; font-size: 0.8125rem; font-weight: 500; margin-bottom: var(--space-1); }
        .rpt-ecourt-form__action { padding-bottom: 1px; }

        .rg-type-cards { display: grid; gap: var(--space-3); grid-template-columns: 1fr; margin-bottom: var(--space-4); }
        @media (min-width: 48rem) { .rg-type-cards { grid-template-columns: repeat(3, 1fr); } }

        .rg-type-card {
          display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-2);
          padding: var(--space-4); border: 2px solid var(--color-border);
          border-radius: var(--radius-md); background: var(--color-surface);
          cursor: pointer; text-align: left; min-height: 2.75rem;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .rg-type-card:hover, .rg-type-card:active { border-color: var(--color-primary); }
        .rg-type-card--selected { border-color: var(--color-primary); background: var(--color-primary-subtle, var(--color-surface)); box-shadow: 0 0 0 1px var(--color-primary); }
        .rg-type-card__icon { color: var(--color-primary); }
        .rg-type-card__label { font-weight: 600; font-size: 0.9375rem; }
        .rg-type-card__desc { font-size: 0.8125rem; color: var(--color-text-secondary); line-height: 1.4; }

        .rg-case-select { margin-bottom: var(--space-4); max-width: 32rem; }

        .rg-preview-section { margin-bottom: var(--space-5); }
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
        .rg-preview-card table { width: 100%; border-collapse: collapse; margin: var(--space-3) 0; font-size: 0.875rem; }
        .rg-preview-card th, .rg-preview-card td { padding: var(--space-2); border: 1px solid var(--color-border); text-align: left; }
        .rg-preview-card th { background: var(--color-surface-raised, var(--color-surface)); font-weight: 600; }

        .rg-downloads { display: flex; gap: var(--space-3); margin-top: var(--space-4); flex-wrap: wrap; }

        @media (max-width: 48rem) {
          .rpt-section__header { flex-direction: column; align-items: stretch; }
          .rpt-monthly-gen { flex-direction: column; }
          .rpt-monthly-gen .rpt-input { width: 100%; }
          .rpt-ecourt-form__row { grid-template-columns: 1fr; }
          .rpt-table thead { display: none; }
          .rpt-table, .rpt-table tbody, .rpt-table tr, .rpt-table td { display: block; }
          .rpt-table tr { padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border); }
          .rpt-table td { padding: var(--space-1) 0; border: none; display: flex; justify-content: space-between; }
          .rpt-table td::before { content: attr(data-label); font-weight: 600; margin-right: var(--space-2); }
        }
      `}</style>
    </div>
  );
}
