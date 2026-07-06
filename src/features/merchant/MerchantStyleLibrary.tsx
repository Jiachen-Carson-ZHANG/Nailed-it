'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MerchantStyleStatus, MerchantStyleView } from '@/domain/merchant-style';
import { Toast } from '@/components/ui/Toast';
import { useLanguage } from '@/i18n/context';
import {
  archiveMerchantStyleAction,
  deleteMerchantStyleAction,
  listMerchantStylesAction,
  uploadMerchantStyleAction,
} from '@/lib/actions/merchant-style-actions';
import { listActiveStyleAdIdsAction } from '@/lib/actions/style-ad-actions';
import { readFileAsBase64 } from '@/lib/file-utils';

const libraryFlashKey = 'merchant-style-library-flash';

const libraryCopy = {
  'zh-CN': {
    uploadAria: '上传新款式',
    uploading: '正在上传…',
    addDesign: '添加新款式',
    tabList: '款式状态',
    published: '已发布',
    archived: '已归档',
    empty: '这里还没有款式',
    collection: '商家款式库',
    notPriced: '尚未定价',
    loadError: '无法加载款式库。',
    uploadError: '上传失败。',
    promote: '推广',
    promoting: '推广中',
  },
  en: {
    uploadAria: 'Upload a new design',
    uploading: 'Uploading design…',
    addDesign: 'Add a new design',
    tabList: 'Design status',
    published: 'Published',
    archived: 'Archived',
    empty: 'No designs here yet.',
    collection: 'Merchant style collection',
    notPriced: 'Not priced yet',
    loadError: 'Unable to load the style library.',
    uploadError: 'Upload failed.',
    promote: 'Promote',
    promoting: 'Promoting',
  },
} as const;

function formatPreview(style: MerchantStyleView, notPriced: string): string {
  if (style.previewPriceCents === null || style.previewDurationMin === null) {
    return notPriced;
  }
  return `$${(style.previewPriceCents / 100).toFixed(2)} · ${style.previewDurationMin} min`;
}

type LibraryTab = 'published' | 'archived';

// No "drafts" lane: a fresh upload opens the editor immediately and is published (or discarded) in one
// sitting, so the library only lists what's live or retired. Unpublished rows (processing/needs_review)
// are mid-edit and never parked in a tab.
const TAB_STATUSES: Record<LibraryTab, MerchantStyleStatus[]> = {
  published: ['published'],
  archived: ['archived'],
};

