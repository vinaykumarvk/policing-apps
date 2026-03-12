import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Card, Field, Input, Select, SkeletonBlock } from "@puda/shared";
import { apiBaseUrl } from "../types";

/* ---------- Types ---------- */

interface ApiNode {
  id: string;
  type: string; // SUBJECT | BANK_ACCOUNT | UPI_ACCOUNT | EXTERNAL
  label: string;
  properties: Record<string, unknown>;
}

interface ApiEdge {
  id: string;
  from: string;
  to: string;
  edgeType: string;
  properties: {
    total_amount?: number;
    txn_count?: number;
    first_txn?: string;
    last_txn?: string;
    is_suspicious?: boolean;
    suspicious_count?: number;
  };
}

interface ApiResponse {
  nodes: ApiNode[];
  edges: ApiEdge[];
  summary: {
    totalVolume: number;
    suspiciousCount: number;
    nodeCount: number;
    edgeCount: number;
  };
}

interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: string;
  label: string;
  properties: Record<string, unknown>;
  pinned: boolean;
}

type Props = {
  txnType: "UPI" | "BANK";
  authHeaders: () => Record<string, string>;
  isOffline: boolean;
  onNavigate?: (view: string, id?: string) => void;
};

/* ---------- Constants ---------- */

const NODE_COLORS: Record<string, string> = {
  SUBJECT: "var(--color-brand)",
  BANK_ACCOUNT: "var(--color-info)",
  UPI_ACCOUNT: "var(--color-success)",
  EXTERNAL: "var(--color-text-muted)",
};

