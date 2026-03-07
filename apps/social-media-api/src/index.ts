import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", "..", "..", ".env") });

async function main() {
  const { buildApp } = await import("./app");
  const app = await buildApp(true);
  const port = Number(process.env.PORT || process.env.SM_API_PORT || 3004);
  const host = process.env.SM_API_HOST || "0.0.0.0";

  const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS) || 15_000;
  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    app.log.info(`Received ${signal}, shutting down gracefully…`);

    const forceExit = setTimeout(() => {
      app.log.error("Graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    try {
      const { stopConnectorScheduler } = await import("./connector-scheduler");
      stopConnectorScheduler();
      const { stopSlaScheduler } = await import("./sla-scheduler");
      stopSlaScheduler();
      await app.close();
      const { pool } = await import("./db");
      await pool.end();
      clearTimeout(forceExit);
      app.log.info("Graceful shutdown complete");
      process.exit(0);
    } catch (err) {
      clearTimeout(forceExit);
      app.log.error(err, "Error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    app.log.error({ reason: String(reason) }, "Unhandled promise rejection — shutting down");
    process.exit(1);
  });
  process.on("uncaughtException", (err) => {
    app.log.error(err, "Uncaught exception — shutting down");
    process.exit(1);
  });

  try {
    await app.listen({ port, host });
    app.log.info(`Social Media API listening on ${host}:${port}`);

    const { startSlaScheduler } = await import("./sla-scheduler");
    startSlaScheduler();

    const { startConnectorScheduler } = await import("./connector-scheduler");
    startConnectorScheduler();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
