'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BreakdownResult } from '@/domain/nail';
import type { CatalogSelection } from '@/domain/catalog';
import type { MerchantStyleView } from '@/domain/merchant-style';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/Toast';
import { useLanguage } from '@/i18n/context';
import {
  ComponentBreakdownPanel,
  buildBreakdownFromConfig,
} from '@/features/customer/ComponentBreakdownPanel';
import {
  configureMerchantStyleManuallyAction,
  deleteMerchantStyleAction,
  getMerchantStyleImageAction,
  getMerchantStyleReviewAction,
  publishMerchantStyleAction,
  saveMerchantStyleDraftAction,
} from '@/lib/actions/merchant-style-actions';

// Merchant editing reuses the customer book-flow style-result editor (ComponentBreakdownPanel) with the
// 卸甲 section hidden. A fresh upload (status 'processing') is flipped to an editable draft on open and
// the panel runs the AI breakdown client-side; a re-edit seeds from the stored selections.
export function MerchantStyleEditor({ styleId }: { styleId: string }) {
  const router = useRouter();
  const { language } = useLanguage();
  const [style, setStyle] = useState<MerchantStyleView | null>(null);
  const [image, setImage] = useState<{ imageBase64: string; mimeType: string; previewUrl: string } | null>(null);
  const [cached, setCached] = useState<BreakdownResult | null>(null);
  const [title, setTitle] = useState('');
  const [selections, setSelections] = useState<CatalogSelection[]>([]);
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFresh, setIsFresh] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        let loaded = await getMerchantStyleReviewAction(styleId);
        if (!loaded) {
          if (active) {
            setMessage('Design not found.');
            setIsLoading(false);
          }
          return;
        }
        // A never-configured upload (no stored breakdown yet) should let the panel analyze the image;
        // a previously-saved design seeds from its stored selections so manual edits aren't discarded.
        const fresh = loaded.catalogBreakdown.length === 0;
        if (loaded.status === 'processing') {
          loaded = await configureMerchantStyleManuallyAction(styleId);
        }
        if (!active) return;
        setStyle(loaded);
        setIsFresh(fresh);
        // Upload stores a placeholder title to satisfy the DB; show an empty field so the merchant names it.
        setTitle(loaded.title === '未命名设计' ? '' : loaded.title);
        setSelections(loaded.catalogBreakdown);
        const styleImageUrl = loaded.imageUrl;

        if (fresh) {
          // Never configured: the panel analyzes the image, so it must be loaded first.
          const img = await getMerchantStyleImageAction(styleId);
          if (!active) return;
          setImage({ imageBase64: img.base64, mimeType: img.mimeType, previewUrl: styleImageUrl });
          setCached(null);
        } else {
          // Re-edit: seed colour/shape/length/finish from priced selections + facets (the pipeline
          // stores descriptive attrs as facets) and render immediately. The image loads in the
          // background only for 重新分析, so a slow fetch never blocks the editor on "加载设计中".
          setCached(buildBreakdownFromConfig(loaded.catalogBreakdown, loaded.discoveryFacets.map((f) => f.label)));
          void getMerchantStyleImageAction(styleId)
            .then((img) => {
              if (active) setImage({ imageBase64: img.base64, mimeType: img.mimeType, previewUrl: styleImageUrl });
            })
            .catch(() => {
              // 重新分析 unavailable without the image; editing the seeded config still works.
            });
        }
        if (active) setIsLoading(false);
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'Unable to load this design.');
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [styleId]);

  function showToast(nextMessage: string) {
    setToast({ id: Date.now(), message: nextMessage });
  }

  async function persist(action: 'save' | 'publish' | 'republish') {
    if (!style) return;
    setIsBusy(true);
    setMessage('');
    try {
      const input = { styleId: style.id, title: title.trim(), description: style.description, selections };
      const saved =
        action === 'save'
          ? await saveMerchantStyleDraftAction(input)
          : await publishMerchantStyleAction(input);
      setStyle(saved);
      if (action === 'save') {
        showToast(language === 'zh-CN' ? '保存成功' : 'Saved successfully');
        setIsBusy(false);
        return;
      }
      showToast(
        action === 'republish'
          ? language === 'zh-CN' ? '重新发布成功' : 'Republished successfully'
          : language === 'zh-CN' ? '发布成功' : 'Published successfully',
      );
      setTimeout(() => router.push('/merchant/styles'), 1200);
    } catch (error) {
      const fallback =
        action === 'save'
          ? language === 'zh-CN' ? '保存失败。' : 'Unable to save.'
          : action === 'republish'
            ? language === 'zh-CN' ? '重新发布失败。' : 'Unable to republish.'
            : language === 'zh-CN' ? '发布失败。' : 'Unable to publish.';
      setMessage(error instanceof Error ? error.message : fallback);
      setIsBusy(false);
    }
  }

  // No drafts are parked: cancelling an unpublished upload discards it so the library stays clean
  // (a published style being re-edited is left as-is). Navigate immediately; the delete is
  // best-effort cleanup in the background, so a slow/failed delete never traps the merchant.
  function cancelEdit() {
    if (style && style.status !== 'published') {
      void deleteMerchantStyleAction(style.id).catch(() => {});
    }
    router.push('/merchant/styles');
  }

  if (isLoading) {
    return <LoadingState title="加载设计中" body="正在打开这款设计…" />;
  }
  if (!style) {
    return <EmptyState title="Design not found" body={message || 'This design could not be loaded.'} />;
  }

  const action = style.status === 'published' ? 'save' : style.status === 'archived' ? 'republish' : 'publish';
  const actionLabel =
    action === 'save'
      ? language === 'zh-CN' ? '保存' : 'Save'
      : action === 'republish'
        ? language === 'zh-CN' ? '重新发布' : 'Republish'
        : language === 'zh-CN' ? '发布' : 'Publish';

  return (
    <div className="merchant-style-editor">
      <label className="merchant-editor-title-field">
        <span className="merchant-editor-title-label">{language === 'zh-CN' ? '设计名称' : 'Design name'}</span>
        <input
          className="merchant-editor-title-input"
          value={title}
          placeholder={language === 'zh-CN' ? '给这款设计起个名字' : 'Name this design'}
          onChange={(event) => setTitle(event.currentTarget.value)}
        />
      </label>

      <ComponentBreakdownPanel
        image={image}
        previewUrl={style.imageUrl}
        cachedResult={cached}
        showRemoval={false}
        autoAnalyze={isFresh}
        onResult={(result) => setSelections(result.catalogSelections)}
        footer={
          <div className="merchant-editor-actions">
            <Button variant="secondary" size="compact" disabled={isBusy} onClick={() => void cancelEdit()}>
              {language === 'zh-CN' ? '取消' : 'Cancel'}
            </Button>
            <Button size="compact" disabled={isBusy || !title.trim()} onClick={() => void persist(action)}>
              {actionLabel}
            </Button>
          </div>
        }
      />

      {message ? (
        <p className="merchant-review-empty" role="alert">{message}</p>
      ) : null}

      <Toast key={toast?.id} message={toast?.message ?? ''} />
    </div>
  );
}
