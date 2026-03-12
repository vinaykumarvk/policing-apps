import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Card, SkeletonBlock } from "@puda/shared";
import { apiBaseUrl } from "../types";

/* ---------- Types ---------- */

interface ApiNode {
  node_id: string;
  node_type: string;
  entity_id: string;
  label: string;
  properties: Record<string, unknown>;
  min_depth?: number;
}

interface ApiEdge {
  edge_id: string;
  from_node_id: string;
  to_node_id: string;
  edge_type: string;
  is_inferred: boolean;
  confidence: number;
  strength: number;
}

interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  nodeType: string;
  entityId: string;
  label: string;
  properties: Record<string, unknown>;
  minDepth: number;
  expanded: boolean;
  pinned: boolean;
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  edgeType: string;
  isInferred: boolean;
  confidence: number;
  strength: number;
}

type Props = {
  subjectId: string;
  subjectName?: string;
  authHeaders: () => Record<string, string>;
  isOffline: boolean;
  onNavigate?: (view: string, id?: string) => void;
  embedded?: boolean;
};

/* ---------- Constants ---------- */

const DEPTH_COLORS = [
  "var(--color-brand)",    // 0 = target
  "var(--color-success)",  // 1st degree
  "var(--color-warning)",  // 2nd degree
  "var(--color-danger)",   // 3rd+
];
const DEPTH_RADII = [24, 18, 14, 12];
const ENTITY_RADIUS = 10;
const DEPTH_LABELS = ["network.level_self", "network.level_1st", "network.level_2nd", "network.level_3rd"];

const NODE_TYPE_ICONS: Record<string, string> = {
  PHONE: "\u260E",
  DEVICE: "\u2B22",
  VEHICLE: "\u2708",
  BANK_ACCOUNT: "\u2B24",
  SOCIAL_ACCOUNT: "\u2B25",
  IDENTITY_DOC: "\u2B26",
};

function depthColor(d: number): string {
  return DEPTH_COLORS[Math.min(d, 3)];
}
function depthRadius(d: number): number {
  return DEPTH_RADII[Math.min(d, 3)];
}

/* ---------- Component ---------- */

