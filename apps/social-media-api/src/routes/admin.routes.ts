import { createAdminRoutes } from "@puda/api-core";
import { query } from "../db";

export const registerAdminRoutes = createAdminRoutes({ queryFn: query });
