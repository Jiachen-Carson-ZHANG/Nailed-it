'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TryOnResult } from '@/domain/nail';
import type { SelectedNailImage } from '@/components/ui/ImageUploader';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { getCustomerBookingPath } from '@/domain/session';
import { saveTryOnImage } from '@/domain/tryon-image-store';
import { consumeTryOnStyleImage } from '@/domain/tryon-style-store';
import { demoCustomerId } from '@/mock/customers';
import { track } from '@/features/analytics/track';
import { useLanguage } from '@/i18n/context';
import { tryOnQuickCategories, buildCustomPrompt } from '@/data/tryOnCustomisations';

type ImageSlotProps = {
  label: string;
  description: string;
  uploadAria: string;
  image: SelectedNailImage | null;
  prefillImageUrl?: string;
  onImageSelected: (image: SelectedNailImage) => void;
};

function ImageSlot({ label, description, uploadAria, image, prefillImageUrl, onImageSelected }: ImageSlotProps) {
  const previewSrc = image?.previewUrl ?? prefillImageUrl ?? '';
  const hasImage = Boolean(previewSrc);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // TEMP DIAGNOSTIC: log the picked file's type/size so we can see what iPhone camera delivers.
    try {
      // eslint-disable-next-line no-console
      console.log('[诊断 upload]', label, 'type=', JSON.stringify(file.type), 'size=', file.size, 'name=', file.name);
    } catch { /* ignore */ }

    const reader = new FileReader();
    reader.addEventListener('error', () => {
      // eslint-disable-next-line no-console
      console.log('[诊断 upload] FileReader error', reader.error?.name, reader.error?.message);
    });
    reader.addEventListener('load', () => {
      const previewUrl = typeof reader.result === 'string' ? reader.result : '';
      const imageBase64 = previewUrl.split(',')[1] ?? '';
      if (!imageBase64) return;
      onImageSelected({ imageBase64, mimeType: file.type || 'image/jpeg', previewUrl });
    });
    reader.readAsDataURL(file);
  }

  return (
    <div className="try-on-slot">
      <p className="section-eyebrow">{label}</p>
      <label className="try-on-slot-upload">
        {hasImage ? (
          <img src={previewSrc} alt={label} className="try-on-slot-image" />
        ) : (
          <div className="try-on-slot-placeholder" aria-hidden="true">
            <span className="image-uploader-mark">+</span>
          </div>
        )}
        <input
          aria-label={uploadAria}
          accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
          hidden
          type="file"
          onChange={handleFileChange}
        />
      </label>
      <p className="helper-copy">{description}</p>
    </div>
  );
}

type TryOnPanelProps = {
  prefillStyleImageUrl?: string;
  styleId?: string;
  /** 来源页面标识：'collage' = 从拼贴小屋直接进入；'booking' = 从报价页进入 */
  from?: string;
};

