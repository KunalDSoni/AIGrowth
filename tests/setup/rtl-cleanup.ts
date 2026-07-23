import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

/** Unmount rendered components after each test so DOM does not leak across tests. */
afterEach(() => {
  cleanup();
});
