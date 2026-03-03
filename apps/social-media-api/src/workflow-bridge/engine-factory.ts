import { WorkflowEngine, ActorTypeGuardEvaluator, ActorRoleGuardEvaluator } from "@puda/workflow-engine";
import type { EngineLogger } from "@puda/workflow-engine";
import { SmStorageAdapter } from "./storage-adapter";
import { SmTransactionManager } from "./txn-manager";
import { SmAuditWriter } from "./audit-writer";
import { SmTaskManager } from "./task-manager";
import { SmAssignTaskHandler, SmNotifyHandler } from "./action-handlers";
import { logError, logInfo, logWarn } from "../logger";

const logger: EngineLogger = {
  info: (msg, ctx) => logInfo(msg, ctx),
  warn: (msg, ctx) => logWarn(msg, ctx),
  error: (msg, ctx) => logError(msg, ctx),
};

let engineInstance: WorkflowEngine | null = null;

export function getSmEngine(): WorkflowEngine {
  if (!engineInstance) {
    engineInstance = new WorkflowEngine({
      storageAdapter: new SmStorageAdapter(),
      transactionManager: new SmTransactionManager(),
      auditWriter: new SmAuditWriter(),
      guardEvaluators: [new ActorTypeGuardEvaluator(), new ActorRoleGuardEvaluator()],
      actionHandlers: [new SmAssignTaskHandler(), new SmNotifyHandler()],
      taskManager: new SmTaskManager(),
      logger,
    });
  }
  return engineInstance;
}
