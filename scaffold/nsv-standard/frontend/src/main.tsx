import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./index.css";
import { isPreviewEnabled } from "./preview/isPreview";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

function render() {
  createRoot(root!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// The Vizuál preview runs WITHOUT a server: the answers must stand BEFORE the first render, or the first calls go to
// a server that is not there (ICCINT-94). Two conditions, each doing something else — do not merge them (ICCINT-107):
// `import.meta.env.VITE_PREVIEW` is a static guard (the build drops the whole branch, MSW never ships), and
// `isPreviewEnabled()` decides, against the list of switching-on values (preview/isPreview.ts).
if (import.meta.env.VITE_PREVIEW && isPreviewEnabled()) {
  void import("./preview/browser").then(({ startPreview }) => startPreview().then(render));
} else {
  render();
}
