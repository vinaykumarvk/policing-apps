import fs from "fs";
import path from "path";

interface TransitionInfo {
  transitionId: string;
  toStateId: string;
  label: string;
}

interface RawTransition {
  transitionId: string;
  fromStateId: string;
  toStateId: string;
  trigger: string;
  guards?: Array<{ type: string; params?: Record<string, unknown> }>;
}

interface RawDefinition {
  workflowId: string;
  transitions: RawTransition[];
}

const defCache = new Map<string, RawDefinition>();

function loadDef(entityType: string): RawDefinition | null {
  const cached = defCache.get(entityType);
  if (cached) return cached;
  const filePath = path.resolve(__dirname, "..", "workflow-definitions", `${entityType}.json`);
  if (!fs.existsSync(filePath)) return null;
  const def = JSON.parse(fs.readFileSync(filePath, "utf-8")) as RawDefinition;
  defCache.set(entityType, def);
  return def;
}

export function getAvailableTransitions(entityType: string, currentStateId: string): TransitionInfo[] {
  const def = loadDef(entityType);
  if (!def) return [];
  return def.transitions
    .filter((t) => t.fromStateId === currentStateId && t.trigger === "manual")
    .map((t) => ({
      transitionId: t.transitionId,
      toStateId: t.toStateId,
      label: t.transitionId.replace(/_/g, " "),
    }));
}
