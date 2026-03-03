/**
 * Converts legacy PUDA WorkflowConfig (with allowedActorTypes / allowedSystemRoleIds
 * on transitions) to the new WfDefinition format (with guards arrays).
 */
import type { WfDefinition, WfGuard, WfState, WfTransition } from "@puda/workflow-engine";

// Legacy types (matching the existing workflow.ts / service-pack JSON format)
export interface LegacyWorkflowState {
  stateId: string;
  type: string;
  taskRequired: boolean;
  systemRoleId?: string;
  slaDays?: number;
  taskUi?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LegacyWorkflowTransition {
  transitionId: string;
  fromStateId: string;
  toStateId: string;
  trigger: "manual" | "system";
  allowedActorTypes?: string[];
  allowedSystemRoleIds?: string[];
  actions?: string[];
  [key: string]: unknown;
}

export interface LegacyWorkflowConfig {
  workflowId: string;
  version: string;
  states: LegacyWorkflowState[];
  transitions: LegacyWorkflowTransition[];
}

export function convertLegacyConfig(legacy: LegacyWorkflowConfig): WfDefinition {
  const states: WfState[] = legacy.states.map((s) => {
    // Collect all extra keys into metadata
    const { stateId, type, taskRequired, systemRoleId, slaDays, taskUi, ...rest } = s;
    const metadata: Record<string, unknown> = { ...rest };
    if (taskUi) metadata.taskUi = taskUi;

    return {
      stateId,
      type,
      taskRequired,
      roleId: systemRoleId,
      slaDays,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  });

  const transitions: WfTransition[] = legacy.transitions.map((t) => {
    const { transitionId, fromStateId, toStateId, trigger, allowedActorTypes, allowedSystemRoleIds, actions, ...rest } = t;

    const guards: WfGuard[] = [];

    if (allowedActorTypes && allowedActorTypes.length > 0) {
      guards.push({
        type: "ACTOR_TYPE",
        params: { allowedTypes: allowedActorTypes },
      });
    }

    if (allowedSystemRoleIds && allowedSystemRoleIds.length > 0) {
      guards.push({
        type: "ACTOR_ROLE",
        params: { allowedRoles: allowedSystemRoleIds, forActorType: "OFFICER" },
      });
    }

    return {
      transitionId,
      fromStateId,
      toStateId,
      trigger,
      guards: guards.length > 0 ? guards : undefined,
      actions,
      metadata: Object.keys(rest).length > 0 ? rest : undefined,
    };
  });

  return {
    workflowId: legacy.workflowId,
    version: legacy.version,
    states,
    transitions,
  };
}
