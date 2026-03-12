import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Field, Input, Modal, Select, useToast } from "@puda/shared";
import { apiBaseUrl } from "../types";
import EmptyState from "../components/EmptyState";

type Props = { authHeaders: () => Record<string, string>; isOffline: boolean };

/* ── BRD-defined data sources (INT-001 – INT-011 from Section 6.1) ── */
type SourceDef = {
  id: string; name: string; descKey: string;
  connectorType: string; method: string; formats: string;
  icon: string; phase: 1 | 3;
};

const BRD_SOURCES: SourceDef[] = [
  { id: "cctns",   name: "CCTNS",   descKey: "ingestion.src_cctns_desc",   connectorType: "CCTNS",   method: "API / DB Replica", formats: "JSON, DB rows",   icon: "\u{1F4CB}", phase: 1 },
  { id: "cdat",    name: "C-DAT",   descKey: "ingestion.src_cdat_desc",    connectorType: "INTELLIGENCE", method: "API / File",  formats: "CSV, JSON",        icon: "\u{1F4DE}", phase: 1 },
  { id: "cdr",     name: "CDR",     descKey: "ingestion.src_cdr_desc",     connectorType: "INTELLIGENCE", method: "SFTP / API",  formats: "CSV, TSV, JSON",   icon: "\u{1F4F1}", phase: 1 },
  { id: "ipdr",    name: "IPDR",    descKey: "ingestion.src_ipdr_desc",    connectorType: "INTELLIGENCE", method: "SFTP / API",  formats: "CSV, JSON",        icon: "\u{1F310}", phase: 1 },
  { id: "fir",     name: "FIR Repository", descKey: "ingestion.src_fir_desc", connectorType: "CCTNS", method: "File / API",  formats: "PDF, DOCX, JSON",  icon: "\u{1F4C4}", phase: 1 },
  { id: "seizure", name: "Seizure Memos",  descKey: "ingestion.src_seizure_desc", connectorType: "NDPS", method: "Upload / API", formats: "PDF, JPG, DOCX", icon: "\u{1F6A8}", phase: 1 },
  { id: "ir",      name: "IR Repository",  descKey: "ingestion.src_ir_desc",  connectorType: "INTELLIGENCE", method: "File / API", formats: "PDF, DOCX, JSON", icon: "\u{1F575}", phase: 1 },
  { id: "esakshya", name: "eSakshya", descKey: "ingestion.src_esakshya_desc", connectorType: "INTELLIGENCE", method: "API / File Sync", formats: "JSON, PDF, Media", icon: "\u{1F4F7}", phase: 1 },
  { id: "ctrace",  name: "C-Trace (OSINT)", descKey: "ingestion.src_ctrace_desc", connectorType: "INTELLIGENCE", method: "API / Feed", formats: "JSON, CSV", icon: "\u{1F50D}", phase: 1 },
  { id: "gdrive",  name: "Google Drive (MR)", descKey: "ingestion.src_gdrive_desc", connectorType: "MANUAL", method: "OAuth / Service Acct", formats: "PDF, XLSX", icon: "\u{2601}", phase: 1 },
  { id: "ecourts", name: "E-Courts", descKey: "ingestion.src_ecourts_desc", connectorType: "ECOURTS", method: "Automation / API", formats: "HTML, PDF", icon: "\u{2696}", phase: 1 },
];

type ConnectorRow = {
  connector_id: string; connector_name: string; connector_type: string;
  is_active: boolean; last_poll_at: string | null;
  health_status: string; error_count: number; created_at: string;
};

type IngestionJob = {
  job_id: string; connector_id: string; job_type: string;
  state_id: string; total_records: number; processed_records: number;
  failed_records: number; error_message: string | null;
  started_at: string | null; completed_at: string | null; created_at: string;
};

type DlqItem = {
  id: string; connector_name: string; error_message: string;
  retry_count: number; created_at: string;
};

type Tab = "sources" | "jobs" | "upload" | "dead-letters";

function fmtDate(iso: string | null): string {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleString();
}

function healthLabel(status: string): string {
  const s = (status || "").toUpperCase();
  if (s === "HEALTHY") return "HEALTHY";
  if (s === "DEGRADED") return "DEGRADED";
  if (s === "DOWN" || s === "UNHEALTHY") return "DOWN";
  return "OFFLINE";
}

