/**
 * PostCommitHook for PUDA — sends notifications after the transaction commits.
 */
import type { Actor, EntityRef, PostCommitHook } from "@puda/workflow-engine";
import { query } from "../db";
import { logWarn } from "../logger";

export class PudaNotificationHook implements PostCommitHook {
  readonly hookId = "puda-notification";

  async execute(
    entityRef: EntityRef,
    _fromStateId: string,
    toStateId: string,
    transitionId: string,
    _actor: Actor,
    _payload?: Record<string, unknown>
  ): Promise<void> {
    const arn = entityRef.entityId;

    // Resolve applicant user ID and display ARN
    let applicantUserId: string | undefined;
    let displayArn: string;
    try {
      const applicantResult = await query(
        "SELECT applicant_user_id, public_arn FROM application WHERE arn = $1",
        [arn]
      );
      applicantUserId = applicantResult.rows[0]?.applicant_user_id;
      displayArn = applicantResult.rows[0]?.public_arn || arn;
    } catch {
      return;
    }

    if (!applicantUserId) return;

    const { notify } = await import("../notifications");

    const eventMap: Record<string, string> = {
      SUBMIT: "APPLICATION_SUBMITTED",
      APPROVE: "APPLICATION_APPROVED",
      REJECT: "APPLICATION_REJECTED",
    };

    // Check transitionId-based events first
    const eventType = eventMap[transitionId];
    if (eventType) {
      try {
        await notify(eventType, displayArn, applicantUserId);
      } catch (err: any) {
        logWarn("Post-commit notification failed", {
          eventType,
          error: err?.message || "unknown_error",
        });
      }
      return;
    }

    // State-based events
    if (toStateId === "QUERY_PENDING") {
      try {
        await notify("QUERY_RAISED", displayArn, applicantUserId);
      } catch (err: any) {
        logWarn("Post-commit notification failed", {
          eventType: "QUERY_RAISED",
          error: err?.message || "unknown_error",
        });
      }
    } else if (toStateId === "IN_PROGRESS") {
      try {
        await notify("TASK_ASSIGNED", displayArn, applicantUserId);
      } catch (err: any) {
        logWarn("Post-commit notification failed", {
          eventType: "TASK_ASSIGNED",
          error: err?.message || "unknown_error",
        });
      }
    }
  }
}
