// lib/windtunnel/calibration.ts
import type { CalibrationRecord } from "./types";

export interface CalibrationTracker {
  record(r: CalibrationRecord): void;
  hitRate(): { hits: number; total: number; rate: number };
}

export function createCalibrationTracker(seed: CalibrationRecord[] = []): CalibrationTracker {
  const records: CalibrationRecord[] = [...seed];
  return {
    record: (r) => {
      records.push(r);
    },
    hitRate: () => {
      const total = records.length;
      const hits = records.filter((r) => r.predictedWinnerVariantId === r.actualWinnerVariantId).length;
      return { hits, total, rate: total > 0 ? hits / total : 0 };
    },
  };
}
