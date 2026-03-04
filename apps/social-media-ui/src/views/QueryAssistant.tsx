import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Card, Alert, SkeletonBlock } from "@puda/shared";
import { apiBaseUrl } from "../types";

type Message = {
  role: "user" | "assistant";
  text: string;
  data?: { columns: string[]; rows: any[][] } | null;
  citations?: { entity_type: string; entity_id: string; title: string }[];
};

type Props = {
  authHeaders: () => Record<string, string>;
  isOffline: boolean;
  onNavigate?: (view: string, id?: string) => void;
};

export default function QueryAssistant({ authHeaders, isOffline, onNavigate }: Props) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || isOffline) return;
    const question = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: question }]);
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/query`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, {
          role: "assistant",
          text: data.summary || t("query.no_results"),
          data: data.table || null,
          citations: data.citations || [],
        }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", text: t("common.error") }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: t("common.error") }]);
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="page__header">
        <h1>{t("query.title")}</h1>
        <p className="subtitle">{t("query.subtitle")}</p>
      </div>

      <div style={{ maxWidth: "50rem", margin: "0 auto" }}>
        {messages.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "var(--space-6)", color: "var(--color-text-secondary)" }}>
            <p>{t("query.empty_hint")}</p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
          {messages.map((msg, i) => (
            <Card key={i} style={{ alignSelf: msg.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
              <p style={{ fontWeight: msg.role === "user" ? 600 : 400, whiteSpace: "pre-wrap" }}>{msg.text}</p>
              {msg.data && msg.data.columns.length > 0 && (
                <div style={{ overflowX: "auto", marginTop: "var(--space-2)" }}>
                  <table className="entity-table">
                    <thead><tr>{msg.data.columns.map((c, ci) => <th key={ci}>{c}</th>)}</tr></thead>
                    <tbody>{msg.data.rows.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci} data-label={msg.data!.columns[ci]}>{String(cell ?? "")}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
              {msg.citations && msg.citations.length > 0 && (
                <div style={{ marginTop: "var(--space-2)", display: "flex", flexWrap: "wrap", gap: "var(--space-1)" }}>
                  {msg.citations.map((c, ci) => (
                    <button key={ci} className="filter-chip" onClick={() => onNavigate?.(c.entity_type + "-detail", c.entity_id)}>
                      {c.title}
                    </button>
                  ))}
                </div>
              )}
            </Card>
          ))}
          {loading && <SkeletonBlock height="4rem" width="60%" />}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} style={{ position: "sticky", bottom: 0, display: "flex", gap: "var(--space-2)", padding: "var(--space-3)", background: "var(--color-surface)", borderTop: "1px solid var(--color-border)" }}>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("query.placeholder")}
            style={{ flex: 1 }}
            disabled={isOffline}
          />
          <Button type="submit" disabled={isOffline || loading || !input.trim()}>
            {t("query.send")}
          </Button>
        </form>
      </div>
    </div>
  );
}
