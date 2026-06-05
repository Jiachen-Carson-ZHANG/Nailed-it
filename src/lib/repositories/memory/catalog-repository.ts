import type { CatalogItem, CatalogItemType } from '@/domain/catalog';
import { catalogItems } from '@/mock/catalog';
import type { CatalogRepository } from '../types';

export function createMemoryCatalogRepository(
  seed: CatalogItem[] = catalogItems,
): CatalogRepository {
  const state: CatalogItem[] = structuredClone(seed);

  return {
    async list(): Promise<CatalogItem[]> {
      return structuredClone(state);
    },

    async getById(id: string): Promise<CatalogItem | null> {
      const found = state.find((item) => item.id === id);
      return found ? structuredClone(found) : null;
    },

    async listByType(type: CatalogItemType): Promise<CatalogItem[]> {
      return structuredClone(state.filter((item) => item.type === type));
    },
  };
}
