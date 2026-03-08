import { useState, useEffect, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Select, Tabs, Textarea, useToast } from "@puda/shared";
import { apiBaseUrl, ContentItem } from "../types";

const AccessJustificationModal = lazy(() => import("./AccessJustificationModal"));

type Props = { id: string; authHeaders: () => Record<string, string>; isOffline: boolean; onBack: () => void };

export default function ContentDetail({ id, authHeaders, isOffline, onBack }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [item, setItem] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Array<{ note_id: string; note_text: string; created_by: string; created_at: string }>>([]);
  const [activity, setActivity] = useState<Array<{ event_id: string; event_type: string; actor_id: string; created_at: string; payload_jsonb?: any }>>([]);
  const [newNote, setNewNote] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState("hi");
  const [translating, setTranslating] = useState(false);
  const [showJustification, setShowJustification] = useState(false);
  const [justified, setJustified] = useState(false);
  const [reclassifying, setReclassifying] = useState(false);
  const [aiClassification, setAiClassification] = useState<any>(null);
  const [aiTranslating, setAiTranslating] = useState(false);
  const [aiTranslatedText, setAiTranslatedText] = useState<string | null>(null);
  const [aiTranslateProvider, setAiTranslateProvider] = useState<string | null>(null);

  const fetchNotes = () => {
    fetch(`${apiBaseUrl}/api/v1/content/${id}/notes`, authHeaders())
      .then((r) => r.ok ? r.json() : { notes: [] })
      .then((data) => setNotes(data.notes || []))
      .catch(() => setNotes([]));
  };

  const fetchActivity = () => {
    fetch(`${apiBaseUrl}/api/v1/content/${id}/activity`, authHeaders())
      .then((r) => r.ok ? r.json() : { events: [] })
      .then((data) => setActivity(data.events || data.activity || []))
      .catch(() => setActivity([]));
  };

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/v1/content/${id}`, authHeaders())
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((data) => {
        const content = data.content || data;
        setItem(content);
        fetchNotes(); fetchActivity();
        const src = content.content_source_type;
        if (src && src !== "OSINT") {
          fetch(`${apiBaseUrl}/api/v1/access-justification/check/content/${id}`, authHeaders())
            .then((r) => r.ok ? r.json() : { hasActive: false })
            .then((d) => { if (!d.hasActive) setShowJustification(true); else setJustified(true); })
            .catch(() => {});
        } else { setJustified(true); }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  }, [id, authHeaders]);

  const handleTranslate = async (sourceText: string) => {
    setTranslating(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/translate`, {
        ...authHeaders(),
        method: "POST",
        body: JSON.stringify({ text: sourceText, target_language: targetLang }),
      });
      if (res.ok) {
        const data = await res.json();
        setTranslatedText(data.translated_text);
      }
    } catch { /* silent */ }
    setTranslating(false);
  };

  const handleReclassifyAi = async () => {
    setReclassifying(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/llm/classify`, {
        ...authHeaders(), method: "POST",
        body: JSON.stringify({ text: item?.content_text || "", entity_type: "content_item", entity_id: id }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiClassification(data);
        showToast("success", t("llm.reclassify_success"));
      }
    } catch { showToast("error", t("common.error")); }
    setReclassifying(false);
  };

  const handleAiTranslate = async () => {
    setAiTranslating(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/llm/translate`, {
        ...authHeaders(), method: "POST",
        body: JSON.stringify({ text: item?.content_text || "", target_language: targetLang }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiTranslatedText(data.translated_text);
        setAiTranslateProvider(data.provider || null);
        showToast("success", t("llm.translate_ai_success"));
      }
    } catch { showToast("error", t("common.error")); }
    setAiTranslating(false);
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || isOffline) return;
    setSubmittingNote(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/content/${id}/notes`, {
        ...authHeaders(), method: "POST",
        body: JSON.stringify({ note_text: newNote }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      setNewNote("");
      fetchNotes();
      showToast("success", t("notes.added"));
    } catch { showToast("error", t("common.error")); }
    finally { setSubmittingNote(false); }
  };

  if (loading) return <div className="loading-center">{t("common.loading")}</div>;
  if (error) return <Alert variant="error">{error}</Alert>;
  if (!item) return null;

  return (
    <>
      <div className="detail-header">
        <button className="detail-header__back" onClick={onBack} aria-label={t("detail.back")} type="button"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
        <h1>{t("content.content_item")}</h1>
        <span className={`badge badge--${item.threat_score >= 7 ? "critical" : item.threat_score >= 4 ? "warning" : "low"}`}>{t("content.threat_label")}: {item.threat_score}</span>
      </div>
      <Tabs tabs={[
        { key: "details", label: t("detail.tab_details"), content: (
          <>
            <div className="detail-section">
              <h2 className="detail-section__title">{t("content.information")}</h2>
              <div className="detail-grid">
                <div className="detail-field"><span className="detail-field__label">{t("detail.id")}</span><span className="detail-field__value">{item.content_id}</span></div>
                <div className="detail-field"><span className="detail-field__label">{t("content.platform")}</span><span className="detail-field__value">{item.platform}</span></div>
                <div className="detail-field"><span className="detail-field__label">{t("content.author")}</span><span className="detail-field__value">{item.author_name} (@{item.author_handle})</span></div>
                <div className="detail-field"><span className="detail-field__label">{t("content.language")}</span><span className="detail-field__value">{item.language || "—"}</span></div>
                <div className="detail-field"><span className="detail-field__label">{t("content.sentiment")}</span><span className="detail-field__value">{item.sentiment || "—"}</span></div>
                <div className="detail-field"><span className="detail-field__label">{t("content.published")}</span><span className="detail-field__value">{item.published_at ? new Date(item.published_at).toLocaleString() : "—"}</span></div>
              </div>
            </div>
            <div className="detail-section">
              <h2 className="detail-section__title">{t("content.content_heading")}</h2>
              <p style={{ color: "var(--color-text)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{item.content_text || "—"}</p>
              {item.content_url && <a href={item.content_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-brand)" }}>{t("content.view_original")}</a>}
            </div>
            <div className="detail-section">
              <h3 className="detail-section__title">{t("classify.risk_score")}</h3>
              <Button onClick={handleReclassifyAi} disabled={isOffline || reclassifying} variant="secondary">
                {reclassifying ? t("llm.reclassifying") : t("llm.reclassify_ai")}
              </Button>
              {aiClassification && (
                <div style={{ marginTop: "var(--space-2)", padding: "var(--space-3)", background: "var(--color-surface-alt)", borderRadius: "var(--radius-md)" }}>
                  <strong>{t("llm.ai_result")}</strong>
                  <p style={{ marginTop: "var(--space-1)", fontSize: "0.875rem" }}>
                    {aiClassification.category} — {t("content.threat_label")}: {aiClassification.risk_score}
                  </p>
                  {aiClassification.factors?.length > 0 && (
                    <ul style={{ marginTop: "var(--space-1)", paddingLeft: "var(--space-4)", fontSize: "0.875rem" }}>
                      {aiClassification.factors.map((f: string, i: number) => <li key={i}>{f}</li>)}
                    </ul>
                  )}
                  {aiClassification.provider && <small style={{ color: "var(--color-text-muted)" }}>{t("llm.powered_by")} {aiClassification.provider}</small>}
                </div>
              )}
            </div>
            <div className="detail-section">
              <h3 className="detail-section__title">{t("translate.title")}</h3>
              <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginBottom: "var(--space-2)" }}>
                <Select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
                  <option value="hi">{t("translate.hindi")}</option>
                  <option value="te">{t("translate.telugu")}</option>
                  <option value="en">{t("translate.english")}</option>
                </Select>
                <Button onClick={() => handleTranslate(item?.content_text || item?.description || "")} disabled={isOffline || translating} variant="secondary">
                  {translating ? t("common.loading") : t("translate.translate")}
                </Button>
                <Button onClick={handleAiTranslate} disabled={isOffline || aiTranslating} variant="secondary">
                  {aiTranslating ? t("llm.translating_ai") : t("llm.translate_ai")}
                </Button>
              </div>
              {translatedText && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                  <div>
                    <strong>{t("translate.original")}</strong>
                    <p style={{ marginTop: "var(--space-1)", fontSize: "0.875rem" }}>{item?.content_text || item?.description || ""}</p>
                  </div>
                  <div>
                    <strong>{t("translate.translated")}</strong>
                    <p style={{ marginTop: "var(--space-1)", fontSize: "0.875rem" }}>{translatedText}</p>
                  </div>
                </div>
              )}
              {aiTranslatedText && (
                <div style={{ marginTop: "var(--space-2)", padding: "var(--space-3)", background: "var(--color-surface-alt)", borderRadius: "var(--radius-md)" }}>
                  <strong>{t("llm.ai_result")}</strong>
                  <p style={{ marginTop: "var(--space-1)", fontSize: "0.875rem" }}>{aiTranslatedText}</p>
                  {aiTranslateProvider && <small style={{ color: "var(--color-text-muted)" }}>{t("llm.powered_by")} {aiTranslateProvider}</small>}
                </div>
              )}
            </div>
          </>
        )},
        { key: "notes", label: t("detail.tab_notes"), content: (
          <div className="detail-section">
            <div className="notes-form" style={{ marginBottom: "var(--space-4)" }}>
              <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder={t("notes.placeholder")} disabled={isOffline} />
              <Button size="sm" onClick={handleAddNote} disabled={!newNote.trim() || submittingNote || isOffline} style={{ marginTop: "var(--space-2)" }}>
                {t("notes.add")}
              </Button>
            </div>
            {notes.length === 0 ? <p style={{ color: "var(--color-text-muted)" }}>{t("notes.empty")}</p> : (
              <ul className="notes-list">
                {notes.map((n) => (
                  <li key={n.note_id} className="notes-list__item">
                    <p>{n.note_text}</p>
                    <small style={{ color: "var(--color-text-muted)" }}>{n.created_by} — {new Date(n.created_at).toLocaleString()}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )},
        { key: "activity", label: t("detail.tab_activity"), content: (
          <div className="detail-section">
            {activity.length === 0 ? <p style={{ color: "var(--color-text-muted)" }}>{t("activity.empty")}</p> : (
              <ul className="activity-list">
                {activity.map((e) => (
                  <li key={e.event_id} className="activity-list__item">
                    <span className="activity-list__type">{e.event_type}</span>
                    <small style={{ color: "var(--color-text-muted)" }}>{e.actor_id} — {new Date(e.created_at).toLocaleString()}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )},
      ]} />
      <Suspense fallback={null}>
        <AccessJustificationModal
          open={showJustification}
          entityType="content"
          entityId={id}
          onClose={() => { setShowJustification(false); setJustified(true); }}
          onJustified={() => { setShowJustification(false); setJustified(true); }}
          authHeaders={authHeaders}
          isOffline={isOffline}
        />
      </Suspense>
    </>
  );
}
