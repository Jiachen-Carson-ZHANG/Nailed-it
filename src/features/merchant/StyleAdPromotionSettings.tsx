'use client';

import { useMemo, useState } from 'react';
import type {
  AudienceMode,
  ConsumptionLevel,
  StyleAdCustomAudience,
  StyleAdPreferenceTag,
} from '@/domain/style-ad';
import {
  clampAudienceAge,
  clampDurationDays,
  consumptionLevels,
  DEFAULT_CUSTOM_AUDIENCE,
  DEFAULT_DURATION_DAYS,
  MAX_AUDIENCE_AGE,
  MAX_DURATION_DAYS,
  minFutureDateInputValue,
  MIN_AUDIENCE_AGE,
  MIN_DURATION_DAYS,
  styleAdPreferenceTags,
} from '@/domain/style-ad';
import { Dialog } from '@/components/ui/Dialog';
import { useLanguage } from '@/i18n/context';

export type StyleAdPromotionSettingsValue = {
  startAt: string | null;
  durationDays: number;
  audienceMode: AudienceMode;
  customAudience: StyleAdCustomAudience;
};

type StyleAdPromotionSettingsProps = {
  value: StyleAdPromotionSettingsValue;
  onChange: (value: StyleAdPromotionSettingsValue) => void;
};

const settingsCopy = {
  'zh-CN': {
    settingsTitle: '推广设置',
    startTime: '开始时间',
    startNow: '立即开始',
    scheduleStart: '定时开始',
    pickStartDate: '选择开始日期',
    duration: '持续时间',
    durationDays: (n: number) => `${n} 天`,
    audience: '受众人群',
    audienceSmart: '智能推荐',
    audienceSmartHint: '系统会在全部人群中自动选择更可能点击和预约的用户',
    audienceCustom: '自定义人群',
    audienceCustomHint: '按年龄、消费习惯与喜好标签定向投放',
    targetAge: '目标年龄',
    ageMin: '最低年龄',
    ageMax: '最高年龄',
    ageYears: (min: number, max: number) => `${min} - ${max} 岁`,
    consumptionHabits: '消费习惯',
    visitFrequency: '频次',
    unitPrice: '单价',
    levelHigh: '高',
    levelMedium: '中',
    levelLow: '低',
    preferenceTags: '喜好标签',
    sheetStartTitle: '开始时间',
    sheetDurationTitle: '持续时间',
    tagLabels: {
      minimal: '简约',
      rhinestone: '贴钻',
      extension: '延长',
      hand_paint: '手绘',
      french: '法式',
      cat_eye: '猫眼',
      y2k: 'Y2K',
      solid: '纯色',
      complex: '复杂',
    } satisfies Record<StyleAdPreferenceTag, string>,
  },
  en: {
    settingsTitle: 'Promotion settings',
    startTime: 'Start time',
    startNow: 'Start now',
    scheduleStart: 'Schedule start',
    pickStartDate: 'Pick start date',
    duration: 'Duration',
    durationDays: (n: number) => `${n} day${n === 1 ? '' : 's'}`,
    audience: 'Audience',
    audienceSmart: 'Smart recommendation',
    audienceSmartHint: 'The system picks users most likely to click and book',
    audienceCustom: 'Custom audience',
    audienceCustomHint: 'Target by age, spending habits, and style preferences',
    targetAge: 'Target age',
    ageMin: 'Minimum age',
    ageMax: 'Maximum age',
    ageYears: (min: number, max: number) => `${min} - ${max} years`,
    consumptionHabits: 'Spending habits',
    visitFrequency: 'Frequency',
    unitPrice: 'Spend',
    levelHigh: 'High',
    levelMedium: 'Medium',
    levelLow: 'Low',
    preferenceTags: 'Style preferences',
    sheetStartTitle: 'Start time',
    sheetDurationTitle: 'Duration',
    tagLabels: {
      minimal: 'Minimal',
      rhinestone: 'Rhinestones',
      extension: 'Extensions',
      hand_paint: 'Hand-painted',
      french: 'French',
      cat_eye: 'Cat eye',
      y2k: 'Y2K',
      solid: 'Solid color',
      complex: 'Complex',
    } satisfies Record<StyleAdPreferenceTag, string>,
  },
} as const;

function levelLabel(level: ConsumptionLevel, copy: (typeof settingsCopy)[keyof typeof settingsCopy]) {
  switch (level) {
    case 'high':
      return copy.levelHigh;
    case 'medium':
      return copy.levelMedium;
    default:
      return copy.levelLow;
  }
}