export function TryOnPanel({ prefillStyleImageUrl, styleId, from }: TryOnPanelProps) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [handImage, setHandImage] = useState<SelectedNailImage | null>(null);
  // 中文注释：拼贴小屋点"虚拟试戴"时会把生成图存进 tryon-style-store，
  // 这里挂载时消费一次作为"款式图"预填，用户只需再上传手部照片即可试戴。
  const styleStoreOnce = useRef<SelectedNailImage | null | undefined>(undefined);
  if (styleStoreOnce.current === undefined) styleStoreOnce.current = consumeTryOnStyleImage();
  const [styleImage, setStyleImage] = useState<SelectedNailImage | null>(() => styleStoreOnce.current ?? null);

  // When navigating from a style card (prefillStyleImageUrl set, no store image),
  // fetch and pre-select the style image so the user sees it as already chosen.
  useEffect(() => {
    if (styleImage || !prefillStyleImageUrl) return;
    let cancelled = false;
    fetch(prefillStyleImageUrl)
      .then((res) => res.blob())
      .then((blob) => new Promise<SelectedNailImage>((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          const dataUrl = typeof reader.result === 'string' ? reader.result : '';
          const base64 = dataUrl.split(',')[1] ?? '';
          if (!base64) { reject(new Error('empty')); return; }
          resolve({ imageBase64: base64, mimeType: blob.type || 'image/jpeg', previewUrl: dataUrl });
        });
        reader.addEventListener('error', reject);
        reader.readAsDataURL(blob);
      }))
      .then((img) => { if (!cancelled) setStyleImage(img); })
      .catch(() => { /* silently ignore — prefillImageUrl still shows as preview */ });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillStyleImageUrl]);
  const [userComment, setUserComment] = useState('');
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [quickSelections, setQuickSelections] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<TryOnResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const canGenerate = Boolean(handImage) && (Boolean(styleImage) || Boolean(prefillStyleImageUrl));

  function toggleCategory(catId: string) {
    setOpenCategory((prev) => (prev === catId ? null : catId));
  }

  function toggleOption(catId: string, optId: string, mode: 'single' | 'multi') {
    setQuickSelections((prev) => {
      const current = prev[catId] ?? [];
      let next: string[];
      if (mode === 'single') {
        next = current.includes(optId) ? [] : [optId];
      } else {
        next = current.includes(optId)
          ? current.filter((id) => id !== optId)
          : [...current, optId];
      }
      return { ...prev, [catId]: next };
    });
  }

  function applyQuickPrompt() {
    const prompt = buildCustomPrompt(quickSelections, language);
    setUserComment(prompt);
    setOpenCategory(null);
  }

  async function generate() {
    if (!handImage) return;

    // ── TEMP DIAGNOSTIC (remove after root-causing the mobile "did not match the expected pattern" error) ──
    // 中文注释：临时诊断——把走到哪一步、图片类型/大小、真实错误 name+stack 全部暴露出来，
    // 用于在 iPhone 上复现时定位真正的抛出点。定位后整段删除。
    let __diagStep = 'start';
    const __diag = (s: string) => { __diagStep = s; };
    const __diagInfo = () => ({
      step: __diagStep,
      handMime: handImage?.mimeType,
      handLen: handImage?.imageBase64?.length,
      styleMime: styleImage?.mimeType,
      styleLen: styleImage?.imageBase64?.length,
      hasPrefill: Boolean(prefillStyleImageUrl),
      prefill: prefillStyleImageUrl?.slice(0, 40),
    });

    let finalStyleBase64 = styleImage?.imageBase64 ?? null;
    let finalStyleMime = styleImage?.mimeType ?? null;

    if (!finalStyleBase64 && prefillStyleImageUrl) {
      try {
        __diag('fetch-prefill');
        const res = await fetch(prefillStyleImageUrl);
        __diag('prefill-blob');
        const blob = await res.blob();
        const reader = new FileReader();
        __diag('prefill-readAsDataURL');
        finalStyleBase64 = await new Promise<string>((resolve) => {
          reader.addEventListener('load', () => {
            const dataUrl = typeof reader.result === 'string' ? reader.result : '';
            resolve(dataUrl.split(',')[1] ?? '');
          });
          reader.readAsDataURL(blob);
        });
        finalStyleMime = blob.type || 'image/jpeg';
      } catch (e) {
        // TEMP DIAGNOSTIC: surface the real error instead of the generic prefill message.
        setError(`[诊断 prefill] ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)} | info=${JSON.stringify(__diagInfo())}`);
        return;
      }
    }

    if (!finalStyleBase64 || !finalStyleMime) {
      setError(t('tryOn.styleRequiredError'));
      return;
    }

    setIsGenerating(true);
    setError('');
    setResult(null);

    try {
      __diag('build-body');
      const requestBody = JSON.stringify({
        handImageBase64: handImage.imageBase64,
        handMimeType: handImage.mimeType,
        styleImageBase64: finalStyleBase64,
        styleMimeType: finalStyleMime,
        userComment: userComment.trim(),
      });
      __diag('fetch-tryon');
      const response = await fetch('/api/ai/try-on', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      });

      __diag('parse-json');
      const body = (await response.json()) as TryOnResult & { error?: string; code?: string };

      if (!response.ok) {
        if (body.code === 'invalid_comment') {
          throw new Error(t('tryOn.commentError'));
        }
        throw new Error(body.error ?? t('tryOn.tryOnFailed'));
      }

      __diag('set-result');
      setResult(body);
      track('try_on_completed', {
        styleId,
        customerId: demoCustomerId,
        eventSource: 'try_on',
      });
    } catch (err) {
      // TEMP DIAGNOSTIC: show error name + step + image info so the real WebKit throw point is visible on-device.
      const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      setError(`[诊断 generate] ${detail} | info=${JSON.stringify(__diagInfo())}`);
    } finally {
      setIsGenerating(false);
    }
  }

  function analyzeAndBook() {
    if (!result) return;
    saveTryOnImage({ imageBase64: result.imageBase64, mimeType: result.mimeType, previewUrl: `data:${result.mimeType};base64,${result.imageBase64}` });
    // 从报价页来的，返回报价页并直接跳到结果步骤（已有 breakdown 结果）
    if (from === 'booking') {
      router.push(`${getCustomerBookingPath()}?skipToResult=1&from=tryon&t=${Date.now()}`);
      return;
    }
    const base = styleId ? `${getCustomerBookingPath()}?styleId=${styleId}` : getCustomerBookingPath();
    const sep = styleId ? '&' : '?';
    router.push(`${base}${sep}from=tryon&t=${Date.now()}`);
  }

  const handLabel = t('tryOn.handLabel');
  const styleLabel = t('tryOn.styleLabel');

  return (
    <div className="try-on-panel">
      <div className="try-on-slots">
        <ImageSlot
          label={handLabel}
          description={t('tryOn.handDesc')}
          uploadAria={`${handLabel}`}
          image={handImage}
          onImageSelected={setHandImage}
        />
        <ImageSlot
          label={styleLabel}
          description={t('tryOn.styleDesc')}
          uploadAria={`${styleLabel}`}
          image={styleImage}
          prefillImageUrl={prefillStyleImageUrl}
          onImageSelected={setStyleImage}
        />
      </div>

      {error && (
        <section className="summary-card" role="alert">
          <strong>{t('tryOn.errorTitle')}</strong>
          <p>{error}</p>
        </section>
      )}

      {/* Quick-select customisation bar + label + textarea grouped together */}
      <div className="field">
        <span>{t('tryOn.commentLabel')}</span>

        {/* Category pills — between label and textarea */}
        <div className="try-on-quick">
          {openCategory && (
            <div className="try-on-quick-backdrop" onClick={() => setOpenCategory(null)} />
          )}
          <div className="try-on-quick-cats">
            {tryOnQuickCategories.map((cat) => {
              const count = (quickSelections[cat.id] ?? []).length;
              const isOpen = openCategory === cat.id;
              const selected = quickSelections[cat.id] ?? [];
              return (
                <div key={cat.id} className="try-on-quick-cat-wrap">
                  <button
                    type="button"
                    className={`try-on-quick-cat${isOpen || count > 0 ? ' try-on-quick-cat-on' : ''}`}
                    onClick={() => toggleCategory(cat.id)}
                  >
                    {language === 'zh-CN' ? cat.zh : cat.en}
                    <span className="try-on-quick-chevron" aria-hidden="true">{isOpen ? '▲' : '▼'}</span>
                  </button>

                  {isOpen && (
                    <div className={`try-on-quick-dropdown try-on-quick-dropdown--${cat.id}`}>
                      <div className="chip-row">
                        {cat.options.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            className={selected.includes(opt.id) ? 'chip chip-selected' : 'chip'}
                            onClick={() => toggleOption(cat.id, opt.id, cat.mode)}
                          >
                            {language === 'zh-CN' ? opt.zh : opt.en}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              className="try-on-quick-apply try-on-quick-apply-global"
              onClick={applyQuickPrompt}
            >
              {t('tryOn.quickConfirm')}
            </button>
          </div>
        </div>

        <textarea
          value={userComment}
          placeholder={t('tryOn.commentPlaceholder')}
          onChange={(e) => setUserComment(e.target.value)}
          rows={2}
        />
      </div>

      {isGenerating ? (
        <LoadingState
          title={t('tryOn.loadingTitle')}
          body={t('tryOn.loadingBody')}
        />
      ) : (
        <Button block disabled={!canGenerate} onClick={generate}>
          {t('tryOn.generate')}
        </Button>
      )}

      {result && (
        <section className="try-on-result" aria-label={t('tryOn.resultEyebrow')}>
          <p className="section-eyebrow">{t('tryOn.resultEyebrow')}</p>
          <img
            src={`data:${result.mimeType};base64,${result.imageBase64}`}
            alt={t('tryOn.resultAlt')}
            className="try-on-result-image"
          />
          <p className="helper-copy">
            <a
              href={`data:${result.mimeType};base64,${result.imageBase64}`}
              download="nail-try-on.png"
            >
              {t('tryOn.download')}
            </a>
          </p>
          <div className="try-on-result-actions">
            <Button block onClick={analyzeAndBook}>
              {t('tryOn.analyzeBook')}
            </Button>
            <Button block variant="secondary" onClick={() => router.back()}>
              {t('tryOn.back')}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
