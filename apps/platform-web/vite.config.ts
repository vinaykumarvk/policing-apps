import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5176,
    proxy: {
      "/api/v1/platform": {
        target: process.env.VITE_PLATFORM_API_PROXY_TARGET ?? "http://localhost:8080",
        changeOrigin: true,
      },
      // App-launch handoff: /domains/<app> is served by platform-api (the gateway),
      // which validates the session + entitlement and 302-redirects to the target UI.
      // Local dev replicates nginx.platform.conf's /domains/* routing.
      "/domains": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
