import { describe, expect, it } from 'vitest';
import { AGENT_DEFINITIONS } from '@/mock/agent-seed';
import AGENT_TOOLS from '@/mock/agent-tools.json';

// agent-tools.json is the single source for tool allow-lists: the Python runner loads it for
// runtime enforcement (orchestrator.py) and the seed writes it into agents.tools for display.
// This pins the seed side so a hand-edited definition can't silently diverge again.
describe('agent seed tool parity', () => {
  it('every agent definition takes its tools from agent-tools.json', () => {
    for (const agent of AGENT_DEFINITIONS) {
      expect(agent.tools, agent.slug).toEqual(AGENT_TOOLS[agent.slug as keyof typeof AGENT_TOOLS]);
    }
  });

  it('every allow-list in agent-tools.json belongs to a seeded agent', () => {
    const seeded = new Set<string>(AGENT_DEFINITIONS.map((a) => a.slug));
    for (const slug of Object.keys(AGENT_TOOLS)) {
      expect(seeded.has(slug), slug).toBe(true);
    }
  });
});