export default function SubjectNetwork({ subjectId, subjectName, authHeaders, isOffline, onNavigate, embedded }: Props) {
  const { t } = useTranslation();
  const [nodes, setNodes] = useState<Map<string, SimNode>>(new Map());
  const [edges, setEdges] = useState<Map<string, GraphEdge>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedNode, setSelectedNode] = useState<SimNode | null>(null);
  const [expandingNode, setExpandingNode] = useState<string | null>(null);

  // SVG interaction state
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgSize, setSvgSize] = useState({ w: 700, h: 500 });
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 700, h: 500 });
  const [dragging, setDragging] = useState<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const [panning, setPanning] = useState<{ startX: number; startY: number; vbX: number; vbY: number } | null>(null);
  const simRunning = useRef(false);
  const simFrame = useRef(0);

  // ResizeObserver for responsive SVG
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      const h = Math.min(window.innerHeight * 0.7, 500);
      setSvgSize({ w: width, h });
      setViewBox((prev) => ({ ...prev, w: width, h }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* ---------- Data fetching ---------- */

  const mergeApiData = useCallback((apiNodes: ApiNode[], apiEdges: ApiEdge[], depthOffset: number) => {
    setNodes((prev) => {
      const next = new Map(prev);
      const cx = svgSize.w / 2;
      const cy = svgSize.h / 2;
      for (const n of apiNodes) {
        if (!next.has(n.node_id)) {
          const angle = Math.random() * 2 * Math.PI;
          const r = 80 + Math.random() * 120;
          next.set(n.node_id, {
            id: n.node_id,
            x: cx + r * Math.cos(angle),
            y: cy + r * Math.sin(angle),
            vx: 0, vy: 0,
            nodeType: n.node_type,
            entityId: n.entity_id,
            label: n.label,
            properties: n.properties || {},
            minDepth: (n.min_depth ?? 0) + depthOffset,
            expanded: false,
            pinned: false,
          });
        }
      }
      return next;
    });
    setEdges((prev) => {
      const next = new Map(prev);
      for (const e of apiEdges) {
        const key = `${e.from_node_id}-${e.to_node_id}-${e.edge_type}`;
        if (!next.has(key)) {
          next.set(key, {
            id: key,
            from: e.from_node_id,
            to: e.to_node_id,
            edgeType: e.edge_type,
            isInferred: e.is_inferred,
            confidence: e.confidence,
            strength: e.strength,
          });
        }
      }
      return next;
    });
  }, [svgSize]);

  // Initial fetch
  useEffect(() => {
    if (isOffline) { setLoading(false); return; }
    setLoading(true);
    setError("");
    fetch(`${apiBaseUrl}/api/v1/graph/subject-network/${subjectId}?depth=2`, authHeaders())
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { nodes: ApiNode[]; edges: ApiEdge[] }) => {
        if (data.nodes.length === 0) {
          setError(t("network.no_data"));
        } else {
          // Pin root node at center
          const root = data.nodes.find((n) => n.node_type === "SUBJECT" && n.entity_id === subjectId);
          mergeApiData(data.nodes, data.edges, 0);
          if (root) {
            setNodes((prev) => {
              const next = new Map(prev);
              const existing = next.get(root.node_id);
              if (existing) {
                next.set(root.node_id, { ...existing, x: svgSize.w / 2, y: svgSize.h / 2, pinned: true, expanded: true, minDepth: 0 });
              }
              return next;
            });
          }
        }
      })
      .catch(() => setError(t("common.error")))
      .finally(() => setLoading(false));
  }, [subjectId, isOffline]);

  // Expand a node
  const handleExpand = useCallback(async (nodeId: string) => {
    if (isOffline) return;
    setExpandingNode(nodeId);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/graph/network/${nodeId}?depth=1`, authHeaders());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { nodes: ApiNode[]; edges: ApiEdge[] } = await res.json();
      const parent = nodes.get(nodeId);
      const parentDepth = parent?.minDepth ?? 0;
      mergeApiData(data.nodes, data.edges, parentDepth);
      setNodes((prev) => {
        const next = new Map(prev);
        const existing = next.get(nodeId);
        if (existing) next.set(nodeId, { ...existing, expanded: true });
        return next;
      });
      // Restart simulation
      simRunning.current = true;
    } catch {
      /* silently fail expansion */
    }
    setExpandingNode(null);
  }, [isOffline, authHeaders, nodes, mergeApiData]);

  /* ---------- Force simulation ---------- */

  useEffect(() => {
    if (nodes.size === 0) return;
    simRunning.current = true;
    let iter = 0;
    const maxIter = 150;
    const alpha = { current: 1 };

    const step = () => {
      if (!simRunning.current || iter >= maxIter || alpha.current < 0.01) {
        simRunning.current = false;
        return;
      }
      iter++;
      alpha.current *= 0.97;

      setNodes((prev) => {
        const next = new Map<string, SimNode>();
        const arr = Array.from(prev.values());
        const edgeArr = Array.from(edges.values());

        // Copy
        for (const n of arr) next.set(n.id, { ...n });
        const all = Array.from(next.values());

        // Repulsion
        for (let i = 0; i < all.length; i++) {
          for (let j = i + 1; j < all.length; j++) {
            const a = all[i], b = all[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
            const force = (6000 * alpha.current) / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            if (!a.pinned) { a.x -= fx; a.y -= fy; }
            if (!b.pinned) { b.x += fx; b.y += fy; }
          }
        }

        // Attraction along edges — type-aware ideal distance
        for (const e of edgeArr) {
          const a = next.get(e.from);
          const b = next.get(e.to);
          if (!a || !b) continue;
          const bothSubject = a.nodeType === "SUBJECT" && b.nodeType === "SUBJECT";
          const idealDist = bothSubject ? 180 : 100;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = (dist - idealDist) * 0.008 * alpha.current;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          if (!a.pinned) { a.x += fx; a.y += fy; }
          if (!b.pinned) { b.x -= fx; b.y -= fy; }
        }

        // Center gravity
        const cx = svgSize.w / 2;
        const cy = svgSize.h / 2;
        for (const n of all) {
          if (n.pinned) continue;
          n.x += (cx - n.x) * 0.008 * alpha.current;
          n.y += (cy - n.y) * 0.008 * alpha.current;
          // Bound to viewBox
          n.x = Math.max(30, Math.min(svgSize.w - 30, n.x));
          n.y = Math.max(30, Math.min(svgSize.h - 30, n.y));
        }

        // Write back
        for (const n of all) next.set(n.id, n);
        return next;
      });

      simFrame.current = requestAnimationFrame(step);
    };
    simFrame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(simFrame.current);
  }, [nodes.size, edges.size, svgSize]);

  /* ---------- Pointer interactions ---------- */

  const svgPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent, nodeId?: string) => {
    if (nodeId) {
      const pt = svgPoint(e.clientX, e.clientY);
      const node = nodes.get(nodeId);
      if (node) {
        setDragging({ nodeId, offsetX: pt.x - node.x, offsetY: pt.y - node.y });
        (e.target as Element).setPointerCapture?.(e.pointerId);
      }
      e.stopPropagation();
    } else {
      // Pan
      setPanning({ startX: e.clientX, startY: e.clientY, vbX: viewBox.x, vbY: viewBox.y });
    }
  }, [nodes, svgPoint, viewBox]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragging) {
      const pt = svgPoint(e.clientX, e.clientY);
      setNodes((prev) => {
        const next = new Map(prev);
        const n = next.get(dragging.nodeId);
        if (n) next.set(dragging.nodeId, { ...n, x: pt.x - dragging.offsetX, y: pt.y - dragging.offsetY, pinned: true });
        return next;
      });
    } else if (panning) {
      const scale = viewBox.w / svgSize.w;
      const dx = (e.clientX - panning.startX) * scale;
      const dy = (e.clientY - panning.startY) * scale;
      setViewBox((prev) => ({ ...prev, x: panning.vbX - dx, y: panning.vbY - dy }));
    }
  }, [dragging, panning, svgPoint, viewBox, svgSize]);

  const handlePointerUp = useCallback(() => {
    setDragging(null);
    setPanning(null);
  }, []);

  // Zoom via Ctrl/Cmd + wheel (let normal scroll pass through for page navigation)
  const [zoomHint, setZoomHint] = useState(false);
  const zoomHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) {
      // No modifier — show hint and let the page scroll normally
      setZoomHint(true);
      if (zoomHintTimer.current) clearTimeout(zoomHintTimer.current);
      zoomHintTimer.current = setTimeout(() => setZoomHint(false), 1500);
      return;
    }
    e.preventDefault();
    const scaleFactor = e.deltaY > 0 ? 1.1 : 0.9;
    const pt = svgPoint(e.clientX, e.clientY);
    setViewBox((prev) => {
      const nw = prev.w * scaleFactor;
      const nh = prev.h * scaleFactor;
      const nx = pt.x - (pt.x - prev.x) * scaleFactor;
      const ny = pt.y - (pt.y - prev.y) * scaleFactor;
      return { x: nx, y: ny, w: nw, h: nh };
    });
  }, [svgPoint]);

  /* ---------- Derived data ---------- */

  const nodesArr = useMemo(() => Array.from(nodes.values()), [nodes]);
  const edgesArr = useMemo(() => Array.from(edges.values()), [edges]);
  const subjectNodes = useMemo(() => nodesArr.filter((n) => n.nodeType === "SUBJECT"), [nodesArr]);

  /* ---------- Render ---------- */

  if (loading) {
    return (
      <div className={embedded ? "" : "panel"}>
        <SkeletonBlock height="2rem" width="40%" />
        <SkeletonBlock height="20rem" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={embedded ? "" : "panel"}>
        <Alert variant="warning">{error}</Alert>
      </div>
    );
  }

  if (nodes.size === 0) {
    return (
      <div className={embedded ? "" : "panel"}>
        <Alert variant="info">{t("network.no_data")}</Alert>
      </div>
    );
  }

  return (
    <div className={embedded ? "" : "panel"}>
      {!embedded && (
        <div className="page__header">
          <h1>{subjectName || t("network.title")}</h1>
          <p className="subtitle">{t("network.subtitle")}</p>
        </div>
      )}

      {/* Stats bar */}
      <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-3)", fontSize: "0.875rem", color: "var(--color-text-muted)", flexWrap: "wrap" }}>
        <span>{t("network.node_count", { count: String(nodesArr.length) })}</span>
        <span>{t("network.edge_count", { count: String(edgesArr.length) })}</span>
      </div>

      <div style={{ display: "grid", gap: "var(--space-3)", gridTemplateColumns: selectedNode ? "1fr 280px" : "1fr" }}
        className="network-layout">
        {/* SVG Canvas */}
        <div ref={containerRef} style={{ position: "relative" }}>
          <svg
            ref={svgRef}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            style={{
              width: "100%",
              height: `min(70dvh, 500px)`,
              background: "var(--color-surface-alt)",
              borderRadius: "var(--radius-md)",
              touchAction: "none",
              cursor: panning ? "grabbing" : "grab",
            }}
            onPointerDown={(e) => handlePointerDown(e)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
          >

            {/* Edges */}
            {edgesArr.map((e) => {
              const from = nodes.get(e.from);
              const to = nodes.get(e.to);
              if (!from || !to) return null;
              const bothSubject = from.nodeType === "SUBJECT" && to.nodeType === "SUBJECT";
              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2;
              return (
                <g key={e.id}>
                  <line
                    x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke={e.isInferred ? "var(--color-text-muted)" : "var(--color-border)"}
                    strokeWidth={bothSubject ? 2 : 1}
                    strokeDasharray={e.isInferred ? "4 3" : undefined}
                    opacity={0.7}
                  />
                  {bothSubject && (
                    <text x={midX} y={midY - 4} textAnchor="middle" fontSize="8" fill="var(--color-text-muted)">
                      {e.edgeType.replace(/_/g, " ")}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {nodesArr.map((n) => {
              const isSubject = n.nodeType === "SUBJECT";
              const r = isSubject ? depthRadius(n.minDepth) : ENTITY_RADIUS;
              const color = isSubject ? depthColor(n.minDepth) : "var(--color-text-muted)";
              const isRoot = n.minDepth === 0 && isSubject;
              const canExpand = isSubject && !n.expanded && n.minDepth > 0;
              const isExpanding = expandingNode === n.id;

              return (
                <g
                  key={n.id}
                  style={{ cursor: "pointer" }}
                  onPointerDown={(e) => handlePointerDown(e, n.id)}
                  onClick={(e) => {
                    if (!dragging) {
                      e.stopPropagation();
                      setSelectedNode(n);
                    }
                  }}
                >
                  {/* Node circle */}
                  <circle cx={n.x} cy={n.y} r={r} fill={color} opacity={0.85} stroke={isRoot ? "var(--color-text)" : "none"} strokeWidth={isRoot ? 2 : 0} />

                  {/* Entity type icon or first initial */}
                  <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={isSubject ? 10 : 8} fill="white" style={{ pointerEvents: "none" }}>
                    {isSubject ? n.label.charAt(0).toUpperCase() : (NODE_TYPE_ICONS[n.nodeType] || "?")}
                  </text>

                  {/* Label below */}
                  <text x={n.x} y={n.y + r + 12} textAnchor="middle" fontSize="9" fill="var(--color-text)" style={{ pointerEvents: "none" }}>
                    {n.label.length > 16 ? n.label.slice(0, 14) + "\u2026" : n.label}
                  </text>

                  {/* Expand indicator */}
                  {canExpand && !isExpanding && (
                    <g onClick={(e) => { e.stopPropagation(); handleExpand(n.id); }}>
                      <circle cx={n.x + r * 0.7} cy={n.y - r * 0.7} r={7} fill="var(--color-surface)" stroke={color} strokeWidth={1.5} />
                      <text x={n.x + r * 0.7} y={n.y - r * 0.7 + 4} textAnchor="middle" fontSize="10" fontWeight="bold" fill={color} style={{ pointerEvents: "none" }}>+</text>
                    </g>
                  )}
                  {isExpanding && (
                    <circle cx={n.x + r * 0.7} cy={n.y - r * 0.7} r={7} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="4 3">
                      <animateTransform attributeName="transform" type="rotate" values={`0 ${n.x + r * 0.7} ${n.y - r * 0.7};360 ${n.x + r * 0.7} ${n.y - r * 0.7}`} dur="1s" repeatCount="indefinite" />
                    </circle>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Zoom controls */}
          <div className="network-zoom-controls">
            <button
              className="network-zoom-btn"
              aria-label={t("network.zoom_in")}
              onClick={() => setViewBox((prev) => {
                const cx = prev.x + prev.w / 2;
                const cy = prev.y + prev.h / 2;
                const nw = prev.w * 0.8;
                const nh = prev.h * 0.8;
                return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
              })}
            >+</button>
            <button
              className="network-zoom-btn"
              aria-label={t("network.zoom_out")}
              onClick={() => setViewBox((prev) => {
                const cx = prev.x + prev.w / 2;
                const cy = prev.y + prev.h / 2;
                const nw = prev.w * 1.25;
                const nh = prev.h * 1.25;
                return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
              })}
            >&minus;</button>
            <button
              className="network-zoom-btn"
              aria-label={t("network.zoom_reset")}
              onClick={() => setViewBox({ x: 0, y: 0, w: svgSize.w, h: svgSize.h })}
            >{"\u2302"}</button>
          </div>

          {/* Ctrl+scroll hint overlay */}
          {zoomHint && (
            <div className="network-zoom-hint">
              {t("network.zoom_hint")}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedNode && (
          <Card className="network-detail-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", wordBreak: "break-word" }}>{selectedNode.label}</h3>
              <button
                onClick={() => setSelectedNode(null)}
                aria-label="Close"
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem", color: "var(--color-text-muted)", minHeight: "2.75rem", minWidth: "2.75rem", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                &times;
              </button>
            </div>
            <div style={{ display: "grid", gap: "var(--space-2)", marginTop: "var(--space-2)", fontSize: "0.875rem" }}>
              <div>
                <span style={{ color: "var(--color-text-muted)" }}>{t("network.type")}: </span>
                {t(`network.${selectedNode.nodeType.toLowerCase()}`)}
              </div>
              {selectedNode.nodeType === "SUBJECT" && (
                <>
                  <div>
                    <span style={{ color: "var(--color-text-muted)" }}>{t("network.connection_level")}: </span>
                    <span className={`badge badge--${selectedNode.minDepth === 0 ? "brand" : selectedNode.minDepth === 1 ? "success" : selectedNode.minDepth === 2 ? "warning" : "error"}`}>
                      {t(DEPTH_LABELS[Math.min(selectedNode.minDepth, 3)])}
                    </span>
                  </div>
                  {selectedNode.properties.threat_level && (
                    <div>
                      <span style={{ color: "var(--color-text-muted)" }}>{t("network.threat_level")}: </span>
                      <span className={`badge badge--${(selectedNode.properties.threat_level as string) === "CRITICAL" ? "error" : "warning"}`}>
                        {selectedNode.properties.threat_level as string}
                      </span>
                    </div>
                  )}
                </>
              )}
              {/* Edges for this node */}
              {edgesArr.filter((e) => e.from === selectedNode.id || e.to === selectedNode.id).length > 0 && (
                <div>
                  <span style={{ color: "var(--color-text-muted)", display: "block", marginBottom: "var(--space-1)" }}>{t("network.relationships")}:</span>
                  <ul style={{ margin: 0, paddingLeft: "var(--space-3)", fontSize: "0.8125rem" }}>
                    {edgesArr
                      .filter((e) => e.from === selectedNode.id || e.to === selectedNode.id)
                      .slice(0, 8)
                      .map((e) => {
                        const otherId = e.from === selectedNode.id ? e.to : e.from;
                        const other = nodes.get(otherId);
                        return (
                          <li key={e.id} style={{ marginBottom: "2px" }}>
                            {e.edgeType.replace(/_/g, " ")} &rarr; {other?.label || "?"}
                            {e.isInferred && <span style={{ color: "var(--color-text-muted)", fontSize: "0.75rem" }}> ({t("network.inferred")})</span>}
                          </li>
                        );
                      })}
                  </ul>
                </div>
              )}
            </div>
            {selectedNode.nodeType === "SUBJECT" && (
              <div style={{ marginTop: "var(--space-3)" }}>
                <Button
                  size="sm"
                  onClick={() => onNavigate?.("subject-detail", selectedNode.entityId)}
                  style={{ width: "100%" }}
                >
                  {t("network.view_profile")}
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", marginTop: "var(--space-3)", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
        <span style={{ fontWeight: 600 }}>{t("network.legend")}:</span>
        {DEPTH_LABELS.map((key, i) => (
          <span key={key} style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
            <span style={{ display: "inline-block", width: "0.625rem", height: "0.625rem", borderRadius: "50%", background: DEPTH_COLORS[i] }} />
            {t(key)}
          </span>
        ))}
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
          <span style={{ display: "inline-block", width: "0.625rem", height: "0.625rem", borderRadius: "50%", background: "var(--color-text-muted)" }} />
          {t("network.entity")}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
          <span style={{ display: "inline-block", width: "2rem", borderTop: "2px dashed var(--color-text-muted)" }} />
          {t("network.inferred")}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
          <span style={{ display: "inline-block", width: "2rem", borderTop: "2px solid var(--color-border)" }} />
          {t("network.direct")}
        </span>
      </div>
    </div>
  );
}
