import type { ConnectorResult } from "@puda/api-integrations";
import type { DopamsSourceAdapter, NormalizedRecord } from "./types";

/**
 * Stub adapter for Crime and Criminal Tracking Network & Systems (CCTNS).
 * In production, this will connect to the CCTNS API to fetch FIR data,
 * criminal records, and person-of-interest updates.
 */
export class CctnsAdapter implements DopamsSourceAdapter {
  name = "cctns";
  sourceType = "CCTNS" as const;

  private enabled: boolean;
  private endpointUrl: string;

  constructor(config: { endpointUrl?: string; enabled?: boolean } = {}) {
    this.endpointUrl = config.endpointUrl || process.env.CCTNS_ENDPOINT_URL || "";
    this.enabled = config.enabled ?? !!this.endpointUrl;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async fetch(_cursor?: string): Promise<ConnectorResult> {
    // Stub: return empty set. Real implementation would call CCTNS API.
    return { items: [], hasMore: false };
  }

  async healthCheck(): Promise<boolean> {
    if (!this.endpointUrl) return false;
    // Stub: real implementation pings CCTNS health endpoint
    return true;
  }

  normalize(raw: Record<string, unknown>[]): NormalizedRecord[] {
    return raw.map((r) => ({
      externalId: String(r.fir_number || r.id || ""),
      sourceType: "CCTNS",
      documentType: String(r.record_type || "FIR"),
      title: String(r.title || r.fir_number || "CCTNS Record"),
      content: JSON.stringify(r),
      metadata: r,
      fetchedAt: new Date(),
    }));
  }
}
