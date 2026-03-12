import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send400, send404, sendError } from "../errors";
import { createRoleGuard } from "@puda/api-core";
import {
  normalizePhone,
  normalizeIdentityDoc,
  normalizeIMEI,
  normalizeVehicleReg,
  normalizeSocialHandle,
} from "../services/entity-normalizer";

export async function registerEntityRoutes(app: FastifyInstance): Promise<void> {
  const requireAnalyst = createRoleGuard(["INTELLIGENCE_ANALYST", "SUPERVISORY_OFFICER", "ADMINISTRATOR"]);

  // Search entities by normalized value — find subjects linked to a phone/account/identity
  app.get("/api/v1/entities/search", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        required: ["type", "value"],
        properties: {
          type: { type: "string", enum: ["PHONE", "IDENTITY", "IMEI", "VEHICLE", "SOCIAL"] },
          value: { type: "string", minLength: 1, maxLength: 200 },
          doc_type: { type: "string", enum: ["AADHAAR", "PAN", "PASSPORT", "DRIVING_LICENSE", "VOTER_ID"] },
          platform: { type: "string", maxLength: 50 },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireAnalyst(request, reply)) return;
    const { type, value, doc_type, platform } = request.query as {
      type: string; value: string; doc_type?: string; platform?: string;
    };

    try {
      switch (type) {
        case "PHONE": {
          const normalized = normalizePhone(value);
          const result = await query(
            `SELECT sp.subject_id, sp.full_name, sp.subject_ref, spl.relationship, spl.confidence,
                    pn.raw_value, pn.normalized_value, pn.phone_type
             FROM subject_phone_link spl
             JOIN phone_number pn ON pn.phone_id = spl.phone_id
             JOIN subject_profile sp ON sp.subject_id = spl.subject_id
             WHERE pn.normalized_value = $1 AND sp.is_merged = FALSE`,
            [normalized],
          );
          return { entityType: "PHONE", normalizedValue: normalized, subjects: result.rows };
        }

        case "IDENTITY": {
          if (!doc_type) return send400(reply, "MISSING_DOC_TYPE", "doc_type is required for IDENTITY search");
          const normalized = normalizeIdentityDoc(doc_type, value);
          const result = await query(
            `SELECT sp.subject_id, sp.full_name, sp.subject_ref, sil.confidence,
                    id.document_type, id.document_value
             FROM subject_identity_link sil
             JOIN identity_document id ON id.document_pk = sil.document_pk
             JOIN subject_profile sp ON sp.subject_id = sil.subject_id
             WHERE id.document_type = $1 AND id.normalized_value = $2 AND sp.is_merged = FALSE`,
            [doc_type, normalized],
          );
          return { entityType: "IDENTITY", documentType: doc_type, normalizedValue: normalized, subjects: result.rows };
        }

        case "IMEI": {
          const normalized = normalizeIMEI(value);
          const result = await query(
            `SELECT sp.subject_id, sp.full_name, sp.subject_ref, sdl.relationship, sdl.confidence,
                    d.imei, d.device_model
             FROM subject_device_link sdl
             JOIN device d ON d.device_id = sdl.device_id
             JOIN subject_profile sp ON sp.subject_id = sdl.subject_id
             WHERE d.normalized_imei = $1 AND sp.is_merged = FALSE`,
            [normalized],
          );
          return { entityType: "IMEI", normalizedValue: normalized, subjects: result.rows };
        }

        case "VEHICLE": {
          const normalized = normalizeVehicleReg(value);
          const result = await query(
            `SELECT sp.subject_id, sp.full_name, sp.subject_ref, svl.relationship, svl.confidence,
                    v.registration_no, v.make, v.model
             FROM subject_vehicle_link svl
             JOIN vehicle v ON v.vehicle_id = svl.vehicle_id
             JOIN subject_profile sp ON sp.subject_id = svl.subject_id
             WHERE v.normalized_reg = $1 AND sp.is_merged = FALSE`,
            [normalized],
          );
          return { entityType: "VEHICLE", normalizedValue: normalized, subjects: result.rows };
        }

        case "SOCIAL": {
          const normalized = normalizeSocialHandle(value);
          const result = await query(
            `SELECT sp.subject_id, sp.full_name, sp.subject_ref, socl.relationship, socl.confidence,
                    sa.platform, sa.handle
             FROM subject_social_link socl
             JOIN social_account sa ON sa.social_id = socl.social_id
             JOIN subject_profile sp ON sp.subject_id = socl.subject_id
             WHERE sa.normalized_handle = $1
               AND ($2::text IS NULL OR sa.platform = $2)
               AND sp.is_merged = FALSE`,
            [normalized, platform || null],
          );
          return { entityType: "SOCIAL", normalizedValue: normalized, subjects: result.rows };
        }

        default:
          return send400(reply, "INVALID_TYPE", `Unknown entity type: ${type}`);
      }
    } catch (err: unknown) {
      request.log.error(err, "Entity search failed");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get all linked entities for a subject
  app.get("/api/v1/subjects/:id/entities", {
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const [phones, identities, devices, vehicles, accounts, socials, associates] = await Promise.all([
        query(
          `SELECT pn.phone_id, pn.raw_value, pn.normalized_value, pn.phone_type, spl.relationship, spl.confidence
           FROM subject_phone_link spl JOIN phone_number pn ON pn.phone_id = spl.phone_id
           WHERE spl.subject_id = $1`, [id],
        ),
        query(
          `SELECT id.document_pk, id.document_type, id.document_value, sil.confidence
           FROM subject_identity_link sil JOIN identity_document id ON id.document_pk = sil.document_pk
           WHERE sil.subject_id = $1`, [id],
        ),
        query(
          `SELECT d.device_id, d.imei, d.device_model, sdl.relationship, sdl.confidence
           FROM subject_device_link sdl JOIN device d ON d.device_id = sdl.device_id
           WHERE sdl.subject_id = $1`, [id],
        ),
        query(
          `SELECT v.vehicle_id, v.registration_no, v.make, v.model, svl.relationship, svl.confidence
           FROM subject_vehicle_link svl JOIN vehicle v ON v.vehicle_id = svl.vehicle_id
           WHERE svl.subject_id = $1`, [id],
        ),
        query(
          `SELECT ba.account_id, ba.account_number, ba.ifsc_code, ba.upi_id, ba.bank_name, sal.relationship, sal.confidence
           FROM subject_account_link sal JOIN bank_account ba ON ba.account_id = sal.account_id
           WHERE sal.subject_id = $1`, [id],
        ),
        query(
          `SELECT sa.social_id, sa.platform, sa.handle, sa.risk_score, socl.relationship, socl.confidence
           FROM subject_social_link socl JOIN social_account sa ON sa.social_id = socl.social_id
           WHERE socl.subject_id = $1`, [id],
        ),
        query(
          `SELECT
             CASE WHEN ssl.subject_id_a = $1 THEN ssl.subject_id_b ELSE ssl.subject_id_a END AS linked_subject_id,
             sp.full_name AS linked_name, sp.subject_ref AS linked_ref,
             ssl.relationship, ssl.strength
           FROM subject_subject_link ssl
           JOIN subject_profile sp ON sp.subject_id = CASE WHEN ssl.subject_id_a = $1 THEN ssl.subject_id_b ELSE ssl.subject_id_a END
           WHERE (ssl.subject_id_a = $1 OR ssl.subject_id_b = $1) AND sp.is_merged = FALSE`, [id],
        ),
      ]);

      return {
        phones: phones.rows,
        identities: identities.rows,
        devices: devices.rows,
        vehicles: vehicles.rows,
        accounts: accounts.rows,
        socials: socials.rows,
        associates: associates.rows,
      };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get subject entities");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
