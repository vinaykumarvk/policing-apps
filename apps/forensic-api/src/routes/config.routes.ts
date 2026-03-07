import path from "path";
import { createConfigRoutes } from "@puda/api-core";
import { query } from "../db";

export const registerConfigRoutes = createConfigRoutes({
  queryFn: query,
  workflowDefinitionsDir: path.resolve(__dirname, "..", "workflow-definitions"),
});
