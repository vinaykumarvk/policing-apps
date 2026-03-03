/**
 * Factory that creates the PUDA WorkflowEngine instance with all adapters wired.
 */
import {
  WorkflowEngine,
  ActorTypeGuardEvaluator,
  ActorRoleGuardEvaluator,
} from "@puda/workflow-engine";
import type { EngineLogger } from "@puda/workflow-engine";
import { PudaStorageAdapter } from "./puda-storage-adapter";
import { PudaTransactionManager } from "./puda-txn-manager";
import { PudaAuditWriter } from "./puda-audit-writer";
import { PudaTaskManager } from "./puda-task-manager";
import { PudaSLACalculator } from "./puda-sla-calculator";
import {
  PudaAssignNextTaskHandler,
  PudaRaiseQueryHandler,
  PudaRecordDecisionHandler,
} from "./puda-action-handlers";
import { PudaNotificationHook } from "./puda-post-commit-hooks";
import { logError, logInfo, logWarn } from "../logger";

const pudaLogger: EngineLogger = {
  info: (msg, ctx) => logInfo(msg, ctx),
  warn: (msg, ctx) => logWarn(msg, ctx),
  error: (msg, ctx) => logError(msg, ctx),
};

let engineInstance: WorkflowEngine | null = null;

export function getPudaEngine(): WorkflowEngine {
  if (!engineInstance) {
    const taskManager = new PudaTaskManager();
    const slaCalculator = new PudaSLACalculator();

    engineInstance = new WorkflowEngine({
      storageAdapter: new PudaStorageAdapter(),
      transactionManager: new PudaTransactionManager(),
      auditWriter: new PudaAuditWriter(),
      guardEvaluators: [
        new ActorTypeGuardEvaluator(),
        new ActorRoleGuardEvaluator(),
      ],
      actionHandlers: [
        new PudaAssignNextTaskHandler(taskManager, slaCalculator),
        new PudaRaiseQueryHandler(),
        new PudaRecordDecisionHandler(),
      ],
      taskManager,
      slaCalculator,
      postCommitHooks: [new PudaNotificationHook()],
      logger: pudaLogger,
    });
  }
  return engineInstance;
}
