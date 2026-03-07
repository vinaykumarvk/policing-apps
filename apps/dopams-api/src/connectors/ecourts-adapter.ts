import type { ConnectorResult } from "@puda/api-integrations";
import type { DopamsSourceAdapter, NormalizedRecord } from "./types";

/**
 * Stub adapter for E-Courts data source.
 * Fetches case hearing schedules, court orders, and bail status updates.
 */
export class EcourtsAdapter implements DopamsSourceAdapter {
  name = "ecourts";
  sourceType = "ECOURTS" as const;

  private enabled: boolean;
  private endpointUrl: string;

  constructor(config: { endpointUrl?: string; enabled?: boolean } = {}) {
    this.endpointUrl = config.endpointUrl || process.env.ECOURTS_ENDPOINT_URL || "";
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
      externalId: String(r.case_number || r.cnr_number || r.id || ""),
      sourceType: "ECOURTS",
      documentType: String(r.document_type || "COURT_ORDER"),
      title: String(r.case_title || "E-Courts Record"),
      content: JSON.stringify(r),
      metadata: r,
      fetchedAt: new Date(),
    }));
  }
}
