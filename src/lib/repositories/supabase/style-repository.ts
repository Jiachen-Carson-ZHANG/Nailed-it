import { getServiceClient } from '@/lib/db/client';
import type { StyleDefinition } from '@/mock/styles';
import type { StyleDiscoveryFacet, AIRecognitionResult } from '@/domain/nail';
import type { StyleRepository } from '../types';

interface StyleRow {
  id: string;
  title: string;
  image_url: string;
  popularity_score: number;
  discovery_facets: StyleDiscoveryFacet[];
  recognition: AIRecognitionResult;
}

function rowToStyleDefinition(row: StyleRow): StyleDefinition {
  return {
    id: row.id,
    title: row.title,
    imageUrl: row.image_url,
    popularityScore: row.popularity_score,
    discoveryFacets: row.discovery_facets,
    recognition: row.recognition,
  };
}

export function createSupabaseStyleRepository(): StyleRepository {
  return {
    async list(): Promise<StyleDefinition[]> {
      const { data, error } = await getServiceClient()
        .from('styles')
        .select('*');
      if (error) {
        throw new Error(`StyleRepository.list failed: ${error.message}`);
      }
      return (data as StyleRow[]).map(rowToStyleDefinition);
    },

    async getById(id: string): Promise<StyleDefinition | null> {
      const { data, error } = await getServiceClient()
        .from('styles')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        throw new Error(`StyleRepository.getById failed: ${error.message}`);
      }
      return data ? rowToStyleDefinition(data as StyleRow) : null;
    },
  };
}
