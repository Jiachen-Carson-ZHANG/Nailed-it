'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/i18n/context';
import { getCustomerStylePath } from '@/domain/session';
import type { UiMessageKey } from '@/i18n/messages/ui/zh-CN';
import type { SkinProfile } from '@/nail-ai/skin-match';
import type { PublishedMerchantStyle } from '@/domain/merchant-style';

type Recommendation = {
  style: PublishedMerchantStyle;
  reasonZh: string;
  reasonEn: string;
};

type PageState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'results'; skinProfile: SkinProfile; recommendations: Recommendation[] }
  | { kind: 'error'; code: string; message: string };

const SUPPORTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];

const LOADING_PRINTS = ['💅', '🌸', '✨', '🌷', '💎', '🎀', '🪷', '⭐'];

export function HandMatchClient() {
  const { t, language } = useLanguage();
  const [state, setState] = useState<PageState>({ kind: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!SUPPORTED_TYPES.includes(file.type)) {
      setState({ kind: 'error', code: 'invalid_type', message: t('handMatch.errorInvalidImage') });
      return;
    }

    setState({ kind: 'loading' });

    const imageBase64 = await fileToBase64(file);

    try {
      const res = await fetch('/api/ai/skin-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType: file.type }),
      });

      const data = await res.json() as Record<string, unknown>;

      if (!res.ok) {
        const code = typeof data.code === 'string' ? data.code : 'unknown';
        const message =
          code === 'invalid_hand_image'  ? t('handMatch.errorInvalidImage') :
          code === 'no_candidates'       ? t('handMatch.errorNoStyles') :
          code === 'no_matching_styles'  ? t('handMatch.errorNoStyles') :
                                           t('handMatch.errorGeneric');
        setState({ kind: 'error', code, message });
        return;
      }

      setState({
        kind: 'results',
        skinProfile: data.skinProfile as SkinProfile,
        recommendations: data.recommendations as Recommendation[],
      });
    } catch {
      setState({ kind: 'error', code: 'network_error', message: t('handMatch.errorGeneric') });
    }
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = '';
  }

  return (
    <div className="hand-match-page">
      <input
        ref={fileInputRef}
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
        aria-hidden="true"
        style={{ display: 'none' }}
        type="file"
        onChange={handleFileChange}
      />

      {state.kind === 'idle' && (
        <IdleView
          onUpload={handleUploadClick}
          subtitle={t('handMatch.uploadSubtitle')}
          title={t('handMatch.uploadPrompt')}
        />
      )}

      {state.kind === 'loading' && (
        <LoadingView
          phrase1={t('handMatch.loadingPhrase1')}
          phrase2={t('handMatch.loadingPhrase2')}
          phrase3={t('handMatch.loadingPhrase3')}
          title={t('handMatch.title')}
        />
      )}

      {state.kind === 'results' && (
        <div className="hand-match-body">
          <ResultsView
            language={language}
            recommendations={state.recommendations}
            skinProfile={state.skinProfile}
            onRetry={handleUploadClick}
            t={t}
          />
        </div>
      )}

      {state.kind === 'error' && (
        <ErrorView
          message={state.message}
          retryLabel={t('handMatch.retry')}
          onRetry={handleUploadClick}
        />
      )}
    </div>
  );
}

// ─── Entry card rendered on the home page ──────────────────────────────────
export function HandMatchEntryCard({ onClick }: { onClick: () => void }) {
  const { t } = useLanguage();
  return (
    <button className="hand-match-entry" type="button" onClick={onClick}>
      <span className="hand-match-entry-text">
        <span className="hand-match-entry-title">{t('handMatch.title')}</span>
        <span className="hand-match-entry-sub">{t('handMatch.uploadSubtitle')}</span>
      </span>
      <span className="hand-match-entry-arrow">›</span>
    </button>
  );
}

// ─── Idle ──────────────────────────────────────────────────────────────────
function IdleView({ title, subtitle, onUpload }: { title: string; subtitle: string; onUpload: () => void }) {
  return (
    <div className="hand-match-idle">
      <div
        className="hand-match-upload-card"
        role="button"
        tabIndex={0}
        onClick={onUpload}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onUpload()}
      >
        <span className="hand-match-upload-icon" aria-hidden="true">🤚</span>
        <p className="hand-match-upload-title">{title}</p>
        <p className="hand-match-upload-subtitle">{subtitle}</p>
        <button
          className="hand-match-upload-btn"
          type="button"
          onClick={(e) => { e.stopPropagation(); onUpload(); }}
        >
          💅 {title}
        </button>
      </div>
    </div>
  );
}

