/**
 * SLACalculator for PUDA — wraps the existing sla.ts module.
 */
import type { SLACalculator, TransactionHandle } from "@puda/workflow-engine";

export class PudaSLACalculator implements SLACalculator {
  async calculateDueDate(
    startDate: Date,
    workingDays: number,
    context: Record<string, unknown>,
    _txn: TransactionHandle
  ): Promise<Date> {
    const authorityId = context.authorityId as string | undefined;
    if (!authorityId) {
      // Fallback to calendar days
      return new Date(startDate.getTime() + workingDays * 24 * 60 * 60 * 1000);
    }

    try {
      const { calculateSLADueDate } = await import("../sla");
      return await calculateSLADueDate(startDate, workingDays, authorityId);
    } catch {
      // Fallback to calendar days if SLA calculation fails
      return new Date(startDate.getTime() + workingDays * 24 * 60 * 60 * 1000);
    }
  }
}
