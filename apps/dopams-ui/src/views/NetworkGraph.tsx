import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Card, Alert, SkeletonBlock } from "@puda/shared";
import { apiBaseUrl } from "../types";

type Node = { id: string; label: string; type: string; is_kingpin?: boolean };
type Edge = { source: string; target: string; relationship: string; weight?: number };
type GraphData = { nodes: Node[]; edges: Edge[] };
type NodePos = { x: number; y: number; vx: number; vy: number; node: Node };

type Props = {
  authHeaders: () => Record<string, string>;
  isOffline: boolean;
  onNavigate?: (view: string, id?: string) => void;
};

export default function NetworkGraph({ authHeaders, isOffline, onNavigate }: Props) {
  const { t } = useTranslation();
  const [entityId, setEntityId] = useState("");
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [positions, setPositions] = useState<NodePos[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const WIDTH = 700, HEIGHT = 500;

  const handleAnalyze = async () => {
    if (!entityId.trim() || isOffline) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/graph/analyze`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ entity_id: entityId.trim(), depth: 2 }),
      });
      if (res.ok) {
        const data = await res.json();
        setGraphData(data);
        initPositions(data);
      } else {
        setError(t("common.error"));
      }
    } catch {
      setError(t("common.error"));
    }
    setLoading(false);
  };

  const initPositions = (data: GraphData) => {
    const nodes = data.nodes.map((node, i) => {
      const angle = (2 * Math.PI * i) / data.nodes.length;
      const r = Math.min(WIDTH, HEIGHT) * 0.35;
      return { x: WIDTH / 2 + r * Math.cos(angle), y: HEIGHT / 2 + r * Math.sin(angle), vx: 0, vy: 0, node };
    });
    setPositions(nodes);
  };

  // Simple force simulation
  useEffect(() => {
    if (!graphData || positions.length === 0) return;
    let frame: number;
    let iter = 0;
    const maxIter = 100;
    const step = () => {
      if (iter >= maxIter) return;
      iter++;
      setPositions(prev => {
        const next = prev.map(p => ({ ...p }));
        // Repulsion
        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const dx = next[j].x - next[i].x;
            const dy = next[j].y - next[i].y;
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
            const force = 5000 / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            next[i].x -= fx; next[i].y -= fy;
            next[j].x += fx; next[j].y += fy;
          }
        }
        // Attraction along edges
        for (const edge of graphData.edges) {
          const si = next.findIndex(n => n.node.id === edge.source);
          const ti = next.findIndex(n => n.node.id === edge.target);
          if (si < 0 || ti < 0) continue;
          const dx = next[ti].x - next[si].x;
          const dy = next[ti].y - next[si].y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = (dist - 120) * 0.01;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          next[si].x += fx; next[si].y += fy;
          next[ti].x -= fx; next[ti].y -= fy;
        }
        // Center gravity
        for (const n of next) {
          n.x += (WIDTH / 2 - n.x) * 0.01;
          n.y += (HEIGHT / 2 - n.y) * 0.01;
          n.x = Math.max(30, Math.min(WIDTH - 30, n.x));
          n.y = Math.max(30, Math.min(HEIGHT - 30, n.y));
        }
        return next;
      });
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [graphData?.nodes.length]);

  const getNodeColor = (node: Node) => {
    if (node.is_kingpin) return "var(--color-danger)";
    switch (node.type) {
      case "person": return "var(--color-brand)";
      case "organization": return "var(--color-warning)";
      case "location": return "var(--color-success)";
      default: return "var(--color-text-muted)";
    }
  };

  return (
    <div>
      <div className="page__header">
        <h1>{t("graph.title")}</h1>
        <p className="subtitle">{t("graph.subtitle")}</p>
      </div>

      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
        <Input
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
          placeholder={t("graph.entity_id_placeholder")}
          style={{ flex: 1, maxWidth: "24rem" }}
        />
        <Button onClick={handleAnalyze} disabled={isOffline || loading || !entityId.trim()}>
          {loading ? t("common.loading") : t("graph.analyze")}
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {graphData && positions.length > 0 && (
        <Card>
          <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: "100%", maxHeight: "70dvh", background: "var(--color-surface-alt)", borderRadius: "var(--radius-md)" }}>
            {graphData.edges.map((edge, i) => {
              const s = positions.find(p => p.node.id === edge.source);
              const tgt = positions.find(p => p.node.id === edge.target);
              if (!s || !tgt) return null;
              return <line key={i} x1={s.x} y1={s.y} x2={tgt.x} y2={tgt.y} stroke="var(--color-border)" strokeWidth={1.5} />;
            })}
            {positions.map((p, i) => (
              <g key={i} style={{ cursor: "pointer" }} onClick={() => onNavigate?.("subject-detail", p.node.id)}>
                <circle cx={p.x} cy={p.y} r={p.node.is_kingpin ? 18 : 12} fill={getNodeColor(p.node)} opacity={0.85} />
                <text x={p.x} y={p.y + (p.node.is_kingpin ? 28 : 22)} textAnchor="middle" fontSize="10" fill="var(--color-text)">
                  {p.node.label.length > 15 ? p.node.label.slice(0, 12) + "\u2026" : p.node.label}
                </text>
              </g>
            ))}
          </svg>
          <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-2)", fontSize: "0.75rem" }}>
            <span><span style={{ display: "inline-block", width: "0.625rem", height: "0.625rem", borderRadius: "50%", background: "var(--color-brand)", marginRight: "var(--space-1)" }} />{t("graph.person")}</span>
            <span><span style={{ display: "inline-block", width: "0.625rem", height: "0.625rem", borderRadius: "50%", background: "var(--color-warning)", marginRight: "var(--space-1)" }} />{t("graph.organization")}</span>
            <span><span style={{ display: "inline-block", width: "0.625rem", height: "0.625rem", borderRadius: "50%", background: "var(--color-success)", marginRight: "var(--space-1)" }} />{t("graph.location")}</span>
            <span><span style={{ display: "inline-block", width: "0.625rem", height: "0.625rem", borderRadius: "50%", background: "var(--color-danger)", marginRight: "var(--space-1)" }} />{t("graph.kingpin")}</span>
          </div>
        </Card>
      )}
    </div>
  );
}
