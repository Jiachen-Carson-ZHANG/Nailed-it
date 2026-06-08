import type { BreakdownResult, GlossaryBreakdownItem } from '@/domain/nail';
import type { MerchantPricingSetting } from '@/domain/merchant';
import type { AppLanguage } from '@/i18n/types';
import { pricingUnits, type PricingUnit } from '@/domain/catalog';
import { normalizeQuantityForPricingUnit } from '@/domain/catalog-selection';
import {
  aiDetectableComponents,
  aiDetectableVisualAttributes,
  aiDetectableStyleTags,
  allProcedures,
  complexityLevels,
  serviceModules,
  glossaryById
} from '@/data/glossary';
import {
  postOpenRouterChat,
  extractTextContent,
  stripJsonFence,
  type OpenRouterJsonSchemaResponseFormat,
} from './openrouter';
import { defaultTryOnModel } from './try-on';

export class BreakdownError extends Error {
  constructor(
    public readonly code: 'missing_config' | 'provider_error' | 'invalid_model_output' | 'invalid_input',
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
  structured?: boolean;
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
        ],
        ...(opts.structured && {
          response_format: breakdownResponseFormat,
          provider: { require_parameters: true },
          plugins: [{ id: 'response-healing' }],
        }),
      },
      opts.apiKey
    );
  } catch (error) {
    if (!opts.structured) return null;
    throw new BreakdownError('provider_error', 'OpenRouter breakdown request failed.', { cause: error });
  }

  try {
    const text = extractTextContent(data);
    return JSON.parse(stripJsonFence(text));
  } catch (error) {
    if (!opts.structured) return null;
    throw new BreakdownError('invalid_model_output', 'OpenRouter breakdown response did not include valid JSON.', {
      cause: error
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const rawSections = [
  'service_modules',
  'billable_components',
  'procedures',
  'visual_attributes',
  'complexity_level',
  'style_tags',
] as const;
type RawSection = (typeof rawSections)[number];
type GlossaryTypeName = GlossaryBreakdownItem['glossaryType'];

const sectionTypeMap: Record<RawSection, GlossaryTypeName> = {
  service_modules: 'service_module',
  billable_components: 'billable_component',
  procedures: 'procedure',
  visual_attributes: 'visual_attribute',
  complexity_level: 'complexity_level',
  style_tags: 'style_tag',
};

const allowedIdsBySection: Record<RawSection, Set<string>> = {
  service_modules: new Set(serviceModules.filter((entry) => entry.ai_detectable !== 'no').map((entry) => entry.id)),
  billable_components: new Set(aiDetectableComponents.map((entry) => entry.id)),
  procedures: new Set(allProcedures.map((entry) => entry.id)),
  visual_attributes: new Set(aiDetectableVisualAttributes.map((entry) => entry.id)),
  complexity_level: new Set(complexityLevels.map((entry) => entry.id)),
  style_tags: new Set(aiDetectableStyleTags.map((entry) => entry.id)),
};

const modelUnits = ['set', 'finger', 'piece'] as const;

function itemSchema(ids: string[]): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'quantity', 'unit'],
    properties: {
      id: { type: 'string', enum: ids },
      quantity: { type: 'integer', minimum: 1, maximum: 100 },
      unit: { type: 'string', enum: modelUnits },
    },
  };
}

export const breakdownResponseFormat: OpenRouterJsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'nail_style_breakdown',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: rawSections,
      properties: Object.fromEntries(
        rawSections.map((section) => [
          section,
          {
            type: 'array',
            items: itemSchema([...allowedIdsBySection[section]]),
          },
        ]),
      ),
    },
  },
};

