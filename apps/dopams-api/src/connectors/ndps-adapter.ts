import type { ConnectorResult } from "@puda/api-integrations";
import type { DopamsSourceAdapter, NormalizedRecord } from "./types";

/**
 * Stub adapter for NDPS (Narcotic Drugs and Psychotropic Substances) database.
 * Fetches drug seizure records, offender history, and substance analysis reports.
 */
export class NdpsAdapter implements DopamsSourceAdapter {
  name = "ndps";
  sourceType = "NDPS" as const;

  private enabled: boolean;
  private endpointUrl: string;

  constructor(config: { endpointUrl?: string; enabled?: boolean } = {}) {
    this.endpointUrl = config.endpointUrl || process.env.NDPS_ENDPOINT_URL || "";
    this.enabled = config.enabled ?? !!this.endpointUrl;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async fetch(_cursor?: string): Promise<ConnectorResult> {
    return { items: [], hasMore: false };
  }

  async healthCheck(): Promise<boolean> {
    if (!this.endpointUrl) return false;
    return true;
  }

  normalize(raw: Record<string, unknown>[]): NormalizedRecord[] {
    return raw.map((r) => ({
      externalId: String(r.seizure_id || r.case_id || r.id || ""),
      sourceType: "NDPS",
      documentType: String(r.record_type || "SEIZURE_RECORD"),
      title: String(r.title || "NDPS Record"),
      content: JSON.stringify(r),
      metadata: r,
      fetchedAt: new Date(),
    }));
  }
}
