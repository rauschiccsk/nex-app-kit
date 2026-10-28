import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  // the contract test runs in node, without a browser
  if (typeof window !== "undefined") window.localStorage.clear();
});
