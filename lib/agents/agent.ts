/**
 * The agent contract.
 *
 * No agent knows which client or industry it serves. Both arrive via RunContext.
 * shouldRun() must decide cheaply — it protects margin by skipping work before
 * any token is spent.
 */

import type { RuntimeStore } from "@/lib/agents/store";
import type { AgentName, ClientRecord, Run, RunStep, StepResult } from "@/lib/agents/types";

export interface RunContext {
  client: ClientRecord;
  run: Run;
  step: RunStep;
  store: RuntimeStore;
  now: () => Date;
}

export interface ShouldRunVerdict {
  run: boolean;
  reason: string;
}

export interface Agent {
  name: AgentName;
  costClass: "cheap" | "moderate" | "expensive";
  shouldRun(ctx: RunContext): Promise<ShouldRunVerdict>;
  execute(ctx: RunContext): Promise<StepResult>;
}
