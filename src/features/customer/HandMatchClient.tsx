'use client';

import { useState, useRef } from 'react';
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
          code === 'invalid_hand_image' ? t('handMatch.errorInvalidImage') :
          code === 'no_candidates'      ? t('handMatch.errorNoStyles') :
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
    // reset so same file can be re-uploaded
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
        <LoadingView label={t('handMatch.analyzing')} />
      )}

      {state.kind === 'results' && (
        <ResultsView
          language={language}
          recommendations={state.recommendations}
          skinProfile={state.skinProfile}
          onRetry={handleUploadClick}
          t={t}
        />
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

function IdleView({ title, subtitle, onUpload }: { title: string; subtitle: string; onUpload: () => void }) {
  return (
    <div className="hand-match-idle">
      <div className="hand-match-upload-slot" role="button" tabIndex={0} onClick={onUpload} onKeyDown={(e) => e.key === 'Enter' && onUpload()}>
        <span className="hand-match-upload-icon" aria-hidden="true">🤚</span>
        <p className="hand-match-upload-title">{title}</p>
        <p className="hand-match-upload-subtitle">{subtitle}</p>
        <button className="hand-match-btn" type="button" onClick={(e) => { e.stopPropagation(); onUpload(); }}>
          + {title}
        </button>
      </div>
    </div>
  );
}

function LoadingView({ label }: { label: string }) {
  return (
    <div className="hand-match-loading" aria-live="polite">
      <div className="hand-match-spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

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
  return (
    <div className="hand-match-results">
      <section className="hand-match-skin-card" aria-label={t('handMatch.skinSummaryTitle')}>
        <h2 className="hand-match-skin-title">{t('handMatch.skinSummaryTitle')}</h2>
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
        {recommendations.map(({ style, reasonZh, reasonEn }) => {
          const reason = language === 'zh-CN' ? reasonZh : reasonEn;
          const title = (language === 'zh-CN' && style.titleLocalized?.['zh-CN']) ? style.titleLocalized['zh-CN'] : style.title;
          return (
            <li key={style.id} className="hand-match-rec-card">
              {style.imageUrl && (
                <img alt={title} className="hand-match-rec-img" src={style.imageUrl} />
              )}
              <div className="hand-match-rec-body">
                <p className="hand-match-rec-name">{title}</p>
                <p className="hand-match-rec-reason">{reason}</p>
                <Link className="hand-match-rec-cta" href={getCustomerStylePath(style.id)}>
                  {t('handMatch.viewDetail')}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      <button className="hand-match-retry-btn" type="button" onClick={onRetry}>
        {t('handMatch.retry')}
      </button>
    </div>
  );
}

function ErrorView({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry: () => void }) {
  return (
    <div className="hand-match-error" role="alert">
      <p>{message}</p>
      <button className="hand-match-retry-btn" type="button" onClick={onRetry}>
        {retryLabel}
      </button>
    </div>
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip the data URL prefix (data:<mime>;base64,)
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
