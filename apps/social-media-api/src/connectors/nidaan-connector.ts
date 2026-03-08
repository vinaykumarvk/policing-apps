/**
 * NIDAAN (National Integrated Database on Arrested Narcotics-offenders) connector stub.
 * Currently returns mock data; replace with real NCB API when MoU is in place.
 *
 * To activate:
 *   1. Set NIDAAN_API_URL and NIDAAN_API_KEY env vars
 *   2. Replace fetch() body with real HTTP calls
 *   3. Schedule syncToMonitoringProfiles() in connector-scheduler
 */

import { logInfo, logWarn } from "../logger";

export interface NidaanOffenderRecord {
  offenderId: string;
  name: string;
  aliases: string[];
  ndpsSections: string[];
  lastArrestDate: string | null;
  state: string;
  district: string;
  knownHandles: { platform: string; handle: string }[];
}

/** Mock offender records for demo/testing */
const MOCK_RECORDS: NidaanOffenderRecord[] = [
  {
    offenderId: "NID-2024-00451",
    name: "Ravi Kumar",
    aliases: ["Ravi K", "RK420"],
    ndpsSections: ["Sec 20"],
    lastArrestDate: "2024-01-15",
    state: "Telangana",
    district: "Hyderabad",
    knownHandles: [{ platform: "instagram", handle: "@ravi_hyd_420" }],
  },
  {
    offenderId: "NID-2024-00523",
    name: "Suresh Reddy",
    aliases: ["SR Deals"],
    ndpsSections: ["Sec 21"],
    lastArrestDate: "2024-03-22",
    state: "Telangana",
    district: "Warangal",
    knownHandles: [{ platform: "twitter", handle: "@deals_warangal" }],
  },
  {
    offenderId: "NID-2023-01187",
    name: "Mohammed Ismail",
    aliases: [],
    ndpsSections: ["Sec 20"],
    lastArrestDate: "2023-11-08",
    state: "Telangana",
    district: "Karimnagar",
    knownHandles: [{ platform: "facebook", handle: "naatu.saara.kings" }],
  },
];

export class NidaanConnector {
  private apiUrl: string | undefined;
  private apiKey: string | undefined;

  constructor() {
    this.apiUrl = process.env.NIDAAN_API_URL;
    this.apiKey = process.env.NIDAAN_API_KEY;
  }

  /** Returns true if env vars are configured */
  isEnabled(): boolean {
    return !!this.apiUrl;
  }

  /** Health check — returns false until real API is wired up */
  async healthCheck(): Promise<boolean> {
    if (!this.isEnabled()) return false;
    // TODO: replace with real API ping when MoU is signed
    return false;
  }

  /** Fetch offender records. Currently returns mock data. */
  async fetch(state?: string): Promise<NidaanOffenderRecord[]> {
    if (!this.isEnabled()) {
      logWarn("NidaanConnector: not enabled (NIDAAN_API_URL not set), returning mock data");
    }
    // TODO: replace with real HTTP calls
    // const res = await fetch(`${this.apiUrl}/offenders?state=${state}`, {
    //   headers: { Authorization: `Bearer ${this.apiKey}` },
    // });
    let records = MOCK_RECORDS;
    if (state) {
      records = records.filter((r) => r.state.toLowerCase() === state.toLowerCase());
    }
    logInfo(`NidaanConnector: returning ${records.length} mock offender records`);
    return records;
  }

  /** Map offender records to monitoring_profile INSERTs */
  async syncToMonitoringProfiles(
    queryFn: (sql: string, params: unknown[]) => Promise<{ rows: unknown[] }>,
  ): Promise<{ synced: number; skipped: number }> {
    const records = await this.fetch();
    let synced = 0;
    let skipped = 0;

    for (const record of records) {
      for (const h of record.knownHandles) {
        try {
          await queryFn(
            `INSERT INTO monitoring_profile (platform, entry_type, handle, priority, source, source_ref, suspect_name, notes)
             VALUES ($1, 'PROFILE', $2, 'HIGH', 'NIDAAN', $3, $4, $5)
             ON CONFLICT (platform, handle) WHERE handle IS NOT NULL DO UPDATE
             SET source_ref   = EXCLUDED.source_ref,
                 suspect_name = EXCLUDED.suspect_name,
                 notes        = EXCLUDED.notes,
                 updated_at   = NOW()`,
            [
              h.platform,
              h.handle,
              record.offenderId,
              record.name,
              `NDPS ${record.ndpsSections.join(", ")}, ${record.district}`,
            ],
          );
          synced++;
        } catch {
          skipped++;
        }
      }
    }

    logInfo(`NidaanConnector: sync complete — ${synced} synced, ${skipped} skipped`);
    return { synced, skipped };
  }
}
