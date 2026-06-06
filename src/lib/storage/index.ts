import { hasSupabaseEnv } from '@/lib/db/client';
import { createMemoryStyleMediaStorage } from './memory-style-media-storage';
import { createSupabaseStyleMediaStorage } from './supabase-style-media-storage';
import type { StyleMediaStorage } from './types';

let storage: StyleMediaStorage | null = null;

export function getStyleMediaStorage(): StyleMediaStorage {
  if (!storage) {
    const useSupabase = hasSupabaseEnv() && process.env.NODE_ENV !== 'test' && !process.env.VITEST;
    storage = useSupabase ? createSupabaseStyleMediaStorage() : createMemoryStyleMediaStorage();
  }
  return storage;
}

export function resetStyleMediaStorageForTests(): void {
  storage = null;
}

export type { StyleMediaStorage } from './types';
