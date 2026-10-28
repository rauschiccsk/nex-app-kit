import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// VITE_APP_VERSION is auto-bumped by .githooks/post-commit (0.1.<commit_count>) and shown in the
// sidebar <Brand>. Vite natively exposes any VITE_* var on import.meta.env — no `define` needed.
const apiTarget = process.env.VITE_API_URL ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
