import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, Button, Alert, Badge, SkeletonBlock, useToast } from "@puda/shared";
import { apiBaseUrl } from "../types";
import type { LlmProviderConfig, LlmSystemPrompt, LlmPredictionLog } from "../types";

type Model = {
  model_id: string;
  name: string;
  version: string;
  status: string;
  accuracy?: number;
  last_evaluated_at?: string;
  created_at: string;
};

type Tab = "providers" | "models" | "prompts" | "predictions";

type Props = {
  authHeaders: () => Record<string, string>;
  isOffline: boolean;
};

const PROVIDER_DEFAULTS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  claude: "https://api.anthropic.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  ollama: "http://localhost:11434",
};

export default function ModelAdmin({ authHeaders, isOffline }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("providers");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ── Provider state ─────────────────────────────────────────────────────
  const [providers, setProviders] = useState<LlmProviderConfig[]>([]);
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [newProvider, setNewProvider] = useState({
    provider: "openai",
    display_name: "",
    api_base_url: PROVIDER_DEFAULTS.openai,
    api_key_enc: "",
    model_id: "",
    max_tokens: 2048,
    temperature: 0.3,
    timeout_ms: 30000,
  });
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; latencyMs?: number; error?: string }>>({});

  // ── Models state ───────────────────────────────────────────────────────
  const [models, setModels] = useState<Model[]>([]);

  // ── Prompts state ──────────────────────────────────────────────────────
  const [prompts, setPrompts] = useState<LlmSystemPrompt[]>([]);
  const [editingPrompt, setEditingPrompt] = useState<LlmSystemPrompt | null>(null);

  // ── Predictions state ──────────────────────────────────────────────────
  const [predictions, setPredictions] = useState<LlmPredictionLog[]>([]);
  const [predTotal, setPredTotal] = useState(0);
  const [predPage, setPredPage] = useState(1);
  const [predFilter, setPredFilter] = useState({ use_case: "", provider: "" });

  // ── Fetchers ───────────────────────────────────────────────────────────

  const fetchProviders = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/llm/providers`, authHeaders());
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
      }
    } catch { setError(t("common.error")); }
  };

  const fetchModels = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/models`, authHeaders());
      if (res.ok) {
        const data = await res.json();
        setModels(data.models || data || []);
      }
    } catch { /* ignore */ }
  };

  const fetchPrompts = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/llm/prompts`, authHeaders());
      if (res.ok) {
        const data = await res.json();
        setPrompts(data.prompts || []);
      }
    } catch { /* ignore */ }
  };

  const fetchPredictions = async () => {
    const params = new URLSearchParams({ page: String(predPage), limit: "20" });
    if (predFilter.use_case) params.set("use_case", predFilter.use_case);
    if (predFilter.provider) params.set("provider", predFilter.provider);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/llm/predictions?${params}`, authHeaders());
      if (res.ok) {
        const data = await res.json();
        setPredictions(data.predictions || []);
        setPredTotal(data.total || 0);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (isOffline) { setLoading(false); return; }
    Promise.all([fetchProviders(), fetchModels()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isOffline) return;
    if (tab === "prompts") fetchPrompts();
    if (tab === "predictions") fetchPredictions();
  }, [tab, predPage, predFilter.use_case, predFilter.provider]);

  // ── Provider actions ───────────────────────────────────────────────────

  const handleAddProvider = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/llm/providers`, {
        ...authHeaders(),
        method: "POST",
        body: JSON.stringify(newProvider),
      });
      if (res.ok) {
        showToast("success", t("llm.provider_created"));
        setShowAddProvider(false);
        setNewProvider({ provider: "openai", display_name: "", api_base_url: PROVIDER_DEFAULTS.openai, api_key_enc: "", model_id: "", max_tokens: 2048, temperature: 0.3, timeout_ms: 30000 });
        fetchProviders();
      } else {
        showToast("error", t("common.error"));
      }
    } catch { showToast("error", t("common.error")); }
  };

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/llm/providers/${id}/test`, {
        ...authHeaders(),
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setTestResult((prev) => ({ ...prev, [id]: data }));
      }
    } catch {
      setTestResult((prev) => ({ ...prev, [id]: { success: false, error: "Request failed" } }));
    }
    setTestingId(null);
  };

  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/llm/providers/${id}/activate`, {
        ...authHeaders(),
        method: "POST",
      });
      if (res.ok) {
        showToast("success", t("llm.provider_activated"));
        fetchProviders();
      }
    } catch { showToast("error", t("common.error")); }
  };

  const handleDeleteProvider = async (id: string) => {
    try {
      await fetch(`${apiBaseUrl}/api/v1/llm/providers/${id}`, {
        ...authHeaders(),
        method: "DELETE",
      });
      showToast("success", t("llm.provider_deactivated"));
      fetchProviders();
    } catch { showToast("error", t("common.error")); }
  };

  // ── Model actions ──────────────────────────────────────────────────────

  const handleStatusChange = async (modelId: string, newStatus: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/models/${modelId}/status`, {
        ...authHeaders(),
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        showToast("success", t("models.status_updated"));
        fetchModels();
      } else { showToast("error", t("common.error")); }
    } catch { showToast("error", t("common.error")); }
  };

  // ── Prompt actions ─────────────────────────────────────────────────────

  const handleSavePrompt = async () => {
    if (!editingPrompt) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/llm/prompts/${editingPrompt.prompt_id}`, {
        ...authHeaders(),
        method: "PATCH",
        body: JSON.stringify({ prompt_text: editingPrompt.prompt_text }),
      });
      if (res.ok) {
        showToast("success", t("llm.prompt_saved"));
        setEditingPrompt(null);
        fetchPrompts();
      }
    } catch { showToast("error", t("common.error")); }
  };

  const handleNewVersion = async (p: LlmSystemPrompt) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/llm/prompts`, {
        ...authHeaders(),
        method: "POST",
        body: JSON.stringify({ use_case: p.use_case, prompt_text: p.prompt_text, is_active: true }),
      });
      if (res.ok) {
        showToast("success", t("llm.prompt_version_created"));
        fetchPrompts();
      }
    } catch { showToast("error", t("common.error")); }
  };

  // ── Helpers ────────────────────────────────────────────────────────────

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

  // ── Grouped prompts by use_case ────────────────────────────────────────
  const promptsByCase: Record<string, LlmSystemPrompt[]> = {};
  for (const p of prompts) {
    if (!promptsByCase[p.use_case]) promptsByCase[p.use_case] = [];
    promptsByCase[p.use_case].push(p);
  }

  return (
    <div>
      <div className="page__header">
        <h1>{t("models.title")}</h1>
        <p className="subtitle">{t("models.subtitle")}</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Tab Bar */}
      <div className="tab-bar" role="tablist" style={{ display: "flex", gap: "var(--space-1)", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
        {(["providers", "models", "prompts", "predictions"] as Tab[]).map((t2) => (
          <button
            key={t2}
            role="tab"
            aria-selected={tab === t2}
            className={`tab-btn ${tab === t2 ? "tab-btn--active" : ""}`}
            onClick={() => setTab(t2)}
          >
            {t(`llm.tab_${t2}`)}
          </button>
        ))}
      </div>

      {/* ── Tab 1: LLM Providers ──────────────────────────────────────── */}
      {tab === "providers" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-3)" }}>
            <Button variant="primary" onClick={() => setShowAddProvider(!showAddProvider)} disabled={isOffline}>
              {t("llm.add_provider")}
            </Button>
          </div>

          {showAddProvider && (
            <Card style={{ marginBottom: "var(--space-4)" }}>
              <div className="form-grid">
                <div className="form-field">
                  <label>{t("llm.provider")}</label>
                  <select
                    value={newProvider.provider}
                    onChange={(e) => {
                      const p = e.target.value;
                      setNewProvider((prev) => ({ ...prev, provider: p, api_base_url: PROVIDER_DEFAULTS[p] || "" }));
                    }}
                  >
                    <option value="openai">OpenAI</option>
                    <option value="claude">Claude</option>
                    <option value="gemini">Gemini</option>
                    <option value="ollama">Ollama</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>{t("llm.display_name")}</label>
                  <input value={newProvider.display_name} onChange={(e) => setNewProvider((prev) => ({ ...prev, display_name: e.target.value }))} placeholder={t("llm.display_name_placeholder")} />
                </div>
                <div className="form-field">
                  <label>{t("llm.api_base_url")}</label>
                  <input value={newProvider.api_base_url} onChange={(e) => setNewProvider((prev) => ({ ...prev, api_base_url: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label>{t("llm.api_key")}</label>
                  <input type="password" value={newProvider.api_key_enc} onChange={(e) => setNewProvider((prev) => ({ ...prev, api_key_enc: e.target.value }))} placeholder={t("llm.api_key_placeholder")} />
                </div>
                <div className="form-field">
                  <label>{t("llm.model_id")}</label>
                  <input value={newProvider.model_id} onChange={(e) => setNewProvider((prev) => ({ ...prev, model_id: e.target.value }))} placeholder="gpt-4o, claude-sonnet-4-6, etc." />
                </div>
                <div className="form-field">
                  <label>{t("llm.temperature")}</label>
                  <input type="number" step="0.1" min="0" max="2" value={newProvider.temperature} onChange={(e) => setNewProvider((prev) => ({ ...prev, temperature: parseFloat(e.target.value) || 0.3 }))} />
                </div>
                <div className="form-field">
                  <label>{t("llm.max_tokens")}</label>
                  <input type="number" value={newProvider.max_tokens} onChange={(e) => setNewProvider((prev) => ({ ...prev, max_tokens: parseInt(e.target.value, 10) || 2048 }))} />
                </div>
                <div className="form-field">
                  <label>{t("llm.timeout_ms")}</label>
                  <input type="number" value={newProvider.timeout_ms} onChange={(e) => setNewProvider((prev) => ({ ...prev, timeout_ms: parseInt(e.target.value, 10) || 30000 }))} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)", justifyContent: "flex-end" }}>
                <Button variant="secondary" onClick={() => setShowAddProvider(false)}>{t("common.cancel")}</Button>
                <Button variant="primary" onClick={handleAddProvider} disabled={!newProvider.display_name || !newProvider.model_id}>{t("common.create")}</Button>
              </div>
            </Card>
          )}

          {providers.length > 0 ? (
            <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>{t("llm.provider")}</th>
                  <th>{t("llm.display_name")}</th>
                  <th>{t("llm.model_id")}</th>
                  <th>{t("models.status")}</th>
                  <th>{t("llm.connection")}</th>
                  <th>{t("models.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr key={p.config_id}>
                    <td data-label={t("llm.provider")}>{p.provider.toUpperCase()}</td>
                    <td data-label={t("llm.display_name")}>{p.display_name}</td>
                    <td data-label={t("llm.model_id")}><code>{p.model_id}</code></td>
                    <td data-label={t("models.status")}>
                      <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap" }}>
                        {p.is_active && <Badge variant="success">{t("llm.active")}</Badge>}
                        {!p.is_active && <Badge variant="danger">{t("llm.inactive")}</Badge>}
                        {p.is_default && <Badge variant="info">{t("llm.default")}</Badge>}
                      </div>
                    </td>
                    <td data-label={t("llm.connection")}>
                      {testResult[p.config_id] ? (
                        testResult[p.config_id].success
                          ? <Badge variant="success">{t("llm.connected")} ({testResult[p.config_id].latencyMs}ms)</Badge>
                          : <Badge variant="danger">{t("llm.failed")}</Badge>
                      ) : "\u2014"}
                    </td>
                    <td data-label={t("models.actions")}>
                      <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap" }}>
                        <Button variant="secondary" size="sm" onClick={() => handleTestConnection(p.config_id)} disabled={isOffline || testingId === p.config_id}>
                          {testingId === p.config_id ? t("llm.testing") : t("llm.test")}
                        </Button>
                        {!p.is_default && p.is_active && (
                          <Button variant="secondary" size="sm" onClick={() => handleSetDefault(p.config_id)} disabled={isOffline}>
                            {t("llm.set_default")}
                          </Button>
                        )}
                        {p.is_active && (
                          <Button variant="secondary" size="sm" onClick={() => handleDeleteProvider(p.config_id)} disabled={isOffline}>
                            {t("llm.deactivate")}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : (
            <Card><p style={{ color: "var(--color-text-secondary)", textAlign: "center" }}>{t("llm.no_providers")}</p></Card>
          )}
        </div>
      )}

      {/* ── Tab 2: Models (existing) ──────────────────────────────────── */}
      {tab === "models" && (
        <div>
          {models.length > 0 ? (
            <div className="table-scroll">
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
            </div>
          ) : (
            <Card><p style={{ color: "var(--color-text-secondary)", textAlign: "center" }}>{t("models.no_models")}</p></Card>
          )}
        </div>
      )}

      {/* ── Tab 3: System Prompts ─────────────────────────────────────── */}
      {tab === "prompts" && (
        <div>
          {Object.entries(promptsByCase).map(([useCase, versions]) => (
            <Card key={useCase} style={{ marginBottom: "var(--space-3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
                <h3 style={{ margin: 0 }}>{useCase.replace(/_/g, " ")}</h3>
                <div style={{ display: "flex", gap: "var(--space-1)", alignItems: "center" }}>
                  <Badge variant="neutral">v{versions[0]?.version}</Badge>
                  {versions[0]?.is_active && <Badge variant="success">{t("llm.active")}</Badge>}
                </div>
              </div>

              {editingPrompt?.prompt_id === versions[0]?.prompt_id ? (
                <div>
                  <textarea
                    className="form-textarea"
                    rows={8}
                    value={editingPrompt.prompt_text}
                    onChange={(e) => setEditingPrompt({ ...editingPrompt, prompt_text: e.target.value })}
                    style={{ width: "100%", fontFamily: "monospace", fontSize: "0.875rem" }}
                  />
                  <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)", justifyContent: "flex-end" }}>
                    <Button variant="secondary" size="sm" onClick={() => setEditingPrompt(null)}>{t("common.cancel")}</Button>
                    <Button variant="primary" size="sm" onClick={handleSavePrompt} disabled={isOffline}>{t("common.save")}</Button>
                  </div>
                </div>
              ) : (
                <div>
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.8125rem", color: "var(--color-text-secondary)", maxHeight: "8rem", overflow: "hidden", marginBottom: "var(--space-2)" }}>
                    {versions[0]?.prompt_text?.slice(0, 300)}{(versions[0]?.prompt_text?.length || 0) > 300 ? "..." : ""}
                  </pre>
                  <div style={{ display: "flex", gap: "var(--space-1)" }}>
                    <Button variant="secondary" size="sm" onClick={() => setEditingPrompt({ ...versions[0] })} disabled={isOffline}>
                      {t("llm.edit_prompt")}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => handleNewVersion(versions[0])} disabled={isOffline}>
                      {t("llm.new_version")}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
          {prompts.length === 0 && (
            <Card><p style={{ color: "var(--color-text-secondary)", textAlign: "center" }}>{t("llm.no_prompts")}</p></Card>
          )}
        </div>
      )}

      {/* ── Tab 4: Prediction Log ─────────────────────────────────────── */}
      {tab === "predictions" && (
        <div>
          <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)", flexWrap: "wrap" }}>
            <select value={predFilter.use_case} onChange={(e) => { setPredFilter((f) => ({ ...f, use_case: e.target.value })); setPredPage(1); }}>
              <option value="">{t("llm.all_use_cases")}</option>
              <option value="CLASSIFICATION">CLASSIFICATION</option>
              <option value="TRANSLATION">TRANSLATION</option>
              <option value="NARCOTICS_ANALYSIS">NARCOTICS_ANALYSIS</option>
              <option value="RISK_NARRATIVE">RISK_NARRATIVE</option>
              <option value="INVESTIGATION_SUMMARY">INVESTIGATION_SUMMARY</option>
            </select>
            <select value={predFilter.provider} onChange={(e) => { setPredFilter((f) => ({ ...f, provider: e.target.value })); setPredPage(1); }}>
              <option value="">{t("llm.all_providers")}</option>
              <option value="openai">OpenAI</option>
              <option value="claude">Claude</option>
              <option value="gemini">Gemini</option>
              <option value="ollama">Ollama</option>
            </select>
          </div>

          {predictions.length > 0 ? (
            <>
              <div className="table-scroll">
              <table className="entity-table">
                <thead>
                  <tr>
                    <th>{t("llm.timestamp")}</th>
                    <th>{t("llm.use_case")}</th>
                    <th>{t("llm.provider")}</th>
                    <th>{t("llm.model_id")}</th>
                    <th>{t("llm.latency")}</th>
                    <th>{t("llm.tokens")}</th>
                    <th>{t("llm.fallback")}</th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.map((p) => (
                    <tr key={p.log_id}>
                      <td data-label={t("llm.timestamp")}>{new Date(p.created_at).toLocaleString()}</td>
                      <td data-label={t("llm.use_case")}><Badge variant="neutral">{p.use_case || "\u2014"}</Badge></td>
                      <td data-label={t("llm.provider")}>{p.provider || "\u2014"}</td>
                      <td data-label={t("llm.model_id")}><code>{p.model_name || "\u2014"}</code></td>
                      <td data-label={t("llm.latency")}>{p.latency_ms != null ? `${p.latency_ms}ms` : "\u2014"}</td>
                      <td data-label={t("llm.tokens")}>{(p.prompt_tokens || 0) + (p.output_tokens || 0) || "\u2014"}</td>
                      <td data-label={t("llm.fallback")}>{p.fallback_used ? <Badge variant="warning">{t("common.yes")}</Badge> : <Badge variant="success">{t("common.no")}</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--space-3)" }}>
                <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                  {t("slang.page_info", { from: (predPage - 1) * 20 + 1, to: Math.min(predPage * 20, predTotal), total: predTotal })}
                </span>
                <div style={{ display: "flex", gap: "var(--space-1)" }}>
                  <Button variant="secondary" size="sm" onClick={() => setPredPage((p) => Math.max(1, p - 1))} disabled={predPage <= 1}>
                    {t("audit.prev_page")}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setPredPage((p) => p + 1)} disabled={predPage * 20 >= predTotal}>
                    {t("audit.next_page")}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <Card><p style={{ color: "var(--color-text-secondary)", textAlign: "center" }}>{t("llm.no_predictions")}</p></Card>
          )}
        </div>
      )}
    </div>
  );
}
