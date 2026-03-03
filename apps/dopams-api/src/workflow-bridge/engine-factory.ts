import {
  WorkflowEngine,
  ActorTypeGuardEvaluator,
  ActorRoleGuardEvaluator,
} from "@puda/workflow-engine";
import type { EngineLogger } from "@puda/workflow-engine";
import { DopamsStorageAdapter } from "./storage-adapter";
import { DopamsTransactionManager } from "./txn-manager";
import { DopamsAuditWriter } from "./audit-writer";
import { DopamsTaskManager } from "./task-manager";
import { DopamsAssignTaskHandler, DopamsNotifyHandler } from "./action-handlers";
import { logError, logInfo, logWarn } from "../logger";

const logger: EngineLogger = {
  info: (msg, ctx) => logInfo(msg, ctx),
  warn: (msg, ctx) => logWarn(msg, ctx),
  error: (msg, ctx) => logError(msg, ctx),
};

let engineInstance: WorkflowEngine | null = null;

export function getDopamsEngine(): WorkflowEngine {
  if (!engineInstance) {
    engineInstance = new WorkflowEngine({
      storageAdapter: new DopamsStorageAdapter(),
      transactionManager: new DopamsTransactionManager(),
      auditWriter: new DopamsAuditWriter(),
      guardEvaluators: [
        new ActorTypeGuardEvaluator(),
        new ActorRoleGuardEvaluator(),
      ],
      actionHandlers: [
        new DopamsAssignTaskHandler(),
        new DopamsNotifyHandler(),
      ],
      taskManager: new DopamsTaskManager(),
      logger,
    });
  }
  return engineInstance;
}
