/**
 * AssistantAdmin — Admin panel for NL Assistant configuration.
 * Feature toggles, LLM provider config, and system prompt management.
 */

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, SkeletonBlock } from "@puda/shared";
import { apiBaseUrl } from "./types";

interface FeatureFlag {
  flag_key: string;
  enabled: boolean;
  description: string | null;
  updated_at: string;
}

interface LlmProviderRow {
  config_id: string;
  provider: string;
  display_name: string;
  api_base_url: string;
  model_id: string;
  is_active: boolean;
  is_default: boolean;
  max_tokens: number;
  temperature: number;
  timeout_ms: number;
  max_retries: number;
}

interface SystemPrompt {
  prompt_id: string;
  use_case: string;
  prompt_text: string;
  version: number;
  is_active: boolean;
}

interface Props {
  authHeaders: Record<string, string>;
}

export default function AssistantAdmin({ authHeaders }: Props) {
  const { t } = useTranslation();
  const [features, setFeatures] = useState<FeatureFlag[]>([]);
  const [providers, setProviders] = useState<LlmProviderRow[]>([]);
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs: number; error?: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  // New provider form
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [newProvider, setNewProvider] = useState({
    provider: "openai", displayName: "", apiBaseUrl: "https://api.openai.com/v1",
    apiKeyEnc: "", modelId: "gpt-4o", isDefault: false,
  });
  const [addingProvider, setAddingProvider] = useState(false);

  // Prompt edit
  const [editPrompt, setEditPrompt] = useState<{ useCase: string; text: string } | null>(null);
  const [savingPrompt, setSavingPrompt] = useState(false);

  const headers = { ...authHeaders, "Content-Type": "application/json" };

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [featRes, provRes, promptRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/v1/config/features`, { headers: authHeaders }),
        fetch(`${apiBaseUrl}/api/v1/config/llm/providers`, { headers: authHeaders }),
        fetch(`${apiBaseUrl}/api/v1/config/llm/prompts`, { headers: authHeaders }),
      ]);

      if (featRes.ok) {
        const data = await featRes.json();
        setFeatures(data.features || []);
      }
      if (provRes.ok) {
        const data = await provRes.json();
        setProviders(data.providers || []);
      }
      if (promptRes.ok) {
        const data = await promptRes.json();
        setPrompts(data.prompts || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load configuration");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const toggleFeature = async (flagKey: string, enabled: boolean) => {
    try {
      await fetch(`${apiBaseUrl}/api/v1/config/features/${flagKey}`, {
        method: "PUT", headers, body: JSON.stringify({ enabled }),
      });
      setFeatures((prev) => prev.map((f) => f.flag_key === flagKey ? { ...f, enabled } : f));
    } catch {
      setError("Failed to update feature flag");
    }
  };

  const testProviderConnection = async (provider: LlmProviderRow) => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/config/llm/test`, {
        method: "POST", headers,
        body: JSON.stringify({
          provider: provider.provider, apiBaseUrl: provider.api_base_url,
          modelId: provider.model_id, timeoutMs: provider.timeout_ms,
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, latencyMs: 0, error: "Request failed" });
    } finally {
      setTestLoading(false);
    }
  };

  const addProvider = async () => {
    setAddingProvider(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/config/llm/providers`, {
        method: "POST", headers, body: JSON.stringify(newProvider),
      });
      if (res.ok) {
        setShowAddProvider(false);
        setNewProvider({ provider: "openai", displayName: "", apiBaseUrl: "https://api.openai.com/v1", apiKeyEnc: "", modelId: "gpt-4o", isDefault: false });
        loadAll();
      } else {
        const err = await res.json().catch(() => ({ message: "Failed" }));
        setError(err.message);
      }
    } catch {
      setError("Failed to add provider");
    } finally {
      setAddingProvider(false);
    }
  };

  const savePrompt = async () => {
    if (!editPrompt) return;
    setSavingPrompt(true);
    try {
      await fetch(`${apiBaseUrl}/api/v1/config/llm/prompts`, {
        method: "PUT", headers,
        body: JSON.stringify({ useCase: editPrompt.useCase, promptText: editPrompt.text }),
      });
      setEditPrompt(null);
      loadAll();
    } catch {
      setError("Failed to save prompt");
    } finally {
      setSavingPrompt(false);
    }
  };

  if (loading) return <SkeletonBlock height="12rem" />;

  return (
    <div className="assistant-admin">
      <h2>{t("assistant.title")} Configuration</h2>
      {error && <Alert variant="error">{error}</Alert>}

      {/* Feature Toggles */}
      <section className="panel" style={{ marginBottom: "var(--space-4)" }}>
        <h3>Feature Toggles</h3>
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          {features.filter((f) => f.flag_key === "nl_query" || f.flag_key === "page_agent").map((feature) => (
            <label key={feature.flag_key} className="toggle-row" style={{
              display: "flex", alignItems: "center", gap: "var(--space-3)",
              padding: "var(--space-3)", background: "var(--color-surface-alt, #f9fafb)",
              borderRadius: "var(--radius-md)", minHeight: "2.75rem",
            }}>
              <input
                type="checkbox"
                checked={feature.enabled}
                onChange={(e) => toggleFeature(feature.flag_key, e.target.checked)}
                style={{ width: "1.25rem", height: "1.25rem" }}
              />
              <div>
                <strong>{feature.flag_key}</strong>
                {feature.description && <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>{feature.description}</div>}
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* LLM Provider Config */}
      <section className="panel" style={{ marginBottom: "var(--space-4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
          <h3 style={{ margin: 0 }}>LLM Providers</h3>
          <Button variant="secondary" size="sm" onClick={() => setShowAddProvider(!showAddProvider)}>
            {showAddProvider ? "Cancel" : "Add Provider"}
          </Button>
        </div>

        {showAddProvider && (
          <div className="panel" style={{ marginBottom: "var(--space-3)", padding: "var(--space-3)", border: "1px solid var(--color-border)" }}>
            <div style={{ display: "grid", gap: "var(--space-2)" }}>
              <label style={{ display: "grid", gap: "0.25rem" }}>
                Provider
                <select value={newProvider.provider} onChange={(e) => setNewProvider({ ...newProvider, provider: e.target.value })} style={{ minHeight: "2.75rem", fontSize: "1rem", padding: "var(--space-2)" }}>
                  <option value="openai">OpenAI</option>
                  <option value="claude">Claude</option>
                  <option value="gemini">Gemini</option>
                  <option value="ollama">Ollama</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: "0.25rem" }}>
                Display Name
                <input type="text" value={newProvider.displayName} onChange={(e) => setNewProvider({ ...newProvider, displayName: e.target.value })} placeholder="My OpenAI" style={{ minHeight: "2.75rem", fontSize: "1rem", padding: "var(--space-2)" }} />
              </label>
              <label style={{ display: "grid", gap: "0.25rem" }}>
                API Base URL
                <input type="text" value={newProvider.apiBaseUrl} onChange={(e) => setNewProvider({ ...newProvider, apiBaseUrl: e.target.value })} style={{ minHeight: "2.75rem", fontSize: "1rem", padding: "var(--space-2)" }} />
              </label>
              <label style={{ display: "grid", gap: "0.25rem" }}>
                API Key
                <input type="password" value={newProvider.apiKeyEnc} onChange={(e) => setNewProvider({ ...newProvider, apiKeyEnc: e.target.value })} placeholder="sk-..." style={{ minHeight: "2.75rem", fontSize: "1rem", padding: "var(--space-2)" }} />
              </label>
              <label style={{ display: "grid", gap: "0.25rem" }}>
                Model ID
                <input type="text" value={newProvider.modelId} onChange={(e) => setNewProvider({ ...newProvider, modelId: e.target.value })} style={{ minHeight: "2.75rem", fontSize: "1rem", padding: "var(--space-2)" }} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", minHeight: "2.75rem" }}>
                <input type="checkbox" checked={newProvider.isDefault} onChange={(e) => setNewProvider({ ...newProvider, isDefault: e.target.checked })} />
                Set as default
              </label>
              <Button variant="primary" onClick={addProvider} disabled={addingProvider || !newProvider.displayName || !newProvider.modelId}>
                {addingProvider ? "Adding..." : "Add Provider"}
              </Button>
            </div>
          </div>
        )}

        {providers.length === 0 ? (
          <p style={{ color: "var(--color-text-secondary)" }}>No providers configured. Using environment variable fallback.</p>
        ) : (
          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            {providers.map((p) => (
              <div key={p.config_id} className="panel" style={{
                padding: "var(--space-3)", border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{p.display_name}</strong>
                    {p.is_default && <span style={{ marginLeft: "var(--space-2)", fontSize: "0.75rem", background: "var(--color-brand-light)", color: "var(--color-brand)", padding: "0.125rem 0.5rem", borderRadius: "var(--radius-sm)" }}>Default</span>}
                    <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
                      {p.provider} / {p.model_id} — {p.is_active ? "Active" : "Inactive"}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => testProviderConnection(p)} disabled={testLoading}>
                    {testLoading ? "Testing..." : "Test"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {testResult && (
          <Alert variant={testResult.success ? "success" : "error"} style={{ marginTop: "var(--space-2)" }}>
            {testResult.success
              ? `Connection successful (${testResult.latencyMs}ms)`
              : `Connection failed: ${testResult.error}`}
          </Alert>
        )}
      </section>

      {/* System Prompts */}
      <section className="panel">
        <h3>System Prompts</h3>
        <div style={{ display: "grid", gap: "var(--space-2)" }}>
          {["NL_QUERY", "PAGE_AGENT"].map((useCase) => {
            const activePrompt = prompts.find((p) => p.use_case === useCase && p.is_active);
            return (
              <div key={useCase} className="panel" style={{ padding: "var(--space-3)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
                  <strong>{useCase}</strong>
                  <Button variant="ghost" size="sm" onClick={() => setEditPrompt({ useCase, text: activePrompt?.prompt_text || "" })}>
                    Edit
                  </Button>
                </div>
                <p style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {activePrompt?.prompt_text || "No active prompt"}
                  {activePrompt && <span style={{ display: "block", marginTop: "0.25rem", fontSize: "0.75rem" }}>v{activePrompt.version}</span>}
                </p>
              </div>
            );
          })}
        </div>

        {editPrompt && (
          <div style={{ marginTop: "var(--space-3)", padding: "var(--space-3)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
            <h4 style={{ margin: "0 0 var(--space-2)" }}>Edit: {editPrompt.useCase}</h4>
            <textarea
              value={editPrompt.text}
              onChange={(e) => setEditPrompt({ ...editPrompt, text: e.target.value })}
              rows={6}
              style={{ width: "100%", fontSize: "0.875rem", padding: "var(--space-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)", justifyContent: "flex-end" }}>
              <Button variant="secondary" size="sm" onClick={() => setEditPrompt(null)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={savePrompt} disabled={savingPrompt || !editPrompt.text.trim()}>
                {savingPrompt ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
