import { usesSupabaseBackend } from '@/lib/db/client';
import { createMemoryStyleMediaStorage } from './memory-style-media-storage';
import { createSupabaseStyleMediaStorage } from './supabase-style-media-storage';
import type { StyleMediaStorage } from './types';

let storage: StyleMediaStorage | null = null;

export function getStyleMediaStorage(): StyleMediaStorage {
  if (!storage) {
    storage = usesSupabaseBackend() ? createSupabaseStyleMediaStorage() : createMemoryStyleMediaStorage();
  }
  return storage;
}

export function resetStyleMediaStorageForTests(): void {
  storage = null;
}

export type { StyleMediaStorage } from './types';
