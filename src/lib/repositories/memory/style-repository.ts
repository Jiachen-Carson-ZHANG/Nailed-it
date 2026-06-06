import { styleDefinitions } from '@/mock/styles';
import type { StyleDefinition } from '@/mock/styles';
import type { StyleRepository } from '../types';

export function createMemoryStyleRepository(
  seed: StyleDefinition[] = styleDefinitions,
): StyleRepository {
  const state: StyleDefinition[] = structuredClone(seed);

  return {
    async list(): Promise<StyleDefinition[]> {
      return structuredClone(state);
    },

    async getById(id: string): Promise<StyleDefinition | null> {
      const found = state.find((s) => s.id === id);
      return found ? structuredClone(found) : null;
    },
  };
}
