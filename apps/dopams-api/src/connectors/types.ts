import type { ExternalConnector, ConnectorResult } from "@puda/api-integrations";

/** Extended connector interface for DOPAMS source systems. */
export interface DopamsSourceAdapter extends ExternalConnector {
  /** Source system type. */
  sourceType: "CCTNS" | "ECOURTS" | "NDPS" | "INTELLIGENCE";

  /**
   * Normalize raw records from the source system into a common format.
   * @param raw The raw data from the source system.
   * @returns Normalized records ready for upsert into source_document.
   */
  normalize(raw: Record<string, unknown>[]): NormalizedRecord[];
}

export interface NormalizedRecord {
  externalId: string;
  sourceType: string;
  documentType: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  fetchedAt: Date;
}

export interface IngestionResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  jobId: string;
}

export type { ConnectorResult };
