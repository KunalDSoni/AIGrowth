import { join } from "node:path";

/**
 * Single root for every file-backed store.
 *
 * Tests point OPENGROWTH_DATA_DIR at a temp directory so a test run can never
 * write fixture data into the application's real `.data/` folder — that is how
 * fictional workspaces kept reappearing in the running app.
 */
export function dataRoot(): string {
  return process.env.OPENGROWTH_DATA_DIR || join(process.cwd(), ".data");
}

export function dataDir(...segments: string[]): string {
  return join(dataRoot(), ...segments);
}