// ─── Loading ───────────────────────────────────────────────────────────────
function LoadingView({ title, phrase1, phrase2, phrase3 }: {
  title: string; phrase1: string; phrase2: string; phrase3: string;
}) {
  const phrases = [phrase1, phrase2, phrase3];
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPhraseIdx((i) => (i + 1) % phrases.length), 3200);
    return () => clearInterval(id);
  }, [phrases.length]);

  return (
    <div className="hand-match-loading" aria-live="polite">
      <div className="hand-match-loading-prints" aria-hidden="true">
        {LOADING_PRINTS.map((emoji, i) => (
          <span
            key={emoji}
            className="hand-match-loading-print"
            style={{
              '--i': i,
              left: `${10 + (i * 11) % 80}%`,
              top: `${15 + (i * 17) % 60}%`,
            } as React.CSSProperties}
          >
            {emoji}
          </span>
        ))}
      </div>

      <span className="hand-match-loading-icon" aria-hidden="true">💅</span>
      <p className="hand-match-loading-label">{title}</p>
      <p className="hand-match-loading-phrase" key={phraseIdx}>{phrases[phraseIdx]}</p>
      <div className="hand-match-loading-bar" aria-hidden="true">
        <div className="hand-match-loading-bar-fill" />
      </div>
    </div>
  );
}

// ─── Results ───────────────────────────────────────────────────────────────
function ResultsView({
  skinProfile,
  recommendations,
  language,
  onRetry,
  t,
}: {
  skinProfile: SkinProfile;
  recommendations: Recommendation[];
  language: string;
  onRetry: () => void;
  t: (key: UiMessageKey) => string;
}) {
  const summary = language === 'zh-CN' ? skinProfile.summaryZh : skinProfile.summaryEn;

  const toneLabel = language === 'zh-CN'
    ? (skinProfile.toneCategory === 'warm' ? '暖调' : skinProfile.toneCategory === 'cool' ? '冷调' : '中性')
    : skinProfile.toneCategory;
  const depthLabel = language === 'zh-CN'
    ? (skinProfile.depth === 'light' ? '浅肤' : skinProfile.depth === 'deep' ? '深肤' : '中肤')
    : skinProfile.depth;

  return (
    <div className="hand-match-results">
      <section className="hand-match-skin-card" aria-label={t('handMatch.skinSummaryTitle')}>
        <span className="hand-match-skin-badge">{t('handMatch.aiAnalysis')}</span>
        <h2 className="hand-match-skin-title">{t('handMatch.skinSummaryTitle')}</h2>
        <div className="hand-match-tone-chips">
          <span className="hand-match-tone-chip">🌡 {toneLabel}</span>
          <span className="hand-match-tone-chip">✨ {depthLabel}</span>
        </div>
        <p className="hand-match-skin-summary">{summary}</p>
        {skinProfile.recommendedPalettes.length > 0 && (
          <div className="hand-match-chips">
            <span className="hand-match-chip-label">{t('handMatch.recommendedPalettes')}</span>
            {skinProfile.recommendedPalettes.map((p) => (
              <span key={p} className="hand-match-chip">{p}</span>
            ))}
          </div>
        )}
        {skinProfile.recommendedShapes.length > 0 && (
          <div className="hand-match-chips">
            <span className="hand-match-chip-label">{t('handMatch.recommendedShapes')}</span>
            {skinProfile.recommendedShapes.map((s) => (
              <span key={s} className="hand-match-chip">{s}</span>
            ))}
          </div>
        )}
      </section>

      <ul className="hand-match-recs" aria-label="recommendations">
        {recommendations.map(({ style, reasonZh, reasonEn }, idx) => {
          const reason = language === 'zh-CN' ? reasonZh : reasonEn;
          const title = (language === 'zh-CN' && style.titleLocalized?.['zh-CN'])
            ? style.titleLocalized['zh-CN']
            : style.title;
          const stylePath = getCustomerStylePath(style.id);
          return (
            <li
              key={style.id}
              className="hand-match-rec-card"
              style={{ '--rec-i': idx } as React.CSSProperties}
            >
              {style.imageUrl && (
                <div className="hand-match-rec-img-wrap">
                  <img alt={title} className="hand-match-rec-img" src={style.imageUrl} />
                  <span className="hand-match-rec-badge">{t('handMatch.aiRecommend')}</span>
                </div>
              )}
              <div className="hand-match-rec-body">
                <p className="hand-match-rec-name">{title}</p>
                <p className="hand-match-rec-reason">{reason}</p>
                <div className="hand-match-rec-actions">
                  <Link className="hand-match-rec-action-primary" href={stylePath}>
                    {t('handMatch.viewDetail')}
                  </Link>
                  <Link className="hand-match-rec-action-secondary" href={stylePath}>
                    {t('handMatch.bookNow')}
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <button className="hand-match-retry-btn" type="button" onClick={onRetry}>
        ↺ {t('handMatch.retry')}
      </button>
    </div>
  );
}

// ─── Error ─────────────────────────────────────────────────────────────────
function ErrorView({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry: () => void }) {
  return (
    <div className="hand-match-error-backdrop" role="alert">
      <div className="hand-match-error-dialog">
        <span className="hand-match-error-icon">🚫</span>
        <p className="hand-match-error-msg">{message}</p>
        <button className="hand-match-error-btn" type="button" onClick={onRetry}>
          {retryLabel}
        </button>
      </div>
    </div>
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
