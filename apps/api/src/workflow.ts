/**
 * Workflow engine — re-exports through the domain-agnostic workflow-bridge.
 *
 * All existing imports (`import { executeTransition } from "./workflow"`) continue
 * to work unchanged. The actual implementation now lives in:
 *   - packages/workflow-engine/ — domain-agnostic engine
 *   - apps/api/src/workflow-bridge/ — PUDA-specific adapters
 */
export { executeTransition } from "./workflow-bridge";
export type { WorkflowConfig, WorkflowState, WorkflowTransition } from "./workflow-bridge";
