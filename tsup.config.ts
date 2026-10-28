import { defineConfig } from "tsup";

// The kit ships prebuilt ESM + d.ts in dist/ (committed — apps install it from a pinned git tag without a build on
// install, the same way as nex-shared). Everything the app already has is external, so the app's own React, router,
// store and nex-shared are the ones in use.
export default defineConfig({
  entry: ["src/index.ts", "src/preview.ts"],
  format: ["esm"],
  dts: true,
  external: ["react", "react-dom", "react-router-dom", "zustand", "zustand/middleware", "zustand/vanilla", "react-markdown", "remark-gfm", "nex-shared", "msw"],
  clean: true,
});