function formatAmount(amount: number): string {
  if (amount >= 10000000) return `Rs. ${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `Rs. ${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `Rs. ${(amount / 1000).toFixed(1)}K`;
  return `Rs. ${amount}`;
}

/* ---------- Component ---------- */

export default function TransactionNetwork({ txnType, authHeaders, isOffline, onNavigate }: Props) {
  const { t } = useTranslation();
  const [nodes, setNodes] = useState<Map<string, SimNode>>(new Map());
  const [edges, setEdges] = useState<ApiEdge[]>([]);
  const [summary, setSummary] = useState<ApiResponse["summary"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedNode, setSelectedNode] = useState<SimNode | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filter state
  const [filterSubjectId, setFilterSubjectId] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterMinAmount, setFilterMinAmount] = useState("");
  const [subjects, setSubjects] = useState<{ subject_id: string; full_name: string }[]>([]);

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

  // Load subject list for filter dropdown
  useEffect(() => {
    if (isOffline) return;
    fetch(`${apiBaseUrl}/api/v1/subjects?limit=100&sortBy=full_name&sortOrder=asc`, authHeaders())
      .then((r) => r.ok ? r.json() : { subjects: [] })
      .then((data) => setSubjects(data.subjects || []))
      .catch(() => {});
  }, [isOffline, authHeaders]);

  /* ---------- Data fetching ---------- */

  const fetchData = useCallback(() => {
    if (isOffline) { setLoading(false); return; }
    setLoading(true);
    setError("");
    setSelectedNode(null);

    const params = new URLSearchParams({ txnType });
    if (filterSubjectId) params.set("subjectId", filterSubjectId);
    if (filterDateFrom) params.set("dateFrom", filterDateFrom);
    if (filterDateTo) params.set("dateTo", filterDateTo);
    if (filterMinAmount) params.set("minAmount", filterMinAmount);

    fetch(`${apiBaseUrl}/api/v1/graph/transaction-network?${params}`, authHeaders())
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: ApiResponse) => {
        if (data.nodes.length === 0) {
          setError(t("txn_network.no_data"));
          setNodes(new Map());
          setEdges([]);
          setSummary(data.summary);
          return;
        }

        const cx = svgSize.w / 2;
        const cy = svgSize.h / 2;
        const newNodes = new Map<string, SimNode>();
        for (const n of data.nodes) {
          const angle = Math.random() * 2 * Math.PI;
          const r = 60 + Math.random() * 140;
          newNodes.set(n.id, {
            id: n.id,
            x: cx + r * Math.cos(angle),
            y: cy + r * Math.sin(angle),
            vx: 0, vy: 0,
            type: n.type,
            label: n.label,
            properties: n.properties || {},
            pinned: false,
          });
        }
        setNodes(newNodes);
        setEdges(data.edges);
        setSummary(data.summary);
        simRunning.current = true;
      })
      .catch(() => setError(t("common.error")))
      .finally(() => setLoading(false));
  }, [txnType, filterSubjectId, filterDateFrom, filterDateTo, filterMinAmount, isOffline, authHeaders, svgSize, t]);

  // Initial fetch
  useEffect(() => { fetchData(); }, [txnType]);

  const handleApplyFilters = () => { fetchData(); };
  const handleResetFilters = () => {
    setFilterSubjectId("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterMinAmount("");
    // fetchData will be triggered when we set a special flag, but let's just call it
    setTimeout(() => fetchData(), 0);
  };

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

        for (const n of arr) next.set(n.id, { ...n });
        const all = Array.from(next.values());

        // Repulsion
        for (let i = 0; i < all.length; i++) {
          for (let j = i + 1; j < all.length; j++) {
            const a = all[i], b = all[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
            const force = (5000 * alpha.current) / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            if (!a.pinned) { a.x -= fx; a.y -= fy; }
            if (!b.pinned) { b.x += fx; b.y += fy; }
          }
        }

        // Attraction along edges
        for (const e of edges) {
          const a = next.get(e.from);
          const b = next.get(e.to);
          if (!a || !b) continue;
          const isOwnership = e.edgeType === "HAS_UPI" || e.edgeType === "HAS_ACCOUNT";
          const idealDist = isOwnership ? 60 : 150;
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
          n.x = Math.max(40, Math.min(svgSize.w - 40, n.x));
          n.y = Math.max(40, Math.min(svgSize.h - 40, n.y));
        }

        for (const n of all) next.set(n.id, n);
        return next;
      });

      simFrame.current = requestAnimationFrame(step);
    };
    simFrame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(simFrame.current);
  }, [nodes.size, edges.length, svgSize]);

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

  // Zoom via Ctrl/Cmd + wheel only — let normal scroll pass through
  const [zoomHint, setZoomHint] = useState(false);
  const zoomHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) {
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

  /* ---------- Derived ---------- */

  const nodesArr = useMemo(() => Array.from(nodes.values()), [nodes]);
  const maxAmount = useMemo(
    () => Math.max(1, ...edges.filter((e) => e.properties.total_amount).map((e) => e.properties.total_amount!)),
    [edges],
  );

  /* ---------- Render helpers ---------- */

  const renderNodeShape = (n: SimNode) => {
    const color = NODE_COLORS[n.type] || "var(--color-text-muted)";
    const isSelected = selectedNode?.id === n.id;

    if (n.type === "SUBJECT") {
      return (
        <circle
          cx={n.x} cy={n.y} r={20}
          fill={n.properties.threat_level === "CRITICAL" ? "var(--color-danger)" : n.properties.threat_level === "HIGH" ? "var(--color-warning)" : color}
          opacity={0.85}
          stroke={isSelected ? "var(--color-text)" : "none"}
          strokeWidth={isSelected ? 2.5 : 0}
        />
      );
    }
    if (n.type === "EXTERNAL") {
      // Diamond shape
      const s = 14;
      return (
        <polygon
          points={`${n.x},${n.y - s} ${n.x + s},${n.y} ${n.x},${n.y + s} ${n.x - s},${n.y}`}
          fill={color} opacity={0.7}
          stroke={isSelected ? "var(--color-text)" : "none"}
          strokeWidth={isSelected ? 2 : 0}
        />
      );
    }
    // BANK_ACCOUNT / UPI_ACCOUNT — rounded rect
    const w = 32;
    const h = 16;
    return (
      <rect
        x={n.x - w / 2} y={n.y - h / 2} width={w} height={h} rx={4}
        fill={color} opacity={0.85}
        stroke={isSelected ? "var(--color-text)" : "none"}
        strokeWidth={isSelected ? 2 : 0}
      />
    );
  };

  /* ---------- Detail panel ---------- */

  const renderDetailPanel = () => {
    if (!selectedNode) return null;

    const relatedEdges = edges.filter((e) => e.from === selectedNode.id || e.to === selectedNode.id);
    const totalSent = relatedEdges
      .filter((e) => e.from === selectedNode.id && e.properties.total_amount)
      .reduce((s, e) => s + (e.properties.total_amount || 0), 0);
    const totalReceived = relatedEdges
      .filter((e) => e.to === selectedNode.id && e.properties.total_amount)
      .reduce((s, e) => s + (e.properties.total_amount || 0), 0);

    return (
      <Card className="txn-network-detail-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h3 style={{ margin: 0, fontSize: "1rem", wordBreak: "break-word" }}>{selectedNode.label}</h3>
          <button
            onClick={() => setSelectedNode(null)}
            aria-label="Close"
            className="txn-network-close-btn"
          >
            &times;
          </button>
        </div>
        <div style={{ display: "grid", gap: "var(--space-2)", marginTop: "var(--space-2)", fontSize: "0.875rem" }}>
          <div>
            <span style={{ color: "var(--color-text-muted)" }}>{t("txn_network.type")}: </span>
            {t(`txn_network.${selectedNode.type.toLowerCase()}`)}
          </div>

          {selectedNode.type === "SUBJECT" && (
            <>
              {selectedNode.properties.threat_level && (
                <div>
                  <span style={{ color: "var(--color-text-muted)" }}>{t("network.threat_level")}: </span>
                  <span className={`badge badge--${(selectedNode.properties.threat_level as string) === "CRITICAL" ? "error" : "warning"}`}>
                    {selectedNode.properties.threat_level as string}
                  </span>
                </div>
              )}
              <div>
                <span style={{ color: "var(--color-text-muted)" }}>{t("txn_network.total_sent")}: </span>
                {formatAmount(totalSent)}
              </div>
              <div>
                <span style={{ color: "var(--color-text-muted)" }}>{t("txn_network.total_received")}: </span>
                {formatAmount(totalReceived)}
              </div>
            </>
          )}

          {selectedNode.type === "BANK_ACCOUNT" && (
            <>
              {selectedNode.properties.bank_name && (
                <div><span style={{ color: "var(--color-text-muted)" }}>{t("txn_network.bank_name")}: </span>{selectedNode.properties.bank_name as string}</div>
              )}
              {selectedNode.properties.subject_name && (
                <div><span style={{ color: "var(--color-text-muted)" }}>{t("txn_network.owner")}: </span>{selectedNode.properties.subject_name as string}</div>
              )}
            </>
          )}

          {selectedNode.type === "UPI_ACCOUNT" && (
            <>
              {selectedNode.properties.provider_app && (
                <div><span style={{ color: "var(--color-text-muted)" }}>{t("txn_network.provider")}: </span>{selectedNode.properties.provider_app as string}</div>
              )}
              {selectedNode.properties.subject_name && (
                <div><span style={{ color: "var(--color-text-muted)" }}>{t("txn_network.owner")}: </span>{selectedNode.properties.subject_name as string}</div>
              )}
            </>
          )}

          {selectedNode.type === "EXTERNAL" && (
            <div>
              <span style={{ color: "var(--color-text-muted)" }}>{t("txn_network.total_volume")}: </span>
              {formatAmount(totalSent + totalReceived)}
            </div>
          )}

          {/* Connected edges */}
          {relatedEdges.filter((e) => e.properties.total_amount).length > 0 && (
            <div>
              <span style={{ color: "var(--color-text-muted)", display: "block", marginBottom: "var(--space-1)" }}>{t("network.relationships")}:</span>
              <ul style={{ margin: 0, paddingLeft: "var(--space-3)", fontSize: "0.8125rem" }}>
                {relatedEdges
                  .filter((e) => e.properties.total_amount)
                  .slice(0, 8)
                  .map((e) => {
                    const otherId = e.from === selectedNode.id ? e.to : e.from;
                    const other = nodes.get(otherId);
                    return (
                      <li key={e.id} style={{ marginBottom: "2px" }}>
                        {e.from === selectedNode.id ? "\u2192" : "\u2190"} {other?.label || "?"}
                        <span style={{ color: "var(--color-text-muted)", fontSize: "0.75rem" }}>
                          {" "}({formatAmount(e.properties.total_amount!)}, {e.properties.txn_count} txns)
                        </span>
                        {e.properties.is_suspicious && (
                          <span className="badge badge--error" style={{ marginLeft: "var(--space-1)", fontSize: "0.625rem" }}>
                            {t("txn_network.suspicious")}
                          </span>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}
        </div>

        {selectedNode.type === "SUBJECT" && selectedNode.properties.subject_id && (
          <div style={{ marginTop: "var(--space-3)" }}>
            <Button
              size="sm"
              onClick={() => onNavigate?.("subject-detail", selectedNode.properties.subject_id as string)}
              style={{ width: "100%" }}
            >
              {t("txn_network.view_profile")}
            </Button>
          </div>
        )}
        {(selectedNode.type === "BANK_ACCOUNT" || selectedNode.type === "UPI_ACCOUNT") && selectedNode.properties.subject_id && (
          <div style={{ marginTop: "var(--space-3)" }}>
            <Button
              size="sm"
              onClick={() => onNavigate?.("subject-detail", selectedNode.properties.subject_id as string)}
              style={{ width: "100%" }}
            >
              {t("txn_network.view_profile")}
            </Button>
          </div>
        )}
      </Card>
    );
  };

  /* ---------- Render ---------- */

  if (loading) {
    return (
      <div className="panel">
        <SkeletonBlock height="2rem" width="40%" />
        <SkeletonBlock height="20rem" />
      </div>
    );
  }

  const titleKey = txnType === "UPI" ? "txn_network.title_upi" : "txn_network.title_bank";
  const subtitleKey = txnType === "UPI" ? "txn_network.subtitle_upi" : "txn_network.subtitle_bank";

  return (
    <div className="panel">
      {/* Header */}
      <div className="page__header">
        <h1>{t(titleKey)}</h1>
        <p className="subtitle">{t(subtitleKey)}</p>
      </div>

      {/* Subject selector + filter bar */}
      <div className="filter-bar">
        <Field label={t("txn_network.filter_subject")} htmlFor="txn-filter-subject">
          <Select
            id="txn-filter-subject"
            value={filterSubjectId}
            onChange={(e) => { setFilterSubjectId(e.target.value); setTimeout(() => fetchData(), 0); }}
          >
            <option value="">{t("txn_network.filter_all")}</option>
            {subjects.map((s) => (
              <option key={s.subject_id} value={s.subject_id}>{s.full_name}</option>
            ))}
          </Select>
        </Field>
        <div className="filter-bar__actions">
          <Button size="sm" variant="secondary"
            onClick={() => setFiltersOpen(!filtersOpen)}
            aria-expanded={filtersOpen}
          >
            {t("txn_network.filters")} {filtersOpen ? "\u25B2" : "\u25BC"}
          </Button>
        </div>
      </div>

      {filtersOpen && (
        <div className="filter-bar">
          <Field label={t("txn_network.filter_date_from")} htmlFor="txn-filter-from">
            <Input id="txn-filter-from" type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
          </Field>
          <Field label={t("txn_network.filter_date_to")} htmlFor="txn-filter-to">
            <Input id="txn-filter-to" type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
          </Field>
          <Field label={t("txn_network.filter_min_amount")} htmlFor="txn-filter-amount">
            <Input
              id="txn-filter-amount"
              type="number"
              inputMode="numeric"
              min="0"
              value={filterMinAmount}
              onChange={(e) => setFilterMinAmount(e.target.value)}
              placeholder="0"
            />
          </Field>
          <div className="filter-bar__actions">
            <Button size="sm" onClick={handleApplyFilters} disabled={isOffline}>{t("txn_network.apply")}</Button>
            <Button size="sm" variant="ghost" onClick={handleResetFilters}>{t("txn_network.reset")}</Button>
          </div>
        </div>
      )}

      {/* Summary bar */}
      {summary && (
        <div className="txn-network-summary">
          <span>{t("txn_network.node_count", { count: String(summary.nodeCount) })}</span>
          <span>{t("txn_network.edge_count", { count: String(summary.edgeCount) })}</span>
          <span>{t("txn_network.total_volume")}: {formatAmount(summary.totalVolume)}</span>
          {summary.suspiciousCount > 0 && (
            <span className="txn-network-summary__suspicious">
              {t("txn_network.suspicious_count", { count: String(summary.suspiciousCount) })}
            </span>
          )}
        </div>
      )}

      {error && <Alert variant="warning" className="view-feedback">{error}</Alert>}

      {nodes.size > 0 && (
        <div
          className={`txn-network-layout ${selectedNode ? "txn-network-layout--with-panel" : ""}`}
        >
          {/* SVG Canvas */}
          <div ref={containerRef} style={{ position: "relative", minWidth: 0 }}>
            <svg
              ref={svgRef}
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
              className="txn-network-svg"
              onPointerDown={(e) => handlePointerDown(e)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onWheel={handleWheel}
              style={{ cursor: panning ? "grabbing" : "grab", touchAction: "none" }}
            >
              {/* Edges */}
              {edges.map((e) => {
                const from = nodes.get(e.from);
                const to = nodes.get(e.to);
                if (!from || !to) return null;

                const isOwnership = e.edgeType === "HAS_UPI" || e.edgeType === "HAS_ACCOUNT";
                const amt = e.properties.total_amount || 0;
                const thickness = isOwnership ? 1 : Math.max(1, Math.min(5, (amt / maxAmount) * 5));
                const isSusp = e.properties.is_suspicious;
                const midX = (from.x + to.x) / 2;
                const midY = (from.y + to.y) / 2;

                return (
                  <g key={e.id}>
                    <line
                      x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                      stroke={isSusp ? "var(--color-danger)" : isOwnership ? "var(--color-border)" : "var(--color-text-muted)"}
                      strokeWidth={thickness}
                      strokeDasharray={isOwnership ? "4 3" : undefined}
                      opacity={0.7}
                    />
                    {!isOwnership && amt > 0 && (
                      <text x={midX} y={midY - 4} textAnchor="middle" fontSize="7" fill="var(--color-text-muted)">
                        {formatAmount(amt)}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Nodes */}
              {nodesArr.map((n) => (
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
                  {renderNodeShape(n)}
                  {/* Label */}
                  <text
                    x={n.x}
                    y={n.type === "SUBJECT" ? n.y + 4 : n.y + 3}
                    textAnchor="middle"
                    fontSize={n.type === "SUBJECT" ? 10 : 7}
                    fill="white"
                    style={{ pointerEvents: "none" }}
                  >
                    {n.type === "SUBJECT"
                      ? n.label.charAt(0).toUpperCase()
                      : n.label.length > 12 ? n.label.slice(0, 10) + "\u2026" : n.label}
                  </text>
                  {/* Label below */}
                  <text
                    x={n.x}
                    y={n.y + (n.type === "SUBJECT" ? 32 : 20)}
                    textAnchor="middle"
                    fontSize="8"
                    fill="var(--color-text)"
                    style={{ pointerEvents: "none" }}
                  >
                    {n.label.length > 18 ? n.label.slice(0, 16) + "\u2026" : n.label}
                  </text>
                </g>
              ))}
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

            {/* Ctrl+scroll hint */}
            {zoomHint && (
              <div className="network-zoom-hint">
                {t("network.zoom_hint")}
              </div>
            )}
          </div>

          {/* Detail panel */}
          {renderDetailPanel()}
        </div>
      )}

      {/* Legend */}
      <div className="txn-network-legend">
        <span style={{ fontWeight: 600 }}>{t("txn_network.legend")}:</span>
        <span className="txn-network-legend__item">
          <span className="txn-network-legend__circle" style={{ background: "var(--color-brand)" }} />
          {t("txn_network.subject")}
        </span>
        <span className="txn-network-legend__item">
          <span className="txn-network-legend__rect" style={{ background: txnType === "UPI" ? "var(--color-success)" : "var(--color-info)" }} />
          {t(txnType === "UPI" ? "txn_network.upi_account" : "txn_network.bank_account")}
        </span>
        <span className="txn-network-legend__item">
          <span className="txn-network-legend__diamond" />
          {t("txn_network.external_party")}
        </span>
        <span className="txn-network-legend__item">
          <span style={{ display: "inline-block", width: "2rem", borderTop: "3px solid var(--color-danger)" }} />
          {t("txn_network.legend_suspicious")}
        </span>
        <span className="txn-network-legend__item">
          <span style={{ display: "inline-block", width: "2rem", borderTop: "1px solid var(--color-text-muted)" }} />
          {t("txn_network.legend_normal")}
        </span>
        <span className="txn-network-legend__item">
          <span style={{ display: "inline-block", width: "2rem", borderTop: "3px solid var(--color-text-muted)" }} />
          {t("txn_network.legend_thick")}
        </span>
      </div>
    </div>
  );
}