function formatScheduledDate(date: string, locale: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.toLocaleDateString(locale === 'zh-CN' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function StyleAdPromotionSettings({ value, onChange }: StyleAdPromotionSettingsProps) {
  const { language } = useLanguage();
  const copy = settingsCopy[language];
  const [startSheetOpen, setStartSheetOpen] = useState(false);
  const [durationSheetOpen, setDurationSheetOpen] = useState(false);
  const minStartDate = useMemo(() => minFutureDateInputValue(), []);

  const startLabel = value.startAt
    ? formatScheduledDate(value.startAt, language)
    : copy.startNow;

  const durationLabel = copy.durationDays(value.durationDays);
  const audienceHint = value.audienceMode === 'smart' ? copy.audienceSmartHint : copy.audienceCustomHint;

  function updateCustomAudience(patch: Partial<StyleAdCustomAudience>) {
    onChange({
      ...value,
      customAudience: { ...value.customAudience, ...patch },
    });
  }

  function setAgeMin(nextMin: number) {
    const ageMin = clampAudienceAge(nextMin);
    const ageMax = Math.max(ageMin, value.customAudience.ageMax);
    updateCustomAudience({ ageMin, ageMax });
  }

  function setAgeMax(nextMax: number) {
    const ageMax = clampAudienceAge(nextMax);
    const ageMin = Math.min(value.customAudience.ageMin, ageMax);
    updateCustomAudience({ ageMin, ageMax });
  }

  function togglePreferenceTag(tag: StyleAdPreferenceTag) {
    const selected = new Set(value.customAudience.preferenceTags);
    if (selected.has(tag)) {
      selected.delete(tag);
    } else {
      selected.add(tag);
    }
    updateCustomAudience({ preferenceTags: [...selected] });
  }

  return (
    <section aria-labelledby="style-ad-settings-title" className="style-ad-section detail-surface">
      <h2 className="style-ad-section-title" id="style-ad-settings-title">{copy.settingsTitle}</h2>

      <button
        className="style-ad-setting-row"
        type="button"
        onClick={() => setStartSheetOpen(true)}
      >
        <span className="style-ad-setting-label">{copy.startTime}</span>
        <span className="style-ad-setting-value">
          {startLabel}
          <span aria-hidden className="style-ad-setting-caret">›</span>
        </span>
      </button>

      <button
        className="style-ad-setting-row"
        type="button"
        onClick={() => setDurationSheetOpen(true)}
      >
        <span className="style-ad-setting-label">{copy.duration}</span>
        <span className="style-ad-setting-value">
          {durationLabel}
          <span aria-hidden className="style-ad-setting-caret">›</span>
        </span>
      </button>

      <div className="style-ad-audience-block">
        <p className="style-ad-setting-label">{copy.audience}</p>
        <div className="style-ad-audience-toggle" role="group" aria-label={copy.audience}>
          <button
            aria-pressed={value.audienceMode === 'smart'}
            className={`style-ad-audience-option${value.audienceMode === 'smart' ? ' style-ad-audience-option-on' : ''}`}
            type="button"
            onClick={() => onChange({ ...value, audienceMode: 'smart' })}
          >
            {copy.audienceSmart}
          </button>
          <button
            aria-pressed={value.audienceMode === 'custom'}
            className={`style-ad-audience-option${value.audienceMode === 'custom' ? ' style-ad-audience-option-on' : ''}`}
            type="button"
            onClick={() => onChange({
              ...value,
              audienceMode: 'custom',
              customAudience: value.customAudience.preferenceTags.length > 0
                ? value.customAudience
                : { ...DEFAULT_CUSTOM_AUDIENCE },
            })}
          >
            {copy.audienceCustom}
          </button>
        </div>
        <p className="helper-copy style-ad-audience-hint">{audienceHint}</p>

        {value.audienceMode === 'custom' ? (
          <div className="style-ad-custom-audience">
            <div className="style-ad-custom-audience-section">
              <div className="style-ad-custom-audience-header">
                <p className="style-ad-setting-label">{copy.targetAge}</p>
                <strong className="style-ad-age-value">
                  {copy.ageYears(value.customAudience.ageMin, value.customAudience.ageMax)}
                </strong>
              </div>
              <label className="style-ad-age-slider-row">
                <span className="helper-copy">{copy.ageMin}</span>
                <input
                  aria-label={copy.ageMin}
                  className="style-ad-roi-slider"
                  max={MAX_AUDIENCE_AGE}
                  min={MIN_AUDIENCE_AGE}
                  step={1}
                  type="range"
                  value={value.customAudience.ageMin}
                  onChange={(event) => setAgeMin(Number(event.target.value))}
                />
              </label>
              <label className="style-ad-age-slider-row">
                <span className="helper-copy">{copy.ageMax}</span>
                <input
                  aria-label={copy.ageMax}
                  className="style-ad-roi-slider"
                  max={MAX_AUDIENCE_AGE}
                  min={MIN_AUDIENCE_AGE}
                  step={1}
                  type="range"
                  value={value.customAudience.ageMax}
                  onChange={(event) => setAgeMax(Number(event.target.value))}
                />
              </label>
              <div aria-hidden className="style-ad-roi-scale">
                <span>{MIN_AUDIENCE_AGE}</span>
                <span>{MAX_AUDIENCE_AGE}</span>
              </div>
            </div>

            <div className="style-ad-custom-audience-section">
              <p className="style-ad-setting-label">{copy.consumptionHabits}</p>
              <div className="style-ad-consumption-rows">
                <span className="style-ad-consumption-label">{copy.visitFrequency}：</span>
                <div className="style-ad-consumption-options" role="group" aria-label={copy.visitFrequency}>
                  {consumptionLevels.map((level) => (
                    <button
                      key={`freq-${level}`}
                      aria-pressed={value.customAudience.visitFrequency === level}
                      className={`style-ad-consumption-option${value.customAudience.visitFrequency === level ? ' style-ad-consumption-option-on' : ''}`}
                      type="button"
                      onClick={() => updateCustomAudience({
                        visitFrequency: value.customAudience.visitFrequency === level ? null : level,
                      })}
                    >
                      {levelLabel(level, copy)}
                    </button>
                  ))}
                </div>
                <span className="style-ad-consumption-label">{copy.unitPrice}：</span>
                <div className="style-ad-consumption-options" role="group" aria-label={copy.unitPrice}>
                  {consumptionLevels.map((level) => (
                    <button
                      key={`price-${level}`}
                      aria-pressed={value.customAudience.unitPrice === level}
                      className={`style-ad-consumption-option${value.customAudience.unitPrice === level ? ' style-ad-consumption-option-on' : ''}`}
                      type="button"
                      onClick={() => updateCustomAudience({
                        unitPrice: value.customAudience.unitPrice === level ? null : level,
                      })}
                    >
                      {levelLabel(level, copy)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="style-ad-custom-audience-section">
              <p className="style-ad-setting-label">{copy.preferenceTags}</p>
              <div className="style-ad-exposure-presets" role="group" aria-label={copy.preferenceTags}>
                {styleAdPreferenceTags.map((tag) => (
                  <button
                    key={tag}
                    aria-pressed={value.customAudience.preferenceTags.includes(tag)}
                    className={`style-ad-exposure-preset${value.customAudience.preferenceTags.includes(tag) ? ' style-ad-exposure-preset-on' : ''}`}
                    type="button"
                    onClick={() => togglePreferenceTag(tag)}
                  >
                    {copy.tagLabels[tag]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog
        open={startSheetOpen}
        title={copy.sheetStartTitle}
        onOpenChange={setStartSheetOpen}
      >
        <div className="style-ad-sheet-options">
          <button
            aria-pressed={value.startAt === null}
            className={`style-ad-sheet-option${value.startAt === null ? ' style-ad-sheet-option-on' : ''}`}
            type="button"
            onClick={() => {
              onChange({ ...value, startAt: null });
              setStartSheetOpen(false);
            }}
          >
            {copy.startNow}
          </button>
          <label className="style-ad-sheet-date-field">
            <span className="style-ad-setting-label">{copy.scheduleStart}</span>
            <input
              aria-label={copy.pickStartDate}
              className="style-ad-sheet-date-input"
              min={minStartDate}
              type="date"
              value={value.startAt ?? minStartDate}
              onChange={(event) => {
                onChange({ ...value, startAt: event.target.value });
                setStartSheetOpen(false);
              }}
            />
          </label>
        </div>
      </Dialog>

      <Dialog
        open={durationSheetOpen}
        title={copy.sheetDurationTitle}
        onOpenChange={setDurationSheetOpen}
      >
        <div className="style-ad-duration-sheet">
          <div className="style-ad-roi-header">
            <p className="style-ad-setting-label">{copy.duration}</p>
            <strong className="style-ad-roi-value">{durationLabel}</strong>
          </div>
          <input
            aria-label={copy.duration}
            className="style-ad-roi-slider"
            max={MAX_DURATION_DAYS}
            min={MIN_DURATION_DAYS}
            step={1}
            type="range"
            value={value.durationDays}
            onChange={(event) => onChange({
              ...value,
              durationDays: clampDurationDays(Number(event.target.value)),
            })}
          />
          <div aria-hidden className="style-ad-roi-scale">
            <span>{MIN_DURATION_DAYS}</span>
            <span>{MAX_DURATION_DAYS}</span>
          </div>
          <button
            className="button button-primary button-block"
            type="button"
            onClick={() => setDurationSheetOpen(false)}
          >
            {durationLabel}
          </button>
        </div>
      </Dialog>
    </section>
  );
}

export const defaultPromotionSettingsValue: StyleAdPromotionSettingsValue = {
  startAt: null,
  durationDays: DEFAULT_DURATION_DAYS,
  audienceMode: 'smart',
  customAudience: { ...DEFAULT_CUSTOM_AUDIENCE, preferenceTags: [] },
};
