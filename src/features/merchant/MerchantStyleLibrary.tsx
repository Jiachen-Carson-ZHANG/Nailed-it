'use client';

import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MerchantStyleView } from '@/domain/merchant-style';
import {
  archiveMerchantStyleAction,
  listMerchantStylesAction,
  uploadMerchantStyleAction,
} from '@/lib/actions/merchant-style-actions';

function formatPreview(style: MerchantStyleView): string {
  if (style.previewPriceCents === null || style.previewDurationMin === null) {
    return 'Review required';
  }
  return `$${(style.previewPriceCents / 100).toFixed(2)} · ${style.previewDurationMin} min`;
}

export function MerchantStyleLibrary() {
  const router = useRouter();
  const [styles, setStyles] = useState<MerchantStyleView[]>([]);
  const [message, setMessage] = useState('');
  const [isPending, setIsPending] = useState(false);

  const refresh = useCallback(async () => {
    setStyles(await listMerchantStylesAction());
  }, []);

  useEffect(() => {
    refresh().catch(() => setMessage('Unable to load the style library.'));
  }, [refresh]);

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
          <p>One photo — AI drafts the name, price, and services for you to review.</p>
        </div>
      </label>

      {message ? <p className="helper-copy" role="status">{message}</p> : null}

      <section aria-label="Merchant style collection" className="merchant-style-management-grid">
        {styles.map((style) => (
          <article className="merchant-style-management-card" key={style.id}>
            <img alt={style.title} src={style.imageUrl} />
            <div className="merchant-style-card-body">
              <div className="merchant-style-card-heading">
                <div>
                  <strong>{style.title}</strong>
                  <p className="merchant-style-card-preview">{formatPreview(style)}</p>
                </div>
                <span className={`merchant-style-status merchant-style-status-${style.status}`}>
                  {style.status.replace('_', ' ')}
                </span>
              </div>
              <div className="merchant-style-card-actions">
                {style.status === 'published' ? (
                  <Link className="button button-secondary button-default" href={`/merchant/styles/${style.id}/review`}>
                    View
                  </Link>
                ) : null}
                {style.status === 'processing' || style.status === 'needs_review' ? (
                  <Link
                    className="button button-primary button-default"
                    href={`/merchant/styles/${style.id}/review`}
                  >
                    Review
                  </Link>
                ) : null}
                {style.status === 'needs_review' || style.status === 'published' || style.status === 'failed' ? (
                  <button
                    className="button button-ghost button-default"
                    disabled={isPending}
                    type="button"
                    onClick={() => archive(style.id)}
                  >
                    Archive
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
