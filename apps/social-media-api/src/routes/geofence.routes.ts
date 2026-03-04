import { FastifyInstance } from "fastify";
import {
  createGeofence, listGeofences, getGeofence, deleteGeofence,
  checkPoint, getGeofenceEvents,
  createTowerDump, uploadTowerDumpRecords, getTowerDump, getTowerDumpRanked, listTowerDumps
} from "../services/geofence";
import { sendError } from "../errors";

export async function registerGeofenceRoutes(app: FastifyInstance): Promise<void> {
  // Geofence CRUD
  app.post("/api/v1/geofences", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["name", "geometry"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 200 },
          description: { type: "string", maxLength: 1000 },
          geometry: {
            type: "object",
            additionalProperties: false,
            required: ["type", "coordinates"],
            properties: {
              type: { type: "string", enum: ["Polygon", "Circle", "Point"] },
              coordinates: { type: "array", items: { type: "number" } }
            }
          },
          radius: { type: "number", minimum: 0, maximum: 100000 },
          active: { type: "boolean" },
          entityType: { type: "string", maxLength: 100 },
          entityId: { type: "string", maxLength: 200 },
          caseId: { type: "string", maxLength: 200 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const body = request.body as any;
      const userId = (request as any).authUser?.userId;
      const unitId = (request as any).authUser?.unitId;
      const result = await createGeofence({ ...body, createdBy: userId, unitId });
      return reply.code(201).send(result);
    } catch (err: unknown) {
      request.log.error(err, "Failed to create geofence");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.get("/api/v1/geofences", async (request, reply) => {
    try {
      const unitId = (request as any).authUser?.unitId;
      return { geofences: await listGeofences(unitId) };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list geofences");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.get("/api/v1/geofences/:geofenceId", async (request, reply) => {
    try {
      const { geofenceId } = request.params as { geofenceId: string };
      const fence = await getGeofence(geofenceId);
      if (!fence) return sendError(reply, 404, "NOT_FOUND", "Geofence not found");
      return fence;
    } catch (err: unknown) {
      request.log.error(err, "Failed to get geofence");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.delete("/api/v1/geofences/:geofenceId", async (request, reply) => {
    try {
      const { geofenceId } = request.params as { geofenceId: string };
      await deleteGeofence(geofenceId);
      return { success: true };
    } catch (err: unknown) {
      request.log.error(err, "Failed to delete geofence");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Check point against fences
  app.post("/api/v1/geofences/check", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["latitude", "longitude"],
        properties: {
          latitude: { type: "number", minimum: -90, maximum: 90 },
          longitude: { type: "number", minimum: -180, maximum: 180 },
          entityType: { type: "string", maxLength: 100 },
          entityId: { type: "string", maxLength: 200 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { latitude, longitude, entityType, entityId } = request.body as any;
      if (latitude == null || longitude == null) {
        return sendError(reply, 400, "VALIDATION_ERROR", "latitude and longitude are required");
      }
      const triggers = await checkPoint(latitude, longitude, entityType, entityId);
      return { triggers, triggered: triggers.length > 0 };
    } catch (err: unknown) {
      request.log.error(err, "Failed to check geofence point");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Geofence events
  app.get("/api/v1/geofences/:geofenceId/events", async (request, reply) => {
    try {
      const { geofenceId } = request.params as { geofenceId: string };
      const { limit } = request.query as { limit?: string };
      return { events: await getGeofenceEvents(geofenceId, parseInt(limit || "50", 10)) };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get geofence events");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Tower dump endpoints
  app.post("/api/v1/tower-dumps", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["towerName", "latitude", "longitude", "startTime", "endTime"],
        properties: {
          towerName: { type: "string", minLength: 1, maxLength: 200 },
          towerId: { type: "string", maxLength: 200 },
          latitude: { type: "number", minimum: -90, maximum: 90 },
          longitude: { type: "number", minimum: -180, maximum: 180 },
          radius: { type: "number", minimum: 0, maximum: 100000 },
          startTime: { type: "string", format: "date-time" },
          endTime: { type: "string", format: "date-time" },
          caseId: { type: "string", maxLength: 200 },
          description: { type: "string", maxLength: 1000 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const body = request.body as any;
      const userId = (request as any).authUser?.userId;
      const result = await createTowerDump({ ...body, createdBy: userId });
      return reply.code(201).send(result);
    } catch (err: unknown) {
      request.log.error(err, "Failed to create tower dump");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.get("/api/v1/tower-dumps", async (request, reply) => {
    try {
      return { dumps: await listTowerDumps() };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list tower dumps");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.get("/api/v1/tower-dumps/:dumpId", async (request, reply) => {
    try {
      const { dumpId } = request.params as { dumpId: string };
      const dump = await getTowerDump(dumpId);
      if (!dump) return sendError(reply, 404, "NOT_FOUND", "Tower dump not found");
      return dump;
    } catch (err: unknown) {
      request.log.error(err, "Failed to get tower dump");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Upload CDR records to a tower dump
  app.post("/api/v1/tower-dumps/:dumpId/records", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["records"],
        properties: {
          records: {
            type: "array",
            minItems: 1,
            maxItems: 10000,
            items: {
              type: "object",
              properties: {
                msisdn: { type: "string", maxLength: 50 },
                imei: { type: "string", maxLength: 50 },
                imsi: { type: "string", maxLength: 50 },
                callTime: { type: "string", format: "date-time" },
                duration: { type: "number", minimum: 0 },
                callType: { type: "string", maxLength: 50 },
                otherNumber: { type: "string", maxLength: 50 }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { dumpId } = request.params as { dumpId: string };
      const { records } = request.body as { records: any[] };
      if (!records || !Array.isArray(records)) {
        return sendError(reply, 400, "VALIDATION_ERROR", "records array is required");
      }
      const result = await uploadTowerDumpRecords(dumpId, records);
      return result;
    } catch (err: unknown) {
      request.log.error(err, "Failed to upload tower dump records");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get ranked CDR analysis
  app.get("/api/v1/tower-dumps/:dumpId/ranked", async (request, reply) => {
    try {
      const { dumpId } = request.params as { dumpId: string };
      const { limit } = request.query as { limit?: string };
      return { records: await getTowerDumpRanked(dumpId, parseInt(limit || "50", 10)) };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get ranked tower dump records");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
