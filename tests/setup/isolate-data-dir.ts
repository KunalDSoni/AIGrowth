import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Every file-backed store reads its root from OPENGROWTH_DATA_DIR. Point it at
 * a throwaway directory before any test module loads, so a test run can never
 * write fixture data into the application's real `.data/` folder.
 */
process.env.OPENGROWTH_DATA_DIR = mkdtempSync(join(tmpdir(), "opengrowth-test-"));
