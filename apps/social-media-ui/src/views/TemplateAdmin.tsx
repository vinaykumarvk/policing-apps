/**
 * Template Admin — Manage report templates: create, edit, clone, preview.
 * Only accessible to PLATFORM_ADMINISTRATOR role.
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Card, Button, Alert, Badge, SkeletonBlock, useToast } from "@puda/shared";
import { apiBaseUrl } from "../types";

type Props = {
  authHeaders: () => Record<string, string>;
  isOffline: boolean;
};

type Tab = "list" | "editor";

interface TemplateRecord {
  template_id: string;
  name: string;
  template_type: string;
  content_schema: any;
  content_jsonb: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SectionDef {
  type: "text" | "table" | "keyValue";
  title: string;
  content?: string;
}

interface VariableDef {
  name: string;
  type: string;
  required: boolean;
}

export default function TemplateAdmin({ authHeaders, isOffline }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [tab, setTab] = useState<Tab>("list");
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Editor state
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [templateType, setTemplateType] = useState("COURT_EXPORT");
  const [isActive, setIsActive] = useState(true);
  const [sections, setSections] = useState<SectionDef[]>([]);
  const [variables, setVariables] = useState<VariableDef[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/report-templates?active_only=false`, authHeaders());
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch {
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [authHeaders, t]);

  useEffect(() => {
    if (!isOffline) fetchTemplates();
  }, [fetchTemplates, isOffline]);

  const resetEditor = () => {
    setEditId(null);
    setName("");
    setTemplateType("COURT_EXPORT");
    setIsActive(true);
    setSections([]);
    setVariables([]);
  };

  const openCreate = () => {
    resetEditor();
    setTab("editor");
  };

  const openEdit = async (tmpl: TemplateRecord) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/report-templates/${tmpl.template_id}`, authHeaders());
      if (!res.ok) throw new Error();
      const data = await res.json();
      const full = data.template as TemplateRecord;
      setEditId(full.template_id);
      setName(full.name);
      setTemplateType(full.template_type);
      setIsActive(full.is_active);

      // Parse sections from content_jsonb
      const content = full.content_jsonb || {};
      const secs = (content.sections || []).map((s: any) => ({
        type: s.type || "text",
        title: s.title || "",
        content: s.content || "",
      }));
      setSections(secs);

      // Parse variables from content_schema
      const schema = full.content_schema || {};
      const vars = (schema.placeholders || []).map((v: any) => ({
        name: v.name || "",
        type: v.type || "string",
        required: v.required !== false,
      }));
      setVariables(vars);
      setTab("editor");
    } catch {
      showToast("error", t("common.error"));
    }
  };

  const handleClone = (tmpl: TemplateRecord) => {
    openEdit(tmpl).then(() => {
      setEditId(null);
      setName(`${tmpl.name} (Copy)`);
    });
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const content_jsonb = {
        header: { title: name },
        sections: sections.map((s) => {
          const sec: Record<string, unknown> = { type: s.type, title: s.title };
          if (s.type === "text") sec.content = s.content || "";
          if (s.type === "keyValue") sec.entries = [];
          if (s.type === "table") { sec.headers = []; sec.rows = []; }
          return sec;
        }),
        footer: { pageNumbers: true },
      };
      const content_schema = {
        placeholders: variables.map((v) => ({
          name: v.name,
          type: v.type,
          required: v.required,
        })),
      };

      const url = editId
        ? `${apiBaseUrl}/api/v1/report-templates/${editId}`
        : `${apiBaseUrl}/api/v1/report-templates`;
      const method = editId ? "PATCH" : "POST";

      const res = await fetch(url, {
        ...authHeaders(),
        method,
        body: JSON.stringify({ name, template_type: templateType, content_jsonb, content_schema, is_active: isActive }),
      });

      if (res.ok) {
        showToast("success", editId ? t("templates.saved") : t("templates.created"));
        setTab("list");
        resetEditor();
        await fetchTemplates();
      } else {
        showToast("error", t("common.error"));
      }
    } catch {
      showToast("error", t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const addSection = () => {
    setSections([...sections, { type: "text", title: "", content: "" }]);
  };

  const updateSection = (idx: number, field: keyof SectionDef, value: string) => {
    const updated = [...sections];
    (updated[idx] as any)[field] = value;
    setSections(updated);
  };

  const removeSection = (idx: number) => {
    setSections(sections.filter((_, i) => i !== idx));
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const updated = [...sections];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setSections(updated);
  };

  const addVariable = () => {
    setVariables([...variables, { name: "", type: "string", required: true }]);
  };

  const updateVariable = (idx: number, field: keyof VariableDef, value: string | boolean) => {
    const updated = [...variables];
    (updated[idx] as any)[field] = value;
    setVariables(updated);
  };

  const removeVariable = (idx: number) => {
    setVariables(variables.filter((_, i) => i !== idx));
  };

  if (loading) return <div className="loading-center"><SkeletonBlock height="20rem" /></div>;
  if (error) return <Alert variant="error">{error}</Alert>;

  return (
    <div className="panel">
      <div className="page__header">
        <h1>{t("templates.admin")}</h1>
      </div>

      {/* Tab bar */}
      {tab === "list" && (
        <>
          <div style={{ marginBottom: "var(--space-4)" }}>
            <Button variant="primary" onClick={openCreate} disabled={isOffline}>{t("templates.create")}</Button>
          </div>

          {templates.length === 0 ? (
            <Card><p style={{ color: "var(--color-text-secondary)" }}>{t("templates.no_templates")}</p></Card>
          ) : (
            <div className="table-scroll">
              <table className="entity-table">
                <thead>
                  <tr>
                    <th>{t("templates.name")}</th>
                    <th>{t("templates.type")}</th>
                    <th>{t("templates.sections")}</th>
                    <th>{t("templates.variables")}</th>
                    <th>{t("legal.status")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((tmpl) => {
                    const secCount = tmpl.content_jsonb?.sections?.length || 0;
                    const varCount = tmpl.content_schema?.placeholders?.length || 0;
                    return (
                      <tr key={tmpl.template_id}>
                        <td data-label={t("templates.name")}>{tmpl.name}</td>
                        <td data-label={t("templates.type")}>
                          <Badge variant={tmpl.template_type === "COURT_EXPORT" ? "info" : "neutral"}>
                            {tmpl.template_type === "COURT_EXPORT" ? t("templates.court_export") : t("templates.intelligence")}
                          </Badge>
                        </td>
                        <td data-label={t("templates.sections")}>{secCount}</td>
                        <td data-label={t("templates.variables")}>{varCount}</td>
                        <td data-label={t("legal.status")}>
                          <Badge variant={tmpl.is_active ? "success" : "neutral"}>
                            {tmpl.is_active ? t("templates.active") : t("templates.inactive")}
                          </Badge>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "var(--space-1)" }}>
                            <Button size="sm" variant="secondary" onClick={() => openEdit(tmpl)} disabled={isOffline}>
                              {t("templates.edit")}
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => handleClone(tmpl)} disabled={isOffline}>
                              {t("templates.clone")}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Editor tab */}
      {tab === "editor" && (
        <Card>
          <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
            <Button variant="secondary" onClick={() => { setTab("list"); resetEditor(); }}>{t("common.cancel")}</Button>
            <h2 style={{ flex: 1, margin: 0 }}>{editId ? t("templates.edit") : t("templates.create")}</h2>
          </div>

          {/* Basic fields */}
          <div className="form-grid" style={{ marginBottom: "var(--space-4)" }}>
            <div className="form-field">
              <label className="form-field__label">{t("templates.name")}</label>
              <input className="form-input" type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-field__label">{t("templates.type")}</label>
              <select className="form-input" value={templateType} onChange={(e) => setTemplateType(e.target.value)}>
                <option value="COURT_EXPORT">{t("templates.court_export")}</option>
                <option value="INTELLIGENCE">{t("templates.intelligence")}</option>
              </select>
            </div>
            <div className="form-field">
              <label className="form-field__label" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                {t("templates.active")}
              </label>
            </div>
          </div>

          {/* Sections builder */}
          <div style={{ marginBottom: "var(--space-4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
              <h3 style={{ margin: 0 }}>{t("templates.sections")} ({sections.length})</h3>
              <Button size="sm" variant="secondary" onClick={addSection}>{t("templates.add_section")}</Button>
            </div>
            {sections.map((sec, idx) => (
              <Card key={idx} style={{ marginBottom: "var(--space-2)", padding: "var(--space-3)" }}>
                <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginBottom: "var(--space-2)" }}>
                  <select className="form-input" value={sec.type} onChange={(e) => updateSection(idx, "type", e.target.value)} style={{ width: "auto" }}>
                    <option value="text">{t("templates.section_types.text")}</option>
                    <option value="table">{t("templates.section_types.table")}</option>
                    <option value="keyValue">{t("templates.section_types.keyValue")}</option>
                  </select>
                  <input
                    className="form-input"
                    type="text"
                    placeholder={t("templates.section_title")}
                    value={sec.title}
                    onChange={(e) => updateSection(idx, "title", e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <Button size="sm" variant="secondary" onClick={() => moveSection(idx, -1)} disabled={idx === 0} aria-label="Move up">&#x25B2;</Button>
                  <Button size="sm" variant="secondary" onClick={() => moveSection(idx, 1)} disabled={idx === sections.length - 1} aria-label="Move down">&#x25BC;</Button>
                  <Button size="sm" variant="danger" onClick={() => removeSection(idx)}>{t("templates.remove_section")}</Button>
                </div>
                {sec.type === "text" && (
                  <textarea
                    className="form-textarea"
                    placeholder={t("templates.section_content")}
                    value={sec.content || ""}
                    onChange={(e) => updateSection(idx, "content", e.target.value)}
                    rows={3}
                  />
                )}
              </Card>
            ))}
          </div>

          {/* Variables builder */}
          <div style={{ marginBottom: "var(--space-4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
              <h3 style={{ margin: 0 }}>{t("templates.variables")} ({variables.length})</h3>
              <Button size="sm" variant="secondary" onClick={addVariable}>{t("templates.add_variable")}</Button>
            </div>
            {variables.map((v, idx) => (
              <div key={idx} style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginBottom: "var(--space-2)" }}>
                <input
                  className="form-input"
                  type="text"
                  placeholder={t("templates.variable_name")}
                  value={v.name}
                  onChange={(e) => updateVariable(idx, "name", e.target.value)}
                  style={{ flex: 1 }}
                />
                <select className="form-input" value={v.type} onChange={(e) => updateVariable(idx, "type", e.target.value)} style={{ width: "auto" }}>
                  <option value="string">String</option>
                  <option value="date">Date</option>
                  <option value="number">Number</option>
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", whiteSpace: "nowrap" }}>
                  <input type="checkbox" checked={v.required} onChange={(e) => updateVariable(idx, "required", e.target.checked)} />
                  {t("templates.variable_required")}
                </label>
                <Button size="sm" variant="danger" onClick={() => removeVariable(idx)}>{t("templates.remove_variable")}</Button>
              </div>
            ))}
          </div>

          {/* Preview pane */}
          {sections.length > 0 && (
            <div style={{ marginBottom: "var(--space-4)" }}>
              <h3>{t("templates.preview")}</h3>
              <Card style={{ padding: "var(--space-4)", backgroundColor: "var(--color-surface-subtle)" }}>
                <h2 style={{ marginBottom: "var(--space-2)" }}>{name || "Untitled Template"}</h2>
                {sections.map((sec, idx) => (
                  <div key={idx} style={{ marginBottom: "var(--space-3)" }}>
                    {sec.title && <h4 style={{ marginBottom: "var(--space-1)" }}>{sec.title}</h4>}
                    {sec.type === "text" && <p style={{ color: "var(--color-text-secondary)", whiteSpace: "pre-wrap" }}>{sec.content || "[Text content]"}</p>}
                    {sec.type === "table" && <p style={{ color: "var(--color-text-secondary)", fontStyle: "italic" }}>[Table: headers and rows defined at report creation]</p>}
                    {sec.type === "keyValue" && <p style={{ color: "var(--color-text-secondary)", fontStyle: "italic" }}>[Key-Value pairs defined at report creation]</p>}
                  </div>
                ))}
              </Card>
            </div>
          )}

          {/* Save */}
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Button variant="primary" onClick={handleSave} disabled={saving || !name.trim() || isOffline}>
              {saving ? t("common.saving") : t("templates.save")}
            </Button>
            <Button variant="secondary" onClick={() => { setTab("list"); resetEditor(); }}>{t("common.cancel")}</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
