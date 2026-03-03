/**
 * PUDA-specific action handlers — extracted from workflow.ts executeAction switch cases.
 */
import type { ActionContext, ActionHandler, SLACalculator, TaskManager } from "@puda/workflow-engine";
import type { PoolClient } from "pg";
import { logInfo, logWarn } from "../logger";

function getClient(ctx: ActionContext): PoolClient {
  return ctx.txn.client as PoolClient;
}

// ── ASSIGN_NEXT_TASK ────────────────────────────────────────────────────────

export class PudaAssignNextTaskHandler implements ActionHandler {
  readonly actionKey = "ASSIGN_NEXT_TASK";

  constructor(
    private taskManager: TaskManager,
    private slaCalculator?: SLACalculator
  ) {}

  async execute(ctx: ActionContext): Promise<void> {
    const { entityRef, toStateId, targetState, txn, entityState } = ctx;

    if (!targetState.taskRequired || !targetState.roleId) return;

    let slaDueAt: Date | null = null;
    if (targetState.slaDays) {
      if (this.slaCalculator) {
        slaDueAt = await this.slaCalculator.calculateDueDate(
          new Date(),
          targetState.slaDays,
          entityState.metadata ?? {},
          txn
        );
      } else {
        slaDueAt = new Date(Date.now() + targetState.slaDays * 24 * 60 * 60 * 1000);
      }
    }

    await this.taskManager.createTask(
      entityRef,
      toStateId,
      targetState.roleId,
      slaDueAt,
      targetState.metadata ?? {},
      txn
    );
  }
}

// ── RAISE_QUERY ─────────────────────────────────────────────────────────────

export class PudaRaiseQueryHandler implements ActionHandler {
  readonly actionKey = "RAISE_QUERY";

  async execute(ctx: ActionContext): Promise<void> {
    const { entityRef, payload, actor, txn } = ctx;
    const client = getClient(ctx);
    const arn = entityRef.entityId;

    if (!payload?.queryMessage) return;

    const { v4: uuidv4 } = await import("uuid");

    const appResult = await client.query(
      "SELECT query_count, service_key FROM application WHERE arn = $1",
      [arn]
    );
    const queryNumber = (appResult.rows[0]?.query_count || 0) + 1;
    const queryId = uuidv4();

    const QUERY_RESPONSE_DAYS: Record<string, number> = {
      no_due_certificate: 10,
      registration_of_architect: 15,
      sanction_of_water_supply: 15,
      sanction_of_sewerage_connection: 15,
    };
    const deadlineDays = QUERY_RESPONSE_DAYS[appResult.rows[0]?.service_key] ?? 15;
    const responseDueAt = new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000);

    await client.query(
      `INSERT INTO query (query_id, arn, query_number, message, status,
         unlocked_field_keys, unlocked_doc_type_ids, response_due_at,
         raised_by_user_id, raised_by_role)
       VALUES ($1, $2, $3, $4, 'PENDING', $5, $6, $7, $8, $9)`,
      [
        queryId,
        arn,
        queryNumber,
        payload.queryMessage,
        (payload.unlockedFields as string[]) || [],
        (payload.unlockedDocuments as string[]) || [],
        responseDueAt,
        actor.actorId || null,
        actor.roles?.[0] || null,
      ]
    );

    // Update application query count and pause SLA
    await client.query(
      "UPDATE application SET query_count = query_count + 1, sla_paused_at = NOW() WHERE arn = $1",
      [arn]
    );

    // Auto-create a QUERY notice letter
    try {
      const { createNoticeLetter } = await import("../notices");
      const notice = await createNoticeLetter(
        {
          arn,
          noticeType: "QUERY",
          templateCode: "QUERY_NOTICE",
          subject: `Query on Application ${arn} (Query #${queryNumber})`,
          bodyText: payload.queryMessage as string,
          dispatchMode: "ELECTRONIC",
          queryId,
          issuedByUserId: actor.actorId,
          issuedByRole: actor.roles?.[0],
          metadata: {
            queryNumber,
            responseDueAt: responseDueAt.toISOString(),
            unlockedFields: (payload.unlockedFields as string[]) || [],
            unlockedDocuments: (payload.unlockedDocuments as string[]) || [],
          },
        },
        client
      );
      logInfo("Created query notice", {
        arn,
        queryId,
        noticeId: notice.notice_id,
      });
    } catch (noticeErr: any) {
      logWarn("Failed to create query notice", {
        arn,
        queryId,
        error: noticeErr?.message || "unknown_error",
      });
    }
  }
}

// ── RECORD_DECISION ─────────────────────────────────────────────────────────

export class PudaRecordDecisionHandler implements ActionHandler {
  readonly actionKey = "RECORD_DECISION";

  async execute(ctx: ActionContext): Promise<void> {
    const { entityRef, payload, actor, remarks, txn } = ctx;
    const client = getClient(ctx);
    const arn = entityRef.entityId;

    const disposalType = payload?.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    await client.query(
      "UPDATE application SET disposed_at = NOW(), disposal_type = $1 WHERE arn = $2",
      [disposalType, arn]
    );

    // Create a formal decision record
    try {
      const { createDecision } = await import("../decisions");
      const activeTask = await client.query(
        "SELECT task_id, system_role_id FROM task WHERE arn = $1 AND status IN ('PENDING', 'IN_PROGRESS') ORDER BY created_at DESC LIMIT 1",
        [arn]
      );
      const decisionType = payload?.decision === "APPROVE" ? ("APPROVE" as const) : ("REJECT" as const);
      const decision = await createDecision(
        {
          arn,
          decisionType,
          decidedByUserId: actor.actorId,
          decidedByRole: actor.roles?.[0],
          reasonCodes: (payload?.reasonCodes as string[]) || [],
          remarks: (remarks || payload?.remarks) as string | undefined,
          conditions: (payload?.conditions as string[]) || [],
          taskId: activeTask.rows[0]?.task_id,
          metadata: payload?.metadata as Record<string, unknown>,
        },
        client
      );
      logInfo("Created decision record", {
        arn,
        decisionId: decision.decision_id,
        decisionType,
      });

      // Auto-create an APPROVAL or REJECTION notice letter
      try {
        const { createNoticeLetter } = await import("../notices");
        const noticeType = decisionType === "APPROVE" ? ("APPROVAL" as const) : ("REJECTION" as const);
        const notice = await createNoticeLetter(
          {
            arn,
            noticeType,
            templateCode: `${noticeType}_NOTICE`,
            subject: `Application ${arn} — ${noticeType}`,
            bodyText:
              decisionType === "APPROVE"
                ? `Your application ${arn} has been approved.${decision.conditions.length > 0 ? ` Conditions: ${decision.conditions.join("; ")}` : ""}`
                : `Your application ${arn} has been rejected.${decision.remarks ? ` Reason: ${decision.remarks}` : ""}`,
            dispatchMode: "ELECTRONIC",
            decisionId: decision.decision_id,
            issuedByUserId: actor.actorId,
            issuedByRole: actor.roles?.[0],
            metadata: {
              reasonCodes: decision.reason_codes,
              conditions: decision.conditions,
            },
          },
          client
        );
        logInfo("Created decision notice", {
          arn,
          noticeId: notice.notice_id,
          noticeType,
        });
      } catch (noticeErr: any) {
        logWarn("Failed to create decision notice", {
          arn,
          decisionId: decision.decision_id,
          error: noticeErr?.message || "unknown_error",
        });
      }
    } catch (decErr: any) {
      logWarn("Failed to create decision record", {
        arn,
        error: decErr?.message || "unknown_error",
      });
    }
  }
}
