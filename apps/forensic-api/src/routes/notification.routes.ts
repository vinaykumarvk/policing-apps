import { createNotificationRoutes } from "@puda/api-core";
import { query } from "../db";

export const registerNotificationRoutes = createNotificationRoutes({ queryFn: query });