export function MerchantStyleLibrary() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const copy = libraryCopy[language];
  const tabOrder: { key: LibraryTab; label: string }[] = [
    { key: 'published', label: copy.published },
    { key: 'archived', label: copy.archived },
  ];
  const [styles, setStyles] = useState<MerchantStyleView[]>([]);
  const [activeAdStyleIds, setActiveAdStyleIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<LibraryTab>('published');
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const [isPending, setIsPending] = useState(false);

  const refresh = useCallback(async () => {
    const [nextStyles, activeIds] = await Promise.all([
      listMerchantStylesAction(),
      listActiveStyleAdIdsAction(),
    ]);
    setStyles(nextStyles);
    setActiveAdStyleIds(new Set(activeIds));
  }, []);

  useEffect(() => {
    refresh().catch(() => setMessage(copy.loadError));
  }, [refresh]);

  useEffect(() => {
    const flash = window.sessionStorage.getItem(libraryFlashKey);
    if (!flash) return;
    window.sessionStorage.removeItem(libraryFlashKey);
    setToast({ id: Date.now(), message: flash });
  }, []);

  // Land on the first non-empty tab once (action items first), without overriding a later choice.
  const autoTabbed = useRef(false);
  useEffect(() => {
    if (autoTabbed.current || styles.length === 0) return;
    autoTabbed.current = true;
    const firstWithItems = tabOrder.find((t) => styles.some((s) => TAB_STATUSES[t.key].includes(s.status)));
    if (firstWithItems) setTab(firstWithItems.key);
  }, [styles]);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const image = input.files?.[0];
    if (!image) return;

    setIsPending(true);
    setMessage('');
    try {
      const imageBase64 = await readFileAsBase64(image);
      const formData = new FormData();
      formData.set('imageBase64', imageBase64);
      formData.set('mimeType', image.type);
      const draft = await uploadMerchantStyleAction(formData);
      router.push(`/merchant/styles/${draft.id}/review`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.uploadError);
      input.value = '';
      setIsPending(false);
    }
  }

  async function archive(styleId: string) {
    setIsPending(true);
    setMessage('');
    try {
      await archiveMerchantStyleAction(styleId);
      await refresh();
      setToast({ id: Date.now(), message: t('common.archived') });
    } catch (error) {
      const fallback = t('common.archiveFailed');
      const errorMessage = error instanceof Error ? error.message : fallback;
      setMessage(errorMessage);
      setToast({ id: Date.now(), message: error instanceof Error ? `${fallback}: ${errorMessage}` : fallback });
    } finally {
      setIsPending(false);
    }
  }

  async function remove(styleId: string) {
    if (!window.confirm(t('common.deleteConfirm'))) return;
    setIsPending(true);
    setMessage('');
    try {
      await deleteMerchantStyleAction(styleId);
      await refresh();
      setToast({ id: Date.now(), message: t('common.deleted') });
    } catch (error) {
      const fallback = t('common.deleteFailed');
      const errorMessage = error instanceof Error ? error.message : fallback;
      setMessage(errorMessage);
      setToast({ id: Date.now(), message: error instanceof Error ? `${fallback}: ${errorMessage}` : fallback });
    } finally {
      setIsPending(false);
    }
  }

  const countByTab = useMemo(() => {
    const counts: Record<LibraryTab, number> = { published: 0, archived: 0 };
    for (const style of styles) {
      for (const key of tabOrder) {
        if (TAB_STATUSES[key.key].includes(style.status)) counts[key.key] += 1;
      }
    }
    return counts;
  }, [styles]);

  const visible = styles.filter((style) => TAB_STATUSES[tab].includes(style.status));

  return (
    <div className="merchant-style-library">
      <label className={`image-uploader merchant-style-upload-tile${isPending ? ' is-pending' : ''}`}>
        <input
          accept="image/jpeg,image/png,image/webp"
          aria-label={copy.uploadAria}
          disabled={isPending}
          hidden
          type="file"
          onChange={handleUpload}
        />
        <div aria-hidden="true" className="image-uploader-placeholder">
          <span className="image-uploader-mark">＋</span>
        </div>
        <div className="image-uploader-copy">
          <strong>{isPending ? copy.uploading : copy.addDesign}</strong>
        </div>
      </label>

      <div className="merchant-library-tabs" role="tablist" aria-label={copy.tabList}>
        {tabOrder.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'merchant-library-tab merchant-library-tab-active' : 'merchant-library-tab'}
            onClick={() => setTab(key)}
          >
            {label}
            <span className="merchant-library-tab-count">{countByTab[key]}</span>
          </button>
        ))}
      </div>

      {message ? <p className="helper-copy" role="status">{message}</p> : null}

      {visible.length === 0 ? (
        <p className="merchant-review-empty">{copy.empty}</p>
      ) : (
        <section aria-label={copy.collection} className="merchant-style-management-grid">
          {visible.map((style) => {
            const isPublished = style.status === 'published';
            const isArchived = style.status === 'archived';
            const isPromoting = activeAdStyleIds.has(style.id);
            const imageUrl = style.imageUrl.trim();
            return (
              <article className="merchant-style-management-card" key={style.id}>
                {imageUrl ? <img alt={style.title} src={imageUrl} /> : null}
                <div className="merchant-style-card-body">
                  <div className="merchant-style-card-heading">
                    <strong>{style.title}</strong>
                    <p className="merchant-style-card-preview">{formatPreview(style, copy.notPriced)}</p>
                  </div>
                  <div className="merchant-style-card-actions">
                    <Link
                      className="button button-secondary button-compact"
                      href={`/merchant/styles/${style.id}/review`}
                    >
                      {isPublished ? t('common.edit') : isArchived ? t('common.view') : t('common.edit')}
                    </Link>
                    {isPublished ? (
                      <Link
                        className={
                          isPromoting
                            ? 'button button-secondary button-compact merchant-style-promote-active'
                            : 'button button-primary button-compact'
                        }
                        href={`/merchant/styles/${style.id}/ads`}
                      >
                        {isPromoting ? copy.promoting : copy.promote}
                      </Link>
                    ) : null}
                    {isPublished ? (
                      <button
                        className="button button-ghost button-compact"
                        disabled={isPending}
                        type="button"
                        onClick={() => archive(style.id)}
                      >
                        {t('common.archive')}
                      </button>
                    ) : null}
                    {!isPublished ? (
                      <button
                        className="button button-ghost button-compact merchant-style-delete"
                        disabled={isPending}
                        type="button"
                        onClick={() => remove(style.id)}
                      >
                        {t('common.delete')}
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <Toast key={toast?.id} message={toast?.message ?? ''} />
    </div>
  );
}
