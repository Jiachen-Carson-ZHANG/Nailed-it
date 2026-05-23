import type { PricingItem } from '@/domain/nail';

export const defaultPricingRules: PricingItem[] = [
  { id: 'base-removal', category: 'base', target: 'removal', price: 10, duration: 15, enabled: true },
  { id: 'base-extension', category: 'base', target: 'extension', price: 25, duration: 30, enabled: true },
  { id: 'base-builder-gel', category: 'base', target: 'builderGel', price: 20, duration: 20, enabled: true },
  { id: 'shape-round', category: 'shape', target: 'round', price: 0, duration: 0, enabled: true },
  { id: 'shape-square', category: 'shape', target: 'square', price: 0, duration: 0, enabled: true },
  { id: 'shape-squoval', category: 'shape', target: 'squoval', price: 3, duration: 5, enabled: true },
  { id: 'shape-oval', category: 'shape', target: 'oval', price: 3, duration: 5, enabled: true },
  { id: 'shape-almond', category: 'shape', target: 'almond', price: 5, duration: 5, enabled: true },
  { id: 'shape-coffin', category: 'shape', target: 'coffin', price: 8, duration: 10, enabled: true },
  { id: 'shape-stiletto', category: 'shape', target: 'stiletto', price: 10, duration: 12, enabled: true },
  { id: 'style-solid', category: 'style', target: 'solid', price: 30, duration: 40, enabled: true },
  { id: 'style-french', category: 'style', target: 'french', price: 42, duration: 55, enabled: true },
  { id: 'style-cat-eye', category: 'style', target: 'catEye', price: 50, duration: 60, enabled: true },
  { id: 'style-chrome', category: 'style', target: 'chrome', price: 48, duration: 58, enabled: true },
  { id: 'style-rhinestone', category: 'style', target: 'rhinestone', price: 35, duration: 45, enabled: true },
  { id: 'addon-rhinestone', category: 'addon', target: 'rhinestone', price: 20, duration: 20, enabled: true },
  { id: 'addon-charms', category: 'addon', target: 'charms', price: 22, duration: 18, enabled: true },
  { id: 'addon-glitter', category: 'addon', target: 'glitter', price: 12, duration: 12, enabled: true }
];
