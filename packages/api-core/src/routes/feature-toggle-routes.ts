/**
 * Feature Toggle Routes — runtime feature flag management.
 *
 * GET  /api/v1/config/features/status — public: enabled flags for current user
 * GET  /api/v1/config/features        — admin: list all flags
 * PUT  /api/v1/config/features/:key   — admin: update flag
 */

import { FastifyInstance } from "fastify";
import type { QueryFn } from "../types";
import { sendError, send403 } from "../errors";

export interface FeatureToggleRouteDeps {
  queryFn: QueryFn;
  /** Role keys that can manage feature flags */
  adminRoles?: string[];
}

export function createFeatureToggleRoutes(deps: FeatureToggleRouteDeps) {
  const { queryFn, adminRoles = ["ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN"] } = deps;

  function isAdmin(user: any): boolean {
    if (!user?.roles) return false;
    return user.roles.some((r: string) => adminRoles.includes(r));
  }

  return async function registerFeatureToggleRoutes(app: FastifyInstance): Promise<void> {
    // ── GET /api/v1/config/features/status ─────────────────────────────────
    // Returns which features are enabled for the current user.
    app.get("/api/v1/config/features/status", {
      config: { skipStrictReadSchema: true },
    }, async (request, reply) => {
      const user = (request as any).user;
      if (!user) return sendError(reply, 401, "UNAUTHORIZED", "Authentication required");

      const result = await queryFn(
        `SELECT flag_key, enabled FROM feature_flag WHERE is_archived = FALSE`,
      );

      const flags: Record<string, boolean> = {};
      for (const row of result.rows) {
        flags[row.flag_key] = row.enabled;
      }
      return { flags };
    });

    // ── GET /api/v1/config/features ────────────────────────────────────────
    app.get("/api/v1/config/features", {
      config: { skipStrictReadSchema: true },
    }, async (request, reply) => {
      const user = (request as any).user;
      if (!isAdmin(user)) return send403(reply, "FORBIDDEN", "Admin access required");

      const result = await queryFn(
        `SELECT flag_key, enabled, description, updated_at, updated_by_user_id
         FROM feature_flag
         WHERE is_archived = FALSE
         ORDER BY flag_key ASC`,
      );
      return { features: result.rows };
    });

    // ── PUT /api/v1/config/features/:key ───────────────────────────────────
    app.put("/api/v1/config/features/:key", {
      schema: {
        params: {
          type: "object",
          required: ["key"],
          additionalProperties: false,
          properties: {
            key: { type: "string", pattern: "^[a-z][a-z0-9_]*$" },
          },
        },
        body: {
          type: "object",
          required: ["enabled"],
          additionalProperties: false,
          properties: {
            enabled: { type: "boolean" },
          },
        },
      },
    }, async (request, reply) => {
      const user = (request as any).user;
      if (!isAdmin(user)) return send403(reply, "FORBIDDEN", "Admin access required");

      const { key } = request.params as { key: string };
      const { enabled } = request.body as { enabled: boolean };

      const result = await queryFn(
        `UPDATE feature_flag SET enabled = $1, updated_at = now(), updated_by_user_id = $2
         WHERE flag_key = $3 AND is_archived = FALSE
         RETURNING flag_key, enabled, description, updated_at`,
        [enabled, user.user_id, key],
      );

      if (result.rows.length === 0) {
        return sendError(reply, 404, "FLAG_NOT_FOUND", `Feature flag '${key}' not found`);
      }
      return { feature: result.rows[0] };
    });
  };
}
