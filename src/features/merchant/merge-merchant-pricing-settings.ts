import {
  getDefaultSettings,
  type GlossaryEntrySettings,
} from '@/data/glossary-settings-store';
import type { MerchantPricingSetting } from '@/domain/merchant';

/** Overlay DB-effective merchant pricing onto the full glossary UI entry set (incl. time-only procedures). */
export function mergeMerchantPricingIntoDefaults(
  db: MerchantPricingSetting[],
): GlossaryEntrySettings[] {
  const dbById = new Map(db.map((row) => [row.id, row]));
  return getDefaultSettings().map((entry) => {
    const row = dbById.get(entry.id);
    if (!row) return entry;
    return {
      ...entry,
      price: row.price,
      duration: row.duration,
      enabled: row.enabled,
    };
  });
}

export function glossarySettingsToMap(
  settings: GlossaryEntrySettings[],
): Map<string, GlossaryEntrySettings> {
  return new Map(settings.map((s) => [s.id, s]));
}
