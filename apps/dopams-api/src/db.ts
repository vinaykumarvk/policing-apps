import dotenv from "dotenv";
import path from "path";
import { createPool } from "@puda/api-core";
import { logWarn } from "./logger";

dotenv.config({ path: path.resolve(__dirname, "..", "..", "..", ".env") });

const db = createPool({
  envPrefix: "DOPAMS",
  defaultTestUrl: "postgres://puda:puda@localhost:5432/dopams",
  logWarnFn: logWarn,
});

export const pool = db.pool;
export const query = db.query;
export const getClient = db.getClient;
