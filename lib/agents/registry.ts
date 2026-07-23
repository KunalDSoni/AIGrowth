import type { Agent } from "@/lib/agents/agent";
import type { AgentName } from "@/lib/agents/types";

/** Pipeline order. Each agent may read what earlier agents wrote in the same run. */
export const DEFAULT_PIPELINE: AgentName[] = [
  "observer",
  "onboarding",
  "diagnosis",
  "strategist",
  "packager",
  "compliance",
  "reporter",
];

export interface AgentRegistry {
  get(name: AgentName): Agent;
  has(name: AgentName): boolean;
}

export function createRegistry(agents: Agent[]): AgentRegistry {
  const byName = new Map<AgentName, Agent>();
  for (const agent of agents) {
    if (byName.has(agent.name)) {
      throw new Error(`Duplicate agent registration: ${agent.name}`);
    }
    byName.set(agent.name, agent);
  }

  return {
    get(name) {
      const agent = byName.get(name);
      if (!agent) throw new Error(`No agent registered for: ${name}`);
      return agent;
    },
    has(name) {
      return byName.has(name);
    },
  };
}
