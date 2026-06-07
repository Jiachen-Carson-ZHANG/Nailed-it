'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MerchantStyleStatus, MerchantStyleView } from '@/domain/merchant-style';
import {
  archiveMerchantStyleAction,
  deleteMerchantStyleAction,
  listMerchantStylesAction,
  uploadMerchantStyleAction,
} from '@/lib/actions/merchant-style-actions';

function formatPreview(style: MerchantStyleView): string {
  if (style.previewPriceCents === null || style.previewDurationMin === null) {
    return 'Not priced yet';
  }
  return `$${(style.previewPriceCents / 100).toFixed(2)} · ${style.previewDurationMin} min`;
}

type LibraryTab = 'processing' | 'published' | 'archived';

// needs_review + failed live with processing — none are published yet, so they share the same lane.
const TAB_STATUSES: Record<LibraryTab, MerchantStyleStatus[]> = {
  processing: ['processing', 'needs_review', 'failed'],
  published: ['published'],
  archived: ['archived'],
};
const TAB_ORDER: { key: LibraryTab; label: string }[] = [
  { key: 'processing', label: 'Processing' },
  { key: 'published', label: 'Published' },
  { key: 'archived', label: 'Archived' },
];

export function MerchantStyleLibrary() {
  const router = useRouter();
  const [styles, setStyles] = useState<MerchantStyleView[]>([]);
  const [tab, setTab] = useState<LibraryTab>('processing');
  const [message, setMessage] = useState('');
  const [isPending, setIsPending] = useState(false);

  const refresh = useCallback(async () => {
    setStyles(await listMerchantStylesAction());
  }, []);

  useEffect(() => {
    refresh().catch(() => setMessage('Unable to load the style library.'));
  }, [refresh]);

  // Land on the first non-empty tab once (action items first), without overriding a later choice.
  const autoTabbed = useRef(false);
  useEffect(() => {
    if (autoTabbed.current || styles.length === 0) return;
    autoTabbed.current = true;
    const firstWithItems = TAB_ORDER.find((t) => styles.some((s) => TAB_STATUSES[t.key].includes(s.status)));
    if (firstWithItems) setTab(firstWithItems.key);
  }, [styles]);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const image = input.files?.[0];
    if (!image) return;

    setIsPending(true);
    setMessage('');
    try {
      const formData = new FormData();
      formData.set('image', image);
      const draft = await uploadMerchantStyleAction(formData);
      router.push(`/merchant/styles/${draft.id}/review`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed.');
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
      setMessage('Style archived.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Archive failed.');
    } finally {
      setIsPending(false);
    }
  }

  async function remove(styleId: string) {
    if (!window.confirm('Delete this design? This cannot be undone.')) return;
    setIsPending(true);
    setMessage('');
    try {
      await deleteMerchantStyleAction(styleId);
      await refresh();
      setMessage('Design deleted.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Delete failed.');
    } finally {
      setIsPending(false);
    }
  }

  const countByTab = useMemo(() => {
    const counts: Record<LibraryTab, number> = { processing: 0, published: 0, archived: 0 };
    for (const style of styles) {
      for (const key of TAB_ORDER) {
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
          aria-label="Upload a new design"
          disabled={isPending}
          hidden
          type="file"
          onChange={handleUpload}
        />
        <div aria-hidden="true" className="image-uploader-placeholder">
          <span className="image-uploader-mark">＋</span>
        </div>
        <div className="image-uploader-copy">
          <strong>{isPending ? 'Uploading design…' : 'Add a new design'}</strong>
        </div>
      </label>

      <div className="merchant-library-tabs" role="tablist" aria-label="Design status">
        {TAB_ORDER.map(({ key, label }) => (
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
        <p className="merchant-review-empty">No designs here yet.</p>
      ) : (
        <section aria-label="Merchant style collection" className="merchant-style-management-grid">
          {visible.map((style) => {
            const isPublished = style.status === 'published';
            const isArchived = style.status === 'archived';
            return (
              <article className="merchant-style-management-card" key={style.id}>
                <img alt={style.title} src={style.imageUrl} />
                <div className="merchant-style-card-body">
                  <div className="merchant-style-card-heading">
                    <strong>{style.title}</strong>
                    <p className="merchant-style-card-preview">{formatPreview(style)}</p>
                  </div>
                  <div className="merchant-style-card-actions">
                    <Link
                      className="button button-secondary button-default"
                      href={`/merchant/styles/${style.id}/review`}
                    >
                      {isPublished ? 'Edit' : isArchived ? 'View' : 'Review'}
                    </Link>
                    {isPublished ? (
                      <button
                        className="button button-ghost button-default"
                        disabled={isPending}
                        type="button"
                        onClick={() => archive(style.id)}
                      >
                        Archive
                      </button>
                    ) : null}
                    {!isPublished ? (
                      <button
                        className="button button-ghost button-default merchant-style-delete"
                        disabled={isPending}
                        type="button"
                        onClick={() => remove(style.id)}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
