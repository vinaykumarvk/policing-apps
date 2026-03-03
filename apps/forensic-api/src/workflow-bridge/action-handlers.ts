import type { ActionHandler, ActionContext } from "@puda/workflow-engine";
import { logInfo } from "../logger";

export class ForensicAssignTaskHandler implements ActionHandler {
  readonly actionKey = "ASSIGN_TASK";
  async execute(ctx: ActionContext): Promise<void> {
    logInfo("ASSIGN_TASK action executed", { entityId: ctx.entityRef.entityId, toState: ctx.toStateId });
  }
}

export class ForensicNotifyHandler implements ActionHandler {
  readonly actionKey = "NOTIFY";
  async execute(ctx: ActionContext): Promise<void> {
    logInfo("NOTIFY action executed", { entityId: ctx.entityRef.entityId, toState: ctx.toStateId });
  }
}
