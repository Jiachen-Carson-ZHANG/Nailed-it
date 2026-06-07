'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getDefaultSettings,
  type GlossaryEntrySettings,
} from '@/data/glossary-settings-store';
import { listMerchantPricingSettingsAction } from '@/lib/actions/merchant-pricing-actions';
import {
  glossarySettingsToMap,
  mergeMerchantPricingIntoDefaults,
} from '@/features/merchant/merge-merchant-pricing-settings';

/** Load merchant price/duration from DB (authoritative) with catalog-default fallbacks while loading. */
export function useMerchantPricingSettings(): {
  settings: GlossaryEntrySettings[];
  settingsById: Map<string, GlossaryEntrySettings>;
  isLoading: boolean;
} {
  const [settings, setSettings] = useState<GlossaryEntrySettings[]>(() => getDefaultSettings());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const db = await listMerchantPricingSettingsAction();
        if (active) setSettings(mergeMerchantPricingIntoDefaults(db));
      } catch {
        // Keep catalog-default fallbacks from getDefaultSettings().
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const settingsById = useMemo(() => glossarySettingsToMap(settings), [settings]);

  return { settings, settingsById, isLoading };
}
