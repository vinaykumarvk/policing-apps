import { WorkflowEngine, ActorTypeGuardEvaluator, ActorRoleGuardEvaluator } from "@puda/workflow-engine";
import type { EngineLogger } from "@puda/workflow-engine";
import { ForensicStorageAdapter } from "./storage-adapter";
import { ForensicTransactionManager } from "./txn-manager";
import { ForensicAuditWriter } from "./audit-writer";
import { ForensicTaskManager } from "./task-manager";
import { ForensicAssignTaskHandler, ForensicNotifyHandler } from "./action-handlers";
import { logError, logInfo, logWarn } from "../logger";

const logger: EngineLogger = {
  info: (msg, ctx) => logInfo(msg, ctx),
  warn: (msg, ctx) => logWarn(msg, ctx),
  error: (msg, ctx) => logError(msg, ctx),
};

let engineInstance: WorkflowEngine | null = null;

export function getForensicEngine(): WorkflowEngine {
  if (!engineInstance) {
    engineInstance = new WorkflowEngine({
      storageAdapter: new ForensicStorageAdapter(),
      transactionManager: new ForensicTransactionManager(),
      auditWriter: new ForensicAuditWriter(),
      guardEvaluators: [new ActorTypeGuardEvaluator(), new ActorRoleGuardEvaluator()],
      actionHandlers: [new ForensicAssignTaskHandler(), new ForensicNotifyHandler()],
      taskManager: new ForensicTaskManager(),
      logger,
    });
  }
  return engineInstance;
}
