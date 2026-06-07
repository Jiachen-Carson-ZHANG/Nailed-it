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
  const [style, setStyle] = useState<MerchantStyleView | null>(null);
  const [image, setImage] = useState<{ imageBase64: string; mimeType: string; previewUrl: string } | null>(null);
  const [cached, setCached] = useState<BreakdownResult | null>(null);
  const [title, setTitle] = useState('');
  const [selections, setSelections] = useState<CatalogSelection[]>([]);
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        let loaded = await getMerchantStyleReviewAction(styleId);
        if (!loaded) {
          if (active) setMessage('Design not found.');
          return;
        }
        // A never-configured upload (no stored breakdown yet) should let the panel analyze the image;
        // a previously-saved design seeds from its stored selections so manual edits aren't discarded.
        const isFresh = loaded.catalogBreakdown.length === 0;
        if (loaded.status === 'processing') {
          loaded = await configureMerchantStyleManuallyAction(styleId);
        }
        const img = await getMerchantStyleImageAction(styleId);
        if (!active) return;
        setStyle(loaded);
        // Upload stores a placeholder title to satisfy the DB; show an empty field so the merchant names it.
        setTitle(loaded.title === '未命名设计' ? '' : loaded.title);
        setImage({ imageBase64: img.base64, mimeType: img.mimeType, previewUrl: loaded.imageUrl });
        // Seed from priced selections AND descriptive facets (colour/shape/length/finish), which the
        // merchant pipeline stores as facets — otherwise those sections look unconfigured.
        setCached(
          isFresh
            ? null
            : buildBreakdownFromConfig(loaded.catalogBreakdown, loaded.discoveryFacets.map((f) => f.label)),
        );
        setSelections(loaded.catalogBreakdown);
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'Unable to load this design.');
      } finally {
        if (active) setIsLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [styleId]);

  async function persist(publish: boolean) {
    if (!style) return;
    setIsBusy(true);
    setMessage('');
    try {
      const input = { styleId: style.id, title: title.trim(), description: style.description, selections };
      if (publish) await publishMerchantStyleAction(input);
      else await saveMerchantStyleDraftAction(input);
      // Confirm success, then return to the library (it shows up under Published).
      setToast(publish ? '已发布到作品库 ✓' : '已保存 ✓');
      setTimeout(() => router.push('/merchant/styles'), 900);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : publish ? 'Unable to publish.' : 'Unable to save.');
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

  const canPublish = style.status !== 'published';

  return (
    <div className="merchant-style-editor">
      <label className="merchant-editor-title-field">
        <span className="merchant-editor-title-label">设计名称</span>
        <input
          className="merchant-editor-title-input"
          value={title}
          placeholder="给这款设计起个名字"
          onChange={(event) => setTitle(event.currentTarget.value)}
        />
      </label>

      <ComponentBreakdownPanel
        image={image}
        cachedResult={cached}
        showRemoval={false}
        onResult={(result) => setSelections(result.catalogSelections)}
        footer={
          <div className="merchant-editor-actions">
            <Button variant="secondary" size="compact" disabled={isBusy} onClick={() => void cancelEdit()}>
              取消
            </Button>
            <Button size="compact" disabled={isBusy || !title.trim()} onClick={() => void persist(canPublish)}>
              {canPublish ? '发布' : '保存'}
            </Button>
          </div>
        }
      />

      {message ? (
        <p className="merchant-review-empty" role="alert">{message}</p>
      ) : null}

      <Toast message={toast} />
    </div>
  );
}