function healthDotClass(status: string): string {
  const s = (status || "").toUpperCase();
  if (s === "HEALTHY") return "source-card__dot--healthy";
  if (s === "DEGRADED") return "source-card__dot--degraded";
  if (s === "DOWN" || s === "UNHEALTHY") return "source-card__dot--down";
  return "source-card__dot--offline";
}

function jobDotClass(state: string): string {
  const s = (state || "").toUpperCase();
  if (s === "QUEUED") return "job-state__dot--queued";
  if (s === "IN_PROGRESS") return "job-state__dot--in_progress";
  if (s === "COMPLETED") return "job-state__dot--completed";
  if (s === "FAILED") return "job-state__dot--failed";
  if (s === "PARTIAL") return "job-state__dot--partial";
  return "job-state__dot--queued";
}

export default function IngestionHub({ authHeaders, isOffline }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("sources");
  const [error, setError] = useState("");

  // Connectors loaded from API — keyed by connector_type for source card matching
  const [connectors, setConnectors] = useState<ConnectorRow[]>([]);
  const [connLoading, setConnLoading] = useState(false);

  // Jobs
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [jobsPage, setJobsPage] = useState(0);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobFilter, setJobFilter] = useState("");

  // DLQ
  const [dlq, setDlq] = useState<DlqItem[]>([]);
  const [dlqTotal, setDlqTotal] = useState(0);
  const [dlqPage, setDlqPage] = useState(0);
  const [dlqLoading, setDlqLoading] = useState(false);

  // Upload
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadSource, setUploadSource] = useState("MANUAL");
  const [uploadDesc, setUploadDesc] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Create connector modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSource, setModalSource] = useState<SourceDef | null>(null);
  const [connForm, setConnForm] = useState({ connectorName: "", endpointUrl: "", pollInterval: "3600" });

  const PAGE_SIZE = 25;

  const loadConnectors = useCallback(() => {
    setConnLoading(true);
    fetch(`${apiBaseUrl}/api/v1/ingestion/connectors`, { credentials: "include", ...authHeaders() })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => setConnectors(d.connectors || []))
      .catch(() => setError(t("common.something_went_wrong")))
      .finally(() => setConnLoading(false));
  }, [authHeaders, t]);

  const loadJobs = useCallback(() => {
    setJobsLoading(true);
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(jobsPage * PAGE_SIZE) });
    if (jobFilter) params.set("state_id", jobFilter);
    fetch(`${apiBaseUrl}/api/v1/ingestion/jobs?${params}`, { credentials: "include", ...authHeaders() })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => { setJobs(d.jobs || []); setJobsTotal(d.total || 0); })
      .catch(() => setError(t("common.something_went_wrong")))
      .finally(() => setJobsLoading(false));
  }, [authHeaders, jobsPage, jobFilter, t]);

  const loadDlq = useCallback(() => {
    setDlqLoading(true);
    fetch(`${apiBaseUrl}/api/v1/ingestion/dead-letter?limit=${PAGE_SIZE}&offset=${dlqPage * PAGE_SIZE}`, { credentials: "include", ...authHeaders() })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => { setDlq(d.items || []); setDlqTotal(d.total || 0); })
      .catch(() => setError(t("common.something_went_wrong")))
      .finally(() => setDlqLoading(false));
  }, [authHeaders, dlqPage, t]);

  useEffect(() => {
    if (tab === "sources") loadConnectors();
    else if (tab === "jobs") loadJobs();
    else if (tab === "dead-letters") loadDlq();
  }, [tab, loadConnectors, loadJobs, loadDlq]);

  const getConnectorForSource = (src: SourceDef): ConnectorRow | undefined =>
    connectors.find((c) => c.connector_type === src.connectorType);

  /* ── Actions ── */
  const retryJob = async (id: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/ingestion/jobs/${id}/retry`, { method: "POST", credentials: "include", ...authHeaders() });
      if (!res.ok) throw new Error();
      showToast("success", t("ingestion.job_retried"));
      loadJobs();
    } catch { showToast("error", t("common.something_went_wrong")); }
  };

  const retryDlq = async (id: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/ingestion/dead-letter/${id}/retry`, { method: "POST", credentials: "include", ...authHeaders() });
      if (!res.ok) throw new Error();
      showToast("success", t("ingestion.dlq_retried"));
      loadDlq();
    } catch { showToast("error", t("common.something_went_wrong")); }
  };

  const openConfigureModal = (src: SourceDef) => {
    setModalSource(src);
    const existing = getConnectorForSource(src);
    setConnForm({
      connectorName: existing?.connector_name || src.name,
      endpointUrl: "",
      pollInterval: "3600",
    });
    setModalOpen(true);
  };

  const saveConnector = async () => {
    if (!modalSource) return;
    try {
      const body = {
        connectorName: connForm.connectorName || modalSource.name,
        connectorType: modalSource.connectorType,
        endpointUrl: connForm.endpointUrl || undefined,
        pollIntervalSeconds: parseInt(connForm.pollInterval, 10) || 3600,
        isActive: true,
      };
      const res = await fetch(`${apiBaseUrl}/api/v1/ingestion/connectors`, {
        method: "POST", credentials: "include",
        ...authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      showToast("success", t("ingestion.connector_created"));
      setModalOpen(false);
      loadConnectors();
    } catch { showToast("error", t("common.something_went_wrong")); }
  };

  const handleUpload = async () => {
    if (uploadFiles.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      for (const f of uploadFiles) formData.append("files", f);
      formData.append("sourceType", uploadSource);
      formData.append("description", uploadDesc || "Manual upload");

      const headers = authHeaders();
      // Remove Content-Type so browser sets multipart boundary
      const fetchHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase() !== "content-type") fetchHeaders[k] = v;
      }

      const res = await fetch(`${apiBaseUrl}/api/v1/ingestion/upload`, {
        method: "POST", credentials: "include", headers: fetchHeaders, body: formData,
      });
      if (!res.ok) throw new Error();
      showToast("success", t("ingestion.upload_success", { count: uploadFiles.length }));
      setUploadFiles([]);
      setUploadDesc("");
    } catch {
      showToast("error", t("ingestion.upload_failed"));
    } finally { setUploading(false); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) setUploadFiles((prev) => [...prev, ...files]);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "sources", label: t("ingestion.tab_sources") },
    { key: "jobs", label: t("ingestion.tab_jobs") },
    { key: "upload", label: t("ingestion.tab_upload") },
    { key: "dead-letters", label: t("ingestion.tab_dlq") },
  ];

  return (
    <div>
      <div className="ingestion-hub__header">
        <h1>{t("ingestion.title")}</h1>
        <p>{t("ingestion.subtitle")}</p>
      </div>

      {error && <Alert variant="error" style={{ marginBottom: "var(--space-3)" }}>{error}</Alert>}

      <div className="tab-bar" role="tablist">
        {tabs.map((tb) => (
          <button key={tb.key} role="tab" aria-selected={tab === tb.key}
            className={`tab-btn ${tab === tb.key ? "tab-btn--active" : ""}`}
            onClick={() => setTab(tb.key)} type="button">{tb.label}</button>
        ))}
      </div>

      {/* ── Sources Tab ── */}
      {tab === "sources" && (
        connLoading ? <div className="loading-center">{t("common.loading")}</div> :
        <div className="ingestion-sources">
          {BRD_SOURCES.map((src) => {
            const conn = getConnectorForSource(src);
            const status = conn ? healthLabel(conn.health_status) : "OFFLINE";
            return (
              <div className="source-card" key={src.id}>
                <div className="source-card__top">
                  <span className="source-card__icon">{src.icon}</span>
                  <span className="source-card__status">
                    <span className={`source-card__dot ${healthDotClass(conn?.health_status || "")}`} />
                    {status}
                  </span>
                </div>
                <p className="source-card__name">{src.name}</p>
                <p className="source-card__desc">{t(src.descKey)}</p>
                <div className="source-card__meta">
                  <span className="source-card__chip">{src.method}</span>
                  <span className="source-card__chip">{src.formats}</span>
                  {src.phase === 3 && <span className="source-card__chip">Phase 3</span>}
                </div>
                {conn ? (
                  <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>
                    {t("ingestion.last_polled")}: {fmtDate(conn.last_poll_at)}
                    {conn.error_count > 0 && <> &middot; {t("ingestion.errors")}: {conn.error_count}</>}
                  </div>
                ) : (
                  <Button size="sm" variant="secondary" disabled={isOffline} onClick={() => openConfigureModal(src)}
                    style={{ marginTop: "var(--space-1)", alignSelf: "flex-start" }}>
                    {t("ingestion.configure")}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Jobs Tab ── */}
      {tab === "jobs" && (
        <>
          <div className="filter-bar">
            <Field label={t("ingestion.filter_state")} htmlFor="job-filter">
              <Select id="job-filter" value={jobFilter} onChange={(e) => { setJobFilter(e.target.value); setJobsPage(0); }}>
                <option value="">{t("common.all")}</option>
                <option value="QUEUED">{t("ingestion.state_queued")}</option>
                <option value="IN_PROGRESS">{t("ingestion.state_in_progress")}</option>
                <option value="COMPLETED">{t("ingestion.state_completed")}</option>
                <option value="FAILED">{t("ingestion.state_failed")}</option>
                <option value="PARTIAL">{t("ingestion.state_partial")}</option>
              </Select>
            </Field>
          </div>
          {jobsLoading ? <div className="loading-center">{t("common.loading")}</div> :
          jobs.length === 0 ? <EmptyState title={t("ingestion.no_jobs")} /> :
          <>
            <div className="table-scroll">
              <table className="entity-table entity-table--compact">
                <thead>
                  <tr>
                    <th>{t("ingestion.job_id")}</th>
                    <th>{t("ingestion.job_type")}</th>
                    <th>{t("ingestion.state")}</th>
                    <th>{t("ingestion.records")}</th>
                    <th>{t("ingestion.started")}</th>
                    <th>{t("ingestion.completed")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.job_id}>
                      <td data-label={t("ingestion.job_id")} style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{j.job_id.slice(0, 8)}</td>
                      <td data-label={t("ingestion.job_type")}>{j.job_type || "\u2014"}</td>
                      <td data-label={t("ingestion.state")}>
                        <span className="job-state">
                          <span className={`job-state__dot ${jobDotClass(j.state_id)}`} />
                          {j.state_id}
                        </span>
                      </td>
                      <td data-label={t("ingestion.records")}>
                        {j.processed_records}/{j.total_records}
                        {j.failed_records > 0 && <span style={{ color: "var(--color-error)" }}> ({j.failed_records} failed)</span>}
                      </td>
                      <td data-label={t("ingestion.started")}>{fmtDate(j.started_at)}</td>
                      <td data-label={t("ingestion.completed")}>{fmtDate(j.completed_at)}</td>
                      <td>
                        {(j.state_id === "FAILED" || j.state_id === "PARTIAL") && (
                          <Button size="sm" variant="secondary" disabled={isOffline} onClick={() => retryJob(j.job_id)}>
                            {t("ingestion.retry")}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {jobsTotal > PAGE_SIZE && (
              <div className="pagination">
                <Button size="sm" variant="secondary" disabled={jobsPage === 0} onClick={() => setJobsPage((p) => p - 1)}>{t("audit.prev_page")}</Button>
                <span className="pagination__info">{t("audit.page_label", { page: jobsPage + 1 })}</span>
                <Button size="sm" variant="secondary" disabled={(jobsPage + 1) * PAGE_SIZE >= jobsTotal} onClick={() => setJobsPage((p) => p + 1)}>{t("audit.next_page")}</Button>
              </div>
            )}
          </>}
        </>
      )}

      {/* ── Upload Tab ── */}
      {tab === "upload" && (
        <div style={{ display: "grid", gap: "var(--space-4)", maxWidth: "36rem" }}>
          <Field label={t("ingestion.upload_source")} htmlFor="upload-src">
            <Select id="upload-src" value={uploadSource} onChange={(e) => setUploadSource(e.target.value)}>
              <option value="MANUAL">{t("ingestion.source_manual")}</option>
              <option value="CCTNS">CCTNS</option>
              <option value="NDPS">NDPS</option>
              <option value="ECOURTS">E-Courts</option>
              <option value="INTELLIGENCE">{t("ingestion.source_intelligence")}</option>
            </Select>
          </Field>
          <Field label={t("ingestion.upload_desc")} htmlFor="upload-desc">
            <Input id="upload-desc" value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)}
              placeholder={t("ingestion.upload_desc_placeholder")} />
          </Field>

          <div
            className={`upload-dropzone ${dragActive ? "upload-dropzone--active" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <span className="upload-dropzone__icon">{"\u{1F4C1}"}</span>
            <span className="upload-dropzone__text">{t("ingestion.drop_files")}</span>
            <span className="upload-dropzone__formats">{t("ingestion.supported_formats")}</span>
            <input ref={fileInputRef} type="file" multiple hidden accept=".pdf,.jpg,.jpeg,.png,.tiff,.docx,.xlsx,.csv,.json,.xml,.zip"
              onChange={(e) => { if (e.target.files) setUploadFiles((prev) => [...prev, ...Array.from(e.target.files!)]); }} />
          </div>

          {uploadFiles.length > 0 && (
            <div>
              <p style={{ fontWeight: 600, marginBottom: "var(--space-2)" }}>
                {t("ingestion.selected_files", { count: uploadFiles.length })}
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "var(--space-1)" }}>
                {uploadFiles.map((f, i) => (
                  <li key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", padding: "var(--space-1) var(--space-2)", background: "var(--color-bg-elevated)", borderRadius: "var(--radius-sm)" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    <button type="button" onClick={() => setUploadFiles((prev) => prev.filter((_, j) => j !== i))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-error)", fontWeight: 700, minWidth: "2rem", minHeight: "2rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                      aria-label={t("common.remove")}>&times;</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button disabled={isOffline || uploading || uploadFiles.length === 0} onClick={handleUpload}>
            {uploading ? t("ingestion.uploading") : t("ingestion.upload_btn")}
          </Button>
        </div>
      )}

      {/* ── Dead Letters Tab ── */}
      {tab === "dead-letters" && (
        dlqLoading ? <div className="loading-center">{t("common.loading")}</div> :
        dlq.length === 0 ? <EmptyState title={t("ingestion.no_dlq")} /> :
        <>
          <div className="table-scroll">
            <table className="entity-table entity-table--compact">
              <thead>
                <tr>
                  <th>{t("ingestion.dlq_id")}</th>
                  <th>{t("ingestion.connector")}</th>
                  <th>{t("ingestion.error")}</th>
                  <th>{t("ingestion.retries")}</th>
                  <th>{t("ingestion.created")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {dlq.map((d) => (
                  <tr key={d.id}>
                    <td data-label={t("ingestion.dlq_id")} style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{d.id.slice(0, 8)}</td>
                    <td data-label={t("ingestion.connector")}>{d.connector_name || "\u2014"}</td>
                    <td data-label={t("ingestion.error")} style={{ maxWidth: "20rem", overflow: "hidden", textOverflow: "ellipsis" }}>{d.error_message}</td>
                    <td data-label={t("ingestion.retries")}>{d.retry_count}</td>
                    <td data-label={t("ingestion.created")}>{fmtDate(d.created_at)}</td>
                    <td>
                      <Button size="sm" variant="secondary" disabled={isOffline} onClick={() => retryDlq(d.id)}>
                        {t("ingestion.retry")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {dlqTotal > PAGE_SIZE && (
            <div className="pagination">
              <Button size="sm" variant="secondary" disabled={dlqPage === 0} onClick={() => setDlqPage((p) => p - 1)}>{t("audit.prev_page")}</Button>
              <span className="pagination__info">{t("audit.page_label", { page: dlqPage + 1 })}</span>
              <Button size="sm" variant="secondary" disabled={(dlqPage + 1) * PAGE_SIZE >= dlqTotal} onClick={() => setDlqPage((p) => p + 1)}>{t("audit.next_page")}</Button>
            </div>
          )}
        </>
      )}

      {/* ── Configure Connector Modal ── */}
      <Modal open={modalOpen} title={t("ingestion.configure_source", { name: modalSource?.name || "" })} onClose={() => setModalOpen(false)} actions={
        <>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>{t("common.cancel")}</Button>
          <Button disabled={isOffline} onClick={saveConnector}>{t("common.save")}</Button>
        </>
      }>
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <Field label={t("ingestion.connector_name")} htmlFor="conn-name">
            <Input id="conn-name" value={connForm.connectorName} onChange={(e) => setConnForm((f) => ({ ...f, connectorName: e.target.value }))} />
          </Field>
          <Field label={t("ingestion.endpoint_url")} htmlFor="conn-url">
            <Input id="conn-url" value={connForm.endpointUrl} onChange={(e) => setConnForm((f) => ({ ...f, endpointUrl: e.target.value }))}
              placeholder="https://..." />
          </Field>
          <Field label={t("ingestion.poll_interval")} htmlFor="conn-poll">
            <Input id="conn-poll" type="number" value={connForm.pollInterval} onChange={(e) => setConnForm((f) => ({ ...f, pollInterval: e.target.value }))} />
          </Field>
          {modalSource && (
            <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", background: "var(--color-bg-elevated)", borderRadius: "var(--radius-sm)", padding: "var(--space-2) var(--space-3)" }}>
              <strong>{t("ingestion.connector_type")}:</strong> {modalSource.connectorType}<br />
              <strong>{t("ingestion.method")}:</strong> {modalSource.method}<br />
              <strong>{t("ingestion.formats")}:</strong> {modalSource.formats}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
