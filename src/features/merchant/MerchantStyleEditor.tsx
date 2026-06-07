'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BreakdownResult } from '@/domain/nail';
import type { CatalogSelection } from '@/domain/catalog';
import type { MerchantStyleView } from '@/domain/merchant-style';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/Toast';
import { useLanguage } from '@/i18n/context';
import type { AppLanguage } from '@/i18n/types';
import type { UiMessageKey } from '@/i18n/messages/ui/zh-CN';
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

const libraryFlashKey = 'merchant-style-library-flash';
type PersistAction = 'save' | 'publish' | 'republish';

const editorCopy = {
  'zh-CN': {
    loadingTitle: '加载设计中',
    loadingBody: '正在打开这款设计…',
    notFoundTitle: '未找到款式',
    notFoundBody: '无法加载该款式，请返回款式库重试。',
    designName: '设计名称',
    designNamePlaceholder: '给这款设计起个名字',
    loadFailed: '无法加载该款式。',
  },
  en: {
    loadingTitle: 'Loading design',
    loadingBody: 'Opening this design…',
    notFoundTitle: 'Design not found',
    notFoundBody: 'This design could not be loaded. Return to the library and try again.',
    designName: 'Design name',
    designNamePlaceholder: 'Name this design',
    loadFailed: 'Unable to load this design.',
  },
} satisfies Record<AppLanguage, Record<string, string>>;

const successKeys: Record<PersistAction, UiMessageKey> = {
  save: 'common.saveSuccess',
  publish: 'common.publishSuccess',
  republish: 'common.republishSuccess',
};

const failureKeys: Record<PersistAction, UiMessageKey> = {
  save: 'common.saveFailed',
  publish: 'common.publishFailed',
  republish: 'common.republishFailed',
};

const actionKeys: Record<PersistAction, UiMessageKey> = {
  save: 'common.save',
  publish: 'common.publish',
  republish: 'common.republish',
};

// Merchant editing reuses the customer book-flow style-result editor (ComponentBreakdownPanel) with the
// 卸甲 section hidden. A fresh upload (status 'processing') is flipped to an editable draft on open and
// the panel runs the AI breakdown client-side; a re-edit seeds from the stored selections.
export function MerchantStyleEditor({ styleId }: { styleId: string }) {
  const router = useRouter();
  const { language, t } = useLanguage();
  const copy = editorCopy[language];
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
  const titleEditedRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        let loaded = await getMerchantStyleReviewAction(styleId);
        if (!loaded) {
          if (active) {
            setMessage(copy.loadFailed);
            setIsLoading(false);
          }
          return;
        }
        const fresh = loaded.catalogBreakdown.length === 0;
        if (loaded.status === 'processing') {
          loaded = await configureMerchantStyleManuallyAction(styleId);
        }
        if (!active) return;
        setStyle(loaded);
        setIsFresh(fresh);
        titleEditedRef.current = false;
        setTitle(loaded.title === '未命名设计' ? '' : loaded.title);
        setSelections(loaded.catalogBreakdown);
        const styleImageUrl = loaded.imageUrl;

        if (fresh) {
          const img = await getMerchantStyleImageAction(styleId);
          if (!active) return;
          setImage({ imageBase64: img.base64, mimeType: img.mimeType, previewUrl: styleImageUrl });
          setCached(null);
        } else {
          setCached(buildBreakdownFromConfig(loaded.catalogBreakdown, loaded.discoveryFacets.map((f) => f.label)));
          void getMerchantStyleImageAction(styleId)
            .then((img) => {
              if (active) setImage({ imageBase64: img.base64, mimeType: img.mimeType, previewUrl: styleImageUrl });
            })
            .catch(() => {});
        }
        if (active) setIsLoading(false);
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : copy.loadFailed);
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [styleId, language]);

  function showToast(nextMessage: string) {
    setToast({ id: Date.now(), message: nextMessage });
  }

  function successMessage(action: PersistAction) {
    return t(successKeys[action]);
  }

  function failurePrefix(action: PersistAction) {
    return t(failureKeys[action]);
  }

  function returnToLibraryWithFlash(nextMessage: string) {
    window.sessionStorage.setItem(libraryFlashKey, nextMessage);
    router.push('/merchant/styles');
  }

  async function persist(action: PersistAction) {
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
      returnToLibraryWithFlash(successMessage(action));
    } catch (error) {
      const fallback = failurePrefix(action);
      const errorMessage = error instanceof Error ? error.message : fallback;
      const nextMessage = error instanceof Error ? `${fallback}: ${errorMessage}` : fallback;
      setMessage(errorMessage);
      showToast(nextMessage);
      setIsBusy(false);
    }
  }

  function cancelEdit() {
    if (style && style.status !== 'published') {
      void deleteMerchantStyleAction(style.id).catch(() => {});
    }
    router.push('/merchant/styles');
  }

  if (isLoading) {
    return <LoadingState title={copy.loadingTitle} body={copy.loadingBody} />;
  }
  if (!style) {
    return <EmptyState title={copy.notFoundTitle} body={message || copy.notFoundBody} />;
  }

  const action = style.status === 'published' ? 'save' : style.status === 'archived' ? 'republish' : 'publish';
  const actionLabel = t(actionKeys[action]);

  return (
    <div className="merchant-style-editor">
      <label className="merchant-editor-title-field">
        <span className="merchant-editor-title-label">{copy.designName}</span>
        <input
          className="merchant-editor-title-input"
          value={title}
          placeholder={copy.designNamePlaceholder}
          onChange={(event) => {
            titleEditedRef.current = true;
            setTitle(event.currentTarget.value);
          }}
        />
      </label>

      <ComponentBreakdownPanel
        image={image}
        previewUrl={style.imageUrl}
        cachedResult={cached}
        showRemoval={false}
        autoAnalyze={isFresh}
        onResult={(result) => setSelections(result.catalogSelections)}
        onSuggestedStyleName={(suggestion) => {
          if (!isFresh || titleEditedRef.current) return;
          setTitle((current) => current.trim() ? current : suggestion.name);
          if (suggestion.description.trim()) {
            setStyle((current) =>
              current && !current.description.trim()
                ? { ...current, description: suggestion.description.trim() }
                : current,
            );
          }
        }}
        footer={
          <div className="merchant-editor-actions">
            <Button variant="secondary" size="compact" disabled={isBusy} onClick={() => void cancelEdit()}>
              {t('common.cancel')}
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
