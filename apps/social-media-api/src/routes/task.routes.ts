import { createTaskRoutes } from "@puda/api-core";
import { query } from "../db";
import { executeTransition } from "../workflow-bridge";

export const registerTaskRoutes = createTaskRoutes({
  queryFn: query,
  taskTableName: "case_task",
  executeTransition,
});
