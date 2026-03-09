import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Select, Tabs, Textarea, useToast } from "@puda/shared";
import { apiBaseUrl, ContentItem } from "../types";
import EmptyState from "../components/EmptyState";

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
  const [classifying, setClassifying] = useState(false);
  const [classification, setClassification] = useState<any>(null);
  const [pipelineStage, setPipelineStage] = useState(-1); // -1=idle, 0..5=stages, 6=done
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const PIPELINE_STAGES = [
    { key: "normalize", label: t("pipeline.stage_normalize") },
    { key: "keywords", label: t("pipeline.stage_keywords") },
    { key: "slang", label: t("pipeline.stage_slang") },
    { key: "emoji", label: t("pipeline.stage_emoji") },
    { key: "signals", label: t("pipeline.stage_signals") },
    { key: "llm", label: t("pipeline.stage_llm") },
  ];

  const startPipelineProgress = useCallback(() => {
    setPipelineStage(0);
    let stage = 0;
    stageTimer.current = setInterval(() => {
      stage += 1;
      if (stage < 6) {
        setPipelineStage(stage);
      } else {
        // Hold on the last stage (LLM) until the API responds
        if (stageTimer.current) clearInterval(stageTimer.current);
      }
    }, 600);
  }, []);

  const stopPipelineProgress = useCallback((success: boolean) => {
    if (stageTimer.current) { clearInterval(stageTimer.current); stageTimer.current = null; }
    if (success) {
      setPipelineStage(6); // all complete
    } else {
      setPipelineStage(-1); // reset on error
    }
  }, []);

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

  // Auto-load classification data
  useEffect(() => {
    fetch(`${apiBaseUrl}/api/v1/classify/content_item/${id}`, authHeaders())
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setClassification(data); })
      .catch(() => {});
  }, [id, authHeaders]);

  const handleTranslate = async () => {
    setTranslating(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/translate`, {
        ...authHeaders(),
        method: "POST",
        body: JSON.stringify({ entityType: "content_item", entityId: id, targetLanguage: targetLang }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "FAILED") {
          showToast("error", data.error_message || t("common.error"));
        } else {
          setTranslatedText(data.translated_text);
          // Refetch content to pick up updated language field
          const contentRes = await fetch(`${apiBaseUrl}/api/v1/content/${id}`, authHeaders());
          if (contentRes.ok) {
            const cData = await contentRes.json();
            setItem(cData.content || cData);
          }
        }
      }
    } catch { showToast("error", t("common.error")); }
    setTranslating(false);
  };

  const handleClassify = async () => {
    setClassifying(true);
    startPipelineProgress();
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/classify/content_item/${id}`, {
        method: "POST", credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setClassification(data);
        // Refetch content to get updated pipeline_metadata, threat_score, category_id
        const contentRes = await fetch(`${apiBaseUrl}/api/v1/content/${id}`, authHeaders());
        if (contentRes.ok) {
          const cData = await contentRes.json();
          setItem(cData.content || cData);
        }
        stopPipelineProgress(true);
        showToast("success", t("classify.classify_success"));
      } else {
        stopPipelineProgress(false);
        showToast("error", t("common.error"));
      }
    } catch {
      stopPipelineProgress(false);
      showToast("error", t("common.error"));
    }
    setClassifying(false);
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
              {classification ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  {classification.review_status === "NEEDS_REVIEW" && (
                    <div className="alert alert--warning" style={{ padding: "var(--space-2) var(--space-3)" }}>
                      {t("classify.needs_review_message")}
                    </div>
                  )}
                  <div className="detail-grid">
                    <div className="detail-field">
                      <span className="detail-field__label">{t("filter.category")}</span>
                      <span className="detail-field__value">
                        <span className={`badge badge--${(classification.risk_score ?? 0) >= 70 ? "critical" : (classification.risk_score ?? 0) >= 40 ? "warning" : "default"}`}>
                          {classification.category || item.effective_category || item.category_name || "—"}
                        </span>
                      </span>
                    </div>
                    <div className="detail-field">
                      <span className="detail-field__label">{t("content.threat_label")}</span>
                      <span className="detail-field__value">
                        <span className={`badge badge--${(classification.risk_score ?? 0) >= 70 ? "critical" : (classification.risk_score ?? 0) >= 40 ? "warning" : "low"}`}>
                          {classification.risk_score ?? item.threat_score ?? 0}
                        </span>
                      </span>
                    </div>
                    <div className="detail-field">
                      <span className="detail-field__label">{t("classify.method")}</span>
                      <span className="detail-field__value">
                        <span className="badge badge--default">
                          {classification.classified_by_llm ? t("classify.by_llm") : t("classify.by_rules")}
                        </span>
                      </span>
                    </div>
                    {classification.classified_by_llm && classification.llm_confidence != null && (
                      <div className="detail-field">
                        <span className="detail-field__label">{t("classify.confidence")}</span>
                        <span className="detail-field__value">{Math.round(classification.llm_confidence * 100)}%</span>
                      </div>
                    )}
                  </div>
                  {(() => {
                    const factors = typeof classification.risk_factors === "string"
                      ? JSON.parse(classification.risk_factors)
                      : classification.risk_factors;
                    return Array.isArray(factors) && factors.length > 0 ? (
                      <div>
                        <h4 style={{ marginBottom: "var(--space-2)", fontSize: "0.875rem", fontWeight: 600 }}>{t("classify.risk_factors")}</h4>
                        <ul style={{ paddingLeft: "var(--space-4)", fontSize: "0.875rem", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                          {factors.map((f: any, i: number) => (
                            <li key={i}>
                              <strong>{f.factor}</strong>
                              {f.detail && <span style={{ color: "var(--color-text-muted)" }}> — {f.detail}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null;
                  })()}
                  <Button onClick={handleClassify} disabled={isOffline || classifying} variant="secondary">
                    {classifying ? t("classify.classifying") : t("classify.run")}
                  </Button>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", marginBottom: "var(--space-2)" }}>
                    {t("classify.no_classification")}
                  </p>
                  <Button onClick={handleClassify} disabled={isOffline || classifying} variant="secondary">
                    {classifying ? t("classify.classifying") : t("classify.run")}
                  </Button>
                </div>
              )}
            </div>
            {pipelineStage >= 0 && (
              <div className="detail-section">
                <h3 className="detail-section__title">{t("pipeline.stage_progress")}</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {PIPELINE_STAGES.map((stage, i) => {
                    const isDone = pipelineStage > i || pipelineStage === 6;
                    const isActive = pipelineStage === i;
                    const isPending = pipelineStage < i && pipelineStage !== 6;
                    return (
                      <div key={stage.key} style={{
                        display: "flex", alignItems: "center", gap: "var(--space-2)",
                        opacity: isPending ? 0.4 : 1,
                        transition: "opacity 0.3s ease",
                      }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: "1.5rem", height: "1.5rem", borderRadius: "50%", fontSize: "0.75rem", fontWeight: 600, flexShrink: 0,
                          background: isDone ? "var(--color-success, #22c55e)" : isActive ? "var(--color-brand)" : "var(--color-border)",
                          color: isDone || isActive ? "#fff" : "var(--color-text-muted)",
                          transition: "background 0.3s ease",
                        }}>
                          {isDone ? "\u2713" : isActive ? (
                            <span style={{ display: "inline-block", width: "0.75rem", height: "0.75rem", border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                          ) : (i + 1)}
                        </span>
                        <span style={{
                          fontSize: "0.875rem",
                          fontWeight: isActive ? 600 : 400,
                          color: isDone ? "var(--color-success, #22c55e)" : isActive ? "var(--color-text)" : "var(--color-text-muted)",
                        }}>
                          {stage.label}
                          {isDone && pipelineStage === 6 && (() => {
                            const pm = item?.pipeline_metadata || (classification?.pipeline_metadata
                              ? (typeof classification.pipeline_metadata === "string"
                                ? JSON.parse(classification.pipeline_metadata) : classification.pipeline_metadata) : null);
                            if (!pm) return null;
                            if (stage.key === "keywords" && pm.keywordsFound?.length)
                              return <span className="badge badge--warning" style={{ marginLeft: "var(--space-1)", fontSize: "0.7rem" }}>{pm.keywordsFound.length} {t("pipeline.stage_found")}</span>;
                            if (stage.key === "slang" && pm.slangMatches?.length)
                              return <span className="badge badge--warning" style={{ marginLeft: "var(--space-1)", fontSize: "0.7rem" }}>{pm.slangMatches.length} {t("pipeline.stage_found")}</span>;
                            if (stage.key === "emoji" && pm.emojiMatches?.length)
                              return <span className="badge badge--warning" style={{ marginLeft: "var(--space-1)", fontSize: "0.7rem" }}>{pm.emojiMatches.length} {t("pipeline.stage_found")}</span>;
                            if (stage.key === "signals" && pm.transactionSignals?.length)
                              return <span className="badge badge--critical" style={{ marginLeft: "var(--space-1)", fontSize: "0.7rem" }}>{pm.transactionSignals.length} {t("pipeline.stage_found")}</span>;
                            if (stage.key === "llm") {
                              if (pm.llmUsed) return <span className="badge badge--default" style={{ marginLeft: "var(--space-1)", fontSize: "0.7rem" }}>{t("classify.by_llm")}</span>;
                              if (pm.llmError === "NO_API_KEY") return <span className="badge badge--critical" style={{ marginLeft: "var(--space-1)", fontSize: "0.7rem" }}>{t("pipeline.no_api_key")}</span>;
                              if (pm.llmError) return <span className="badge badge--critical" style={{ marginLeft: "var(--space-1)", fontSize: "0.7rem" }}>{t("pipeline.llm_failed")}</span>;
                              return <span className="badge badge--default" style={{ marginLeft: "var(--space-1)", fontSize: "0.7rem" }}>{t("pipeline.stage_skipped")}</span>;
                            }
                            return null;
                          })()}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {pipelineStage === 6 && (
                  <p style={{ fontSize: "0.8125rem", color: "var(--color-success, #22c55e)", marginTop: "var(--space-2)", fontWeight: 600 }}>
                    {t("classify.classify_success")}
                    {(() => {
                      const pm = item?.pipeline_metadata || (classification?.pipeline_metadata
                        ? (typeof classification.pipeline_metadata === "string"
                          ? JSON.parse(classification.pipeline_metadata) : classification.pipeline_metadata) : null);
                      return pm?.processingTimeMs != null ? ` (${pm.processingTimeMs}ms)` : "";
                    })()}
                  </p>
                )}
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}
            <div className="detail-section">
              <h3 className="detail-section__title">{t("pipeline.title")}</h3>
              {(() => {
                const pm = item.pipeline_metadata || (classification?.pipeline_metadata
                  ? (typeof classification.pipeline_metadata === "string"
                    ? JSON.parse(classification.pipeline_metadata)
                    : classification.pipeline_metadata)
                  : null);
                if (!pm || (!pm.normalizedText && !pm.keywordsFound?.length && !pm.emojiMatches?.length)) {
                  return (
                    <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>{t("pipeline.no_metadata")}</p>
                  );
                }
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    {/* Normalized text comparison */}
                    {pm.normalizedText && pm.normalizedText !== item.content_text && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                        <div>
                          <strong style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>{t("pipeline.original_text")}</strong>
                          <p style={{ fontSize: "0.875rem", marginTop: "var(--space-1)", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>{item.content_text?.slice(0, 200)}</p>
                        </div>
                        <div>
                          <strong style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>{t("pipeline.normalized_text")}</strong>
                          <p style={{ fontSize: "0.875rem", marginTop: "var(--space-1)", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>{pm.normalizedText.slice(0, 200)}</p>
                        </div>
                      </div>
                    )}
                    {/* Normalizations applied */}
                    {pm.normalizationsApplied && pm.normalizationsApplied.length > 0 && (
                      <div>
                        <strong style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>{t("pipeline.normalizations")}</strong>
                        <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap", marginTop: "var(--space-1)" }}>
                          {pm.normalizationsApplied.map((n: string, i: number) => (
                            <span key={i} className="badge badge--default" style={{ fontSize: "0.75rem" }}>{n}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Keywords detected */}
                    {pm.keywordsFound && pm.keywordsFound.length > 0 && (
                      <div>
                        <strong style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>{t("pipeline.keywords_found")}</strong>
                        <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap", marginTop: "var(--space-1)" }}>
                          {pm.keywordsFound.map((kw: string, i: number) => (
                            <span key={i} className="badge badge--warning" style={{ fontSize: "0.75rem" }}>{kw}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Slang matches */}
                    {pm.slangMatches && pm.slangMatches.length > 0 && (
                      <div>
                        <strong style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>{t("pipeline.slang_matches")}</strong>
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", marginTop: "var(--space-1)", fontSize: "0.875rem" }}>
                          {pm.slangMatches.map((s: { term: string; normalizedForm: string; category: string; riskWeight: number }, i: number) => (
                            <div key={i} style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                              <span className="badge badge--warning">{s.term}</span>
                              <span style={{ color: "var(--color-text-muted)" }}>&rarr;</span>
                              <span>{s.normalizedForm}</span>
                              <span className="badge badge--default" style={{ fontSize: "0.7rem" }}>{s.category}</span>
                              <span style={{ color: "var(--color-text-muted)", fontSize: "0.75rem" }}>wt: {s.riskWeight}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Emoji drug codes */}
                    {pm.emojiMatches && pm.emojiMatches.length > 0 && (
                      <div>
                        <strong style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>{t("pipeline.emoji_matches")}</strong>
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", marginTop: "var(--space-1)", fontSize: "0.875rem" }}>
                          {pm.emojiMatches.map((e: { emoji: string; drugCategory: string; signalType: string; riskWeight: number }, i: number) => (
                            <div key={i} style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                              <span style={{ fontSize: "1.25rem" }}>{e.emoji}</span>
                              <span className="badge badge--critical" style={{ fontSize: "0.7rem" }}>{e.drugCategory}</span>
                              <span className="badge badge--default" style={{ fontSize: "0.7rem" }}>{e.signalType}</span>
                              <span style={{ color: "var(--color-text-muted)", fontSize: "0.75rem" }}>wt: {e.riskWeight}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Transaction signals */}
                    {pm.transactionSignals && pm.transactionSignals.length > 0 && (
                      <div>
                        <strong style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>{t("pipeline.transaction_signals")}</strong>
                        <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap", marginTop: "var(--space-1)" }}>
                          {pm.transactionSignals.map((s: { signalType: string; matched: string }, i: number) => (
                            <span key={i} className="badge badge--critical" style={{ fontSize: "0.75rem" }} title={s.matched}>{s.signalType}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Summary row */}
                    <div className="detail-grid" style={{ marginTop: "var(--space-2)" }}>
                      {pm.substanceCategory && (
                        <div className="detail-field">
                          <span className="detail-field__label">{t("pipeline.substance_category")}</span>
                          <span className="detail-field__value"><span className="badge badge--critical">{pm.substanceCategory}</span></span>
                        </div>
                      )}
                      {pm.activityType && pm.activityType !== "NONE" && (
                        <div className="detail-field">
                          <span className="detail-field__label">{t("pipeline.activity_type")}</span>
                          <span className="detail-field__value"><span className="badge badge--warning">{pm.activityType}</span></span>
                        </div>
                      )}
                      {pm.narcoticsScore != null && (
                        <div className="detail-field">
                          <span className="detail-field__label">{t("pipeline.narcotics_score")}</span>
                          <span className="detail-field__value">
                            <span className={`badge badge--${pm.narcoticsScore >= 70 ? "critical" : pm.narcoticsScore >= 40 ? "warning" : "low"}`}>{pm.narcoticsScore}</span>
                          </span>
                        </div>
                      )}
                      {pm.processingTimeMs != null && (
                        <div className="detail-field">
                          <span className="detail-field__label">{t("pipeline.processing_time")}</span>
                          <span className="detail-field__value">{pm.processingTimeMs}ms</span>
                        </div>
                      )}
                    </div>
                    {/* LLM error message */}
                    {!pm.llmClassification && pm.llmError && (
                      <div className="alert alert--warning" style={{ padding: "var(--space-2) var(--space-3)", fontSize: "0.875rem" }}>
                        {pm.llmError === "NO_API_KEY"
                          ? t("pipeline.no_api_key_message")
                          : t("pipeline.llm_failed_message")}
                      </div>
                    )}
                    {/* Rich LLM classification breakdown */}
                    {pm.llmClassification && (
                      <div style={{ marginTop: "var(--space-3)", padding: "var(--space-3)", background: "var(--color-surface-alt)", borderRadius: "var(--radius-md)" }}>
                        <h4 style={{ marginBottom: "var(--space-2)", fontSize: "0.875rem", fontWeight: 600 }}>{t("pipeline.llm_analysis")}</h4>
                        {/* Narcotics relevance */}
                        {pm.llmClassification.narcoticsRelevance && (
                          <div style={{ marginBottom: "var(--space-2)" }}>
                            <strong style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>{t("pipeline.narcotics_relevance")}</strong>
                            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginTop: "var(--space-1)" }}>
                              <span className={`badge badge--${pm.llmClassification.narcoticsRelevance.label === "relevant" ? "critical" : "default"}`}>{pm.llmClassification.narcoticsRelevance.label}</span>
                              <span className={`badge badge--${pm.llmClassification.narcoticsRelevance.score >= 70 ? "critical" : pm.llmClassification.narcoticsRelevance.score >= 40 ? "warning" : "low"}`}>{pm.llmClassification.narcoticsRelevance.score}</span>
                            </div>
                            <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>{pm.llmClassification.narcoticsRelevance.reasoning}</p>
                          </div>
                        )}
                        {/* Primary category */}
                        {pm.llmClassification.primaryCategory && (
                          <div style={{ marginBottom: "var(--space-2)" }}>
                            <strong style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>{t("pipeline.primary_category")}</strong>
                            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginTop: "var(--space-1)" }}>
                              <span className="badge badge--warning">{pm.llmClassification.primaryCategory.label}</span>
                              <span className={`badge badge--${pm.llmClassification.primaryCategory.score >= 70 ? "critical" : pm.llmClassification.primaryCategory.score >= 40 ? "warning" : "low"}`}>{pm.llmClassification.primaryCategory.score}</span>
                            </div>
                            <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>{pm.llmClassification.primaryCategory.reasoning}</p>
                          </div>
                        )}
                        {/* Secondary categories */}
                        {pm.llmClassification.secondaryCategories && pm.llmClassification.secondaryCategories.length > 0 && (
                          <div style={{ marginBottom: "var(--space-2)" }}>
                            <strong style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>{t("pipeline.secondary_categories")}</strong>
                            <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap", marginTop: "var(--space-1)" }}>
                              {pm.llmClassification.secondaryCategories.map((sc, i) => (
                                <span key={i} className="badge badge--default" title={sc.reasoning}>{sc.label} ({sc.score})</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Sub-reason scores */}
                        {pm.llmClassification.subReasonScores && pm.llmClassification.subReasonScores.length > 0 && (
                          <div style={{ marginBottom: "var(--space-2)" }}>
                            <strong style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>{t("pipeline.sub_reasons")}</strong>
                            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginTop: "var(--space-1)" }}>
                              {pm.llmClassification.subReasonScores.map((sr, i) => (
                                <div key={i} style={{ fontSize: "0.8125rem", padding: "var(--space-2)", background: "var(--color-surface)", borderRadius: "var(--radius-sm)" }}>
                                  <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginBottom: "var(--space-1)" }}>
                                    <span className="badge badge--default" style={{ fontSize: "0.7rem" }}>{sr.reason_code}</span>
                                    <strong>{sr.reason_label}</strong>
                                    <span className={`badge badge--${sr.score >= 70 ? "critical" : sr.score >= 40 ? "warning" : "low"}`} style={{ fontSize: "0.7rem" }}>{sr.score}</span>
                                  </div>
                                  <p style={{ color: "var(--color-text-muted)", margin: 0 }}>{sr.explanation}</p>
                                  {sr.matched_evidence && sr.matched_evidence.length > 0 && (
                                    <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap", marginTop: "var(--space-1)" }}>
                                      <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{t("pipeline.evidence")}:</span>
                                      {sr.matched_evidence.map((ev, j) => (
                                        <span key={j} className="badge badge--warning" style={{ fontSize: "0.7rem" }}>{ev}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Matched entities */}
                        {pm.llmClassification.matchedEntities && (
                          <div style={{ marginBottom: "var(--space-2)" }}>
                            <strong style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>{t("pipeline.matched_entities")}</strong>
                            <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap", marginTop: "var(--space-1)" }}>
                              {Object.entries(pm.llmClassification.matchedEntities)
                                .filter(([, vals]) => Array.isArray(vals) && vals.length > 0)
                                .map(([key, vals]) => (vals as string[]).map((v, i) => (
                                  <span key={`${key}-${i}`} className="badge badge--default" style={{ fontSize: "0.7rem" }} title={key}>{v}</span>
                                )))}
                            </div>
                          </div>
                        )}
                        {/* Confidence + review */}
                        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
                          {pm.llmClassification.confidenceBand && (
                            <span>
                              <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>{t("pipeline.confidence")}: </span>
                              <span className={`badge badge--${pm.llmClassification.confidenceBand === "high" ? "default" : pm.llmClassification.confidenceBand === "medium" ? "warning" : "critical"}`}>{pm.llmClassification.confidenceBand}</span>
                            </span>
                          )}
                          {pm.llmClassification.reviewRecommended && (
                            <span className="badge badge--warning">{t("pipeline.review_recommended")}{pm.llmClassification.reviewReason ? `: ${pm.llmClassification.reviewReason}` : ""}</span>
                          )}
                        </div>
                        {/* Final reasoning */}
                        {pm.llmClassification.finalReasoning && (
                          <div style={{ marginTop: "var(--space-2)" }}>
                            <strong style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>{t("pipeline.final_reasoning")}</strong>
                            <p style={{ fontSize: "0.8125rem", marginTop: "var(--space-1)", fontStyle: "italic" }}>{pm.llmClassification.finalReasoning}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            <div className="detail-section">
              <h3 className="detail-section__title">{t("translate.title")}</h3>
              <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginBottom: "var(--space-2)" }}>
                <Select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
                  <option value="hi">{t("translate.hindi")}</option>
                  <option value="te">{t("translate.telugu")}</option>
                  <option value="en">{t("translate.english")}</option>
                  <option value="pa">{t("translate.punjabi")}</option>
                </Select>
                <Button onClick={() => handleTranslate()} disabled={isOffline || translating} variant="secondary">
                  {translating ? t("common.loading") : t("translate.translate")}
                </Button>
              </div>
              {translatedText && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                  <div>
                    <strong>{t("translate.original")} ({item?.language || "—"})</strong>
                    <p style={{ marginTop: "var(--space-1)", fontSize: "0.875rem" }}>{item?.content_text || item?.description || ""}</p>
                  </div>
                  <div>
                    <strong>{t("translate.translated")} ({targetLang})</strong>
                    <p style={{ marginTop: "var(--space-1)", fontSize: "0.875rem" }}>{translatedText}</p>
                  </div>
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
            {notes.length === 0 ? <EmptyState icon="inbox" title={t("notes.empty")} /> : (
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
            {activity.length === 0 ? <EmptyState icon="inbox" title={t("activity.empty")} /> : (
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
