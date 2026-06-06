import { billableComponents } from './glossary';

const STORAGE_KEY = 'nailed-it.glossary-settings.v1';

export type GlossaryEntrySettings = {
  id: string;
  price: number;
  duration: number;
  enabled: boolean;
};

export function getDefaultSettings(): GlossaryEntrySettings[] {
  return billableComponents.map((entry) => ({
    id: entry.id,
    price: 0,
    duration: entry.default_duration_min,
    enabled: true
  }));
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadGlossarySettings(): GlossaryEntrySettings[] {
  const storage = getStorage();
  if (!storage) return getDefaultSettings();

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return getDefaultSettings();

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return getDefaultSettings();

    const defaults = getDefaultSettings();
    const savedById = new Map<string, GlossaryEntrySettings>(
      (parsed as GlossaryEntrySettings[])
        .filter((s) => s && typeof s.id === 'string')
        .map((s) => [s.id, s])
    );

    return defaults.map((def) => {
      const saved = savedById.get(def.id);
      if (!saved) return def;
      return {
        id: def.id,
        price: typeof saved.price === 'number' ? saved.price : def.price,
        duration: typeof saved.duration === 'number' ? saved.duration : def.duration,
        enabled: typeof saved.enabled === 'boolean' ? saved.enabled : def.enabled
      };
    });
  } catch {
    return getDefaultSettings();
  }
}

export function saveGlossarySettings(settings: GlossaryEntrySettings[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    console.warn('Unable to persist glossary settings to localStorage.');
  }
}
