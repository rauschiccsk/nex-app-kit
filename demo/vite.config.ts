// The demo app — an app on the template exactly as an ICC app will be: it uses the built package (dist), not the
// source, with a server held in memory, so it runs anywhere without a backend (npm run demo / npm run demo:build).
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "nex-app-kit/frame.css": fileURLToPath(new URL("../dist/frame.css", import.meta.url)),
      "nex-app-kit": fileURLToPath(new URL("../dist/index.js", import.meta.url)),
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
