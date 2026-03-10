import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@puda/shared": path.resolve(__dirname, "../../packages/shared/src"),
      "@puda/nl-assistant": path.resolve(__dirname, "../../packages/nl-assistant/src"),
    },
  },
  server: {
    port: 5173
  }
});
