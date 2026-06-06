import type { BreakdownResult, GlossaryBreakdownItem } from '@/domain/nail';
import type { MerchantPricingSetting } from '@/domain/merchant';
import {
  aiDetectableComponents,
  aiDetectableVisualAttributes,
  aiDetectableStyleTags,
  allProcedures,
  complexityLevels,
  serviceModules,
  glossaryById
} from '@/data/glossary';
import { postOpenRouterChat, extractTextContent, stripJsonFence, asRecord } from './openrouter';
import { defaultTryOnModel } from './try-on';

export class BreakdownError extends Error {
  constructor(
    public readonly code: 'missing_config' | 'provider_error' | 'invalid_model_output',
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'BreakdownError';
  }
}

async function callOpenRouterWithImage(opts: {
  apiKey: string;
  model: string;
  imageBase64: string;
  mimeType: string;
  prompt: string;
}): Promise<unknown> {
  let data: unknown;
  try {
    data = await postOpenRouterChat(
      {
        model: opts.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${opts.mimeType};base64,${opts.imageBase64}` } },
              { type: 'text', text: opts.prompt }
            ]
          }
        ]
      },
      opts.apiKey
    );
  } catch (error) {
    throw new BreakdownError('provider_error', 'OpenRouter breakdown request failed.', { cause: error });
  }

  try {
    const text = extractTextContent(data);
    return JSON.parse(stripJsonFence(text));
  } catch (error) {
    throw new BreakdownError('invalid_model_output', 'OpenRouter breakdown response did not include valid JSON.', {
      cause: error
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function idList(entries: { id: string; name_zh: string }[]): string {
  return entries.map((e) => `  - ${e.id} (${e.name_zh})`).join('\n');
}

function buildPrompt(): string {
  // ── Part A: Service modules ─────────────────────────────────────────────────
  const smList = idList(serviceModules.filter((e) => e.ai_detectable !== 'no'));

  // ── Part B: Billable components grouped by service module ───────────────────
  const byModule = new Map<string, typeof aiDetectableComponents>();
  for (const entry of aiDetectableComponents) {
    const list = byModule.get(entry.parent_id) ?? [];
    list.push(entry);
    byModule.set(entry.parent_id, list);
  }

  const moduleGuide: Record<string, string> = {
    extension_service:    'Are the nails extended? What length?',
    builder_service:      'Is builder gel or structural thickness visible?',
    color_effect_service: 'List EVERY color treatment and effect (ombre, cat-eye, chrome, glitter, translucent, etc.).',
    art_service:          'List ALL nail art (french, hand-paint, line art, 3D, patterns).',
    decoration_service:   'List ALL decorations (rhinestones, pearls, charms, foil, stickers) with quantities.',
    finish_service:       'Any special finish such as matte top coat?',
  };

  const moduleOrder = [
    'extension_service', 'builder_service', 'color_effect_service',
    'art_service', 'decoration_service', 'finish_service',
  ];

  const billableSections = moduleOrder
    .map((mid) => {
      const entries = byModule.get(mid);
      if (!entries?.length) return null;
      const name = glossaryById.get(mid)?.name_zh ?? mid;
      return `[${name} — 收费组件]\nHint: ${moduleGuide[mid] ?? ''}\n${idList(entries)}`;
    })
    .filter(Boolean)
    .join('\n\n');

  // ── Part C: Procedures — infer from image context ───────────────────────────
  const proceduresByModule = new Map<string, typeof allProcedures>();
  for (const p of allProcedures) {
    const list = proceduresByModule.get(p.parent_id) ?? [];
    list.push(p);
    proceduresByModule.set(p.parent_id, list);
  }
  const procedureSections = [...proceduresByModule.entries()]
    .map(([moduleId, procs]) => {
      const name = glossaryById.get(moduleId)?.name_zh ?? moduleId;
      return `[${name} — 工序]\n${idList(procs)}`;
    })
    .join('\n\n');

  // ── Part D: Visual attributes ───────────────────────────────────────────────
  const colourList  = idList(aiDetectableVisualAttributes.filter((e) => e.category === 'color'));
  const shapeList   = idList(aiDetectableVisualAttributes.filter((e) => e.category === 'nail_shape'));
  const lengthList  = idList(aiDetectableVisualAttributes.filter((e) => e.category === 'nail_length'));
  const textureList = idList(aiDetectableVisualAttributes.filter((e) => e.category === 'texture'));

  // ── Part E: Complexity level ────────────────────────────────────────────────
  const complexityList = idList(complexityLevels);

  // ── Part F: Style tags ──────────────────────────────────────────────────────
  const styleList = idList(aiDetectableStyleTags);

  return [
    'You are an expert nail technician analysing a nail photograph.',
    'Your task: produce a comprehensive, structured JSON breakdown covering ALL six categories below.',
    '',
    'Return ONLY valid JSON with NO markdown fences, in exactly this shape:',
    '{',
    '  "service_modules":    [{"id":"...", "quantity":1, "unit":"set"}, ...],',
    '  "billable_components":[{"id":"...", "quantity":1, "unit":"set|finger|piece"}, ...],',
    '  "procedures":         [{"id":"...", "quantity":1, "unit":"set"}, ...],',
    '  "visual_attributes":  [{"id":"...", "quantity":1, "unit":"set"}, ...],',
    '  "complexity_level":   [{"id":"...", "quantity":1, "unit":"set"}],',
    '  "style_tags":         [{"id":"...", "quantity":1, "unit":"set"}, ...]',
    '}',
    '',
    'GENERAL RULES:',
    '- Use ONLY exact IDs from the lists below. Never invent IDs.',
    '- Be COMPREHENSIVE — go through every section carefully. Missing items is a bigger error than including an uncertain one.',
    '- solid_color: include if any solid base color is visible (almost always yes).',
    '- Rhinestones/charms: estimate total count across all nails.',
    '- Per-finger art: quantity = number of affected fingers.',
    '',
    '=== A. 服务模块 (service_modules) ===',
    'Include every service module that applies to this nail set.',
    smList,
    '',
    '=== B. 收费组件 (billable_components) ===',
    'Go through EVERY module block below. Include ALL matching components.',
    billableSections,
    '',
    '=== C. 工序 (procedures) ===',
    'Include all procedures that would be performed given the services detected in A.',
    'These are inferred from the style — not directly visible.',
    procedureSections,
    '',
    '=== D. 视觉属性 (visual_attributes) ===',
    'Mandatory: pick AT LEAST ONE colour, ONE shape, ONE length, and ALL applicable textures.',
    `[颜色 — pick ALL]\n${colourList}`,
    '',
    `[甲型 — pick ONE]\n${shapeList}`,
    '',
    `[甲长 — pick ONE]\n${lengthList}`,
    '',
    `[质感 — pick ALL that apply]\n${textureList}`,
    '',
    '=== E. 复杂度等级 (complexity_level) ===',
    'Pick exactly ONE based on overall nail complexity.',
    complexityList,
    '',
    '=== F. 风格标签 (style_tags) ===',
    'Pick ALL matching style descriptors.',
    styleList,
  ].join('\n');
}

// ── Main function ─────────────────────────────────────────────────────────────

export async function runGlossaryBreakdown(
  imageBase64: string,
  mimeType: string,
  merchantSettings: MerchantPricingSetting[],
  env = process.env
): Promise<BreakdownResult> {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) throw new BreakdownError('missing_config', 'OPENROUTER_API_KEY is required for breakdown.');

  const model = env.GEMINI_IMAGE_MODEL_NAME ?? defaultTryOnModel;
  const raw = asRecord(
    await callOpenRouterWithImage({ apiKey, model, imageBase64, mimeType, prompt: buildPrompt() })
  );

  const settingsById = new Map<string, MerchantPricingSetting>(
    merchantSettings.map((s) => [s.id, s])
  );

  type RawSection = 'service_modules' | 'billable_components' | 'procedures' | 'visual_attributes' | 'complexity_level' | 'style_tags';
  type GlossaryTypeName = GlossaryBreakdownItem['glossaryType'];

  const sectionTypeMap: Record<RawSection, GlossaryTypeName> = {
    service_modules:    'service_module',
    billable_components:'billable_component',
    procedures:         'procedure',
    visual_attributes:  'visual_attribute',
    complexity_level:   'complexity_level',
    style_tags:         'style_tag',
  };

  function parseSection(section: RawSection): GlossaryBreakdownItem[] {
    const rawArray = Array.isArray(raw[section]) ? (raw[section] as unknown[]) : [];
    const glossaryType = sectionTypeMap[section];

    return rawArray
      .map((d: unknown) => {
        const det = asRecord(d);
        const id = typeof det.id === 'string' ? det.id.trim() : '';
        const entry = glossaryById.get(id);
        if (!entry) return null;

        const settings = settingsById.get(id);
        const allowPricing = Boolean(settings);
        const isEnabled = settings?.enabled !== false;
        const price = (allowPricing && isEnabled) ? (settings?.price ?? 0) : 0;
        const duration = (allowPricing && isEnabled) ? (settings?.duration ?? entry.default_duration_min) : 0;

        const quantity = typeof det.quantity === 'number' && det.quantity >= 1 ? Math.round(det.quantity) : 1;
        const unit = typeof det.unit === 'string' ? det.unit.trim() : entry.default_pricing_unit;

        const parentEntry = glossaryById.get(entry.parent_id);
        const parentNameZh = parentEntry?.name_zh ?? entry.type_zh;

        return {
          mode: 'glossary' as const,
          glossaryId: id,
          glossaryType,
          nameZh: entry.name_zh,
          typeZh: entry.type_zh,
          parentId: entry.parent_id,
          parentNameZh,
          quantity,
          unit,
          price,
          duration,
        } satisfies GlossaryBreakdownItem;
      })
      .filter((item): item is GlossaryBreakdownItem => item !== null);
  }

  const sections: RawSection[] = [
    'service_modules', 'billable_components', 'procedures',
    'visual_attributes', 'complexity_level', 'style_tags',
  ];

  const items = sections.flatMap(parseSection);
  const selectionById = new Map<string, number>();
  for (const item of items) {
    if (!settingsById.has(item.glossaryId)) continue;
    selectionById.set(item.glossaryId, (selectionById.get(item.glossaryId) ?? 0) + item.quantity);
  }
  const catalogSelections = [...selectionById].map(([catalogItemId, quantity]) => ({
    catalogItemId,
    quantity,
  }));
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalDuration = items.reduce((sum, item) => sum + item.duration, 0);

  return { items, catalogSelections, totalPrice, totalDuration, mode: 'glossary' };
}