function invalidModelOutput(message: string): never {
  throw new BreakdownError('invalid_model_output', `invalid_model_output: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isPricingUnit(value: string): value is PricingUnit {
  return pricingUnits.includes(value as PricingUnit);
}

const BASE_MANICURE_ID = 'basic_manicure_service';

// Build the base-manicure breakdown row from merchant settings + glossary. Its booking time is the sum
// of its non-billable prep steps (clean / cuticle / shape …), matching effectiveDurationMin / quoteService.
function baseManicureItem(
  settingsById: Map<string, MerchantPricingSetting>,
): GlossaryBreakdownItem | null {
  const entry = glossaryById.get(BASE_MANICURE_ID);
  const setting = settingsById.get(BASE_MANICURE_ID);
  if (!entry || !setting || setting.enabled === false) return null;
  const prepDuration = Array.from(glossaryById.values())
    .filter((e) => e.parent_id === BASE_MANICURE_ID && e.billable === false)
    .reduce((sum, e) => sum + e.default_duration_min, 0);
  return {
    mode: 'glossary',
    glossaryId: BASE_MANICURE_ID,
    glossaryType: 'service_module',
    nameZh: entry.name_zh,
    typeZh: entry.type_zh,
    parentId: entry.parent_id,
    parentNameZh: entry.type_zh,
    quantity: 1,
    unit: 'set',
    price: setting.price ?? 0,
    duration: prepDuration > 0 ? prepDuration : (setting.duration ?? entry.default_duration_min),
    affectsBookingDuration: entry.affects_booking_duration,
  };
}

/**
 * Validate provider JSON again before it enters pricing. Provider-side schema enforcement reduces
 * failures; this runtime boundary remains authoritative if a provider ignores or repairs the shape.
 */
export function parseBreakdownModelOutput(
  value: unknown,
  merchantSettings: MerchantPricingSetting[],
): BreakdownResult {
  if (!isRecord(value)) invalidModelOutput('response must be an object');
  const response = value;
  const topLevelKeys = Object.keys(response);
  if (
    topLevelKeys.length !== rawSections.length
    || topLevelKeys.some((key) => !rawSections.includes(key as RawSection))
  ) {
    invalidModelOutput('response must contain exactly the six breakdown sections');
  }

  const settingsById = new Map(merchantSettings.map((setting) => [setting.id, setting]));
  const seenIds = new Set<string>();

  function parseSection(section: RawSection): GlossaryBreakdownItem[] {
    const rawArray = response[section];
    if (!Array.isArray(rawArray)) invalidModelOutput(`${section} must be an array`);
    const glossaryType = sectionTypeMap[section];

    return rawArray.map((rawItem, index) => {
      if (!isRecord(rawItem)) invalidModelOutput(`${section}[${index}] must be an object`);
      const keys = Object.keys(rawItem);
      if (keys.length !== 3 || keys.some((key) => !['id', 'quantity', 'unit'].includes(key))) {
        invalidModelOutput(`${section}[${index}] has unexpected fields`);
      }
      if (typeof rawItem.id !== 'string' || !rawItem.id.trim()) {
        invalidModelOutput(`${section}[${index}].id must be a non-empty string`);
      }
      if (
        typeof rawItem.quantity !== 'number'
        || !Number.isInteger(rawItem.quantity)
        || rawItem.quantity < 1
        || rawItem.quantity > 100
      ) {
        invalidModelOutput(`${section}[${index}].quantity must be an integer from 1 to 100`);
      }
      if (
        typeof rawItem.unit !== 'string'
        || !modelUnits.includes(rawItem.unit as (typeof modelUnits)[number])
      ) {
        invalidModelOutput(`${section}[${index}].unit is invalid`);
      }

      const id = rawItem.id.trim();
      const entry = glossaryById.get(id);
      if (!entry || entry.type !== glossaryType || !allowedIdsBySection[section].has(id)) {
        invalidModelOutput(`${id} does not belong in ${section}`);
      }
      if (seenIds.has(id)) invalidModelOutput(`${id} was returned more than once`);
      seenIds.add(id);

      const pricingUnit = entry.default_pricing_unit;
      if (!isPricingUnit(pricingUnit)) invalidModelOutput(`${id} has an invalid catalog pricing unit`);
      const quantity = normalizeQuantityForPricingUnit(rawItem.quantity, pricingUnit);
      const settings = settingsById.get(id);
      const allowPricing = Boolean(settings);
      const isEnabled = settings?.enabled !== false;
      const price = allowPricing && isEnabled ? (settings?.price ?? 0) : 0;
      const duration = allowPricing && isEnabled ? (settings?.duration ?? entry.default_duration_min) : 0;
      const parentEntry = glossaryById.get(entry.parent_id);

      return {
        mode: 'glossary' as const,
        glossaryId: id,
        glossaryType,
        nameZh: entry.name_zh,
        typeZh: entry.type_zh,
        parentId: entry.parent_id,
        parentNameZh: parentEntry?.name_zh ?? entry.type_zh,
        quantity,
        unit: rawItem.unit,
        price,
        duration,
        affectsBookingDuration: entry.affects_booking_duration,
      };
    });
  }

  const detected = rawSections.flatMap(parseSection);
  // The base manicure is ai_detectable='no', so the model never returns it — but every manicure
  // includes the base prep floor ($28/51-min). Inject it so the customer quote isn't $0 (it mirrors
  // the merchant-side withBaseManicure enforcement).
  const baseItem = seenIds.has(BASE_MANICURE_ID) ? null : baseManicureItem(settingsById);
  const items = baseItem ? [baseItem, ...detected] : detected;
  const catalogSelections = items.flatMap((item) =>
    settingsById.get(item.glossaryId)?.enabled
      ? [{ catalogItemId: item.glossaryId, quantity: item.quantity }]
      : [],
  );

  return {
    items,
    catalogSelections,
    totalPrice: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    totalDuration: items
      .filter((item) => item.affectsBookingDuration)
      .reduce((sum, item) => {
        const scales = item.unit === 'per_finger' || item.unit === 'per_piece';
        return sum + (scales ? item.duration * item.quantity : item.duration);
      }, 0),
    mode: 'glossary',
  };
}

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

let _breakdownPrompt: string | undefined;
const breakdownPrompt = () => (_breakdownPrompt ??= buildPrompt());

// ── Main function ─────────────────────────────────────────────────────────────

export function getNailValidationPrompt(language: AppLanguage): string {
  const invalidErrorExample =
    language === 'zh-CN'
      ? '{"valid":false,"error":"请上传一张美甲照片（指甲特写或美甲款式图）。"}'
      : '{"valid":false,"error":"Please upload a nail-style photo (close-up nails or a nail design reference)."}';

  return [
    'You are validating an image for a nail salon analysis app.',
    'Determine whether the image shows a nail art or nail style photo (finished nails on hands, nail swatches, or nail design references).',
    `Return ONLY valid JSON (no markdown fences): {"valid":true} or ${invalidErrorExample}.`,
    'Output only the JSON object, nothing else.',
  ].join(' ');
}

export async function runGlossaryBreakdown(
  imageBase64: string,
  mimeType: string,
  merchantSettings: MerchantPricingSetting[],
  language: AppLanguage = 'zh-CN',
  env = process.env
): Promise<BreakdownResult> {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) throw new BreakdownError('missing_config', 'OPENROUTER_API_KEY is required for breakdown.');

  const model = env.GEMINI_IMAGE_MODEL_NAME ?? defaultTryOnModel;

  // ── Validate image is a nail photo before running the expensive prompt ────────
  try {
    const valRaw = await callOpenRouterWithImage({
      apiKey,
      model,
      imageBase64,
      mimeType,
      prompt: getNailValidationPrompt(language),
    });
    const val = isRecord(valRaw) ? valRaw : {};
    if (val.valid === false) {
      const msg = typeof val.error === 'string'
        ? val.error
        : language === 'zh-CN'
          ? '请上传一张美甲照片（指甲特写或美甲款式图）。'
          : 'Please upload a nail-style photo (close-up nails or a nail design reference).';
      throw new BreakdownError('invalid_input', msg);
    }
  } catch (err) {
    if (err instanceof BreakdownError) throw err;
    // Validation call itself failed — proceed anyway rather than blocking user
  }

  const raw = await callOpenRouterWithImage({ apiKey, model, imageBase64, mimeType, prompt: breakdownPrompt(), structured: true });
  return parseBreakdownModelOutput(raw, merchantSettings);
}
