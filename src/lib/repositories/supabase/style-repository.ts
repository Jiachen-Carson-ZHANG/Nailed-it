import { getServiceClient } from '@/lib/db/client';
import type { StyleDefinition } from '@/mock/styles';
import type { StyleDiscoveryFacet, AIRecognitionResult } from '@/domain/nail';
import type { LocalizedText } from '@/i18n/types';
import type { StyleRepository } from '../types';

interface StyleRow {
  id: string;
  title: string;
  image_url: string;
  popularity_score: number;
  discovery_facets: StyleDiscoveryFacet[];
  recognition: AIRecognitionResult;
  title_localized?: LocalizedText;
  description_localized?: LocalizedText;
}

function rowToStyleDefinition(row: StyleRow): StyleDefinition {
  return {
    id: row.id,
    title: row.title,
    titleLocalized: row.title_localized ?? { 'zh-CN': row.title, en: row.title },
    descriptionLocalized: row.description_localized ?? { 'zh-CN': '', en: '' },
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
