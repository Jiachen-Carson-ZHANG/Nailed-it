'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { MerchantStyleView } from '@/domain/merchant-style';
import {
  archiveMerchantStyleAction,
  listMerchantStylesAction,
  publishMerchantStyleAction,
  uploadMerchantStyleAction,
} from '@/lib/actions/merchant-style-actions';

export function MerchantStyleLibrary() {
  const [styles, setStyles] = useState<MerchantStyleView[]>([]);
  const [message, setMessage] = useState('');
  const [isPending, setIsPending] = useState(false);

  const refresh = useCallback(async () => {
    setStyles(await listMerchantStylesAction());
  }, []);

  useEffect(() => {
    refresh().catch(() => setMessage('Unable to load the style library.'));
  }, [refresh]);

  function run(command: () => Promise<unknown>, success: string) {
    setIsPending(true);
    command()
      .then(refresh)
      .then(() => setMessage(success))
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Action failed.'))
      .finally(() => setIsPending(false));
  }

  function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    run(() => uploadMerchantStyleAction(new FormData(form)), 'Upload ready for review.');
    form.reset();
  }

  function handlePublish(event: FormEvent<HTMLFormElement>, styleId: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    run(
      () =>
        publishMerchantStyleAction({
          styleId,
          title: String(data.get('title') ?? ''),
          previewPriceCents: Math.round(Number(data.get('price')) * 100),
          previewDurationMin: Number(data.get('duration')),
        }),
      'Style published to customer discovery.',
    );
  }

  return (
    <div className="merchant-style-library">
      <form className="merchant-style-upload" onSubmit={handleUpload}>
        <div>
          <p className="section-eyebrow">New design</p>
          <h2>Upload to your collection</h2>
        </div>
        <label className="field">
          <span>Style title</span>
          <input name="title" required type="text" />
        </label>
        <label className="field">
          <span>Design image</span>
          <input accept="image/jpeg,image/png,image/webp" name="image" required type="file" />
        </label>
        <button className="button button-primary button-block" disabled={isPending} type="submit">
          Upload for review
        </button>
      </form>

      {message ? <p className="helper-copy" role="status">{message}</p> : null}

      <section aria-label="Merchant style collection" className="merchant-style-management-grid">
        {styles.map((style) => (
          <article className="merchant-style-management-card" key={style.id}>
            <img alt={style.title} src={style.imageUrl} />
            <div className="merchant-style-card-body">
              <div className="merchant-style-card-heading">
                <strong>{style.title}</strong>
                <span className={`merchant-style-status merchant-style-status-${style.status}`}>
                  {style.status.replace('_', ' ')}
                </span>
              </div>
              {style.status === 'needs_review' ? (
                <form className="merchant-style-review-form" onSubmit={(event) => handlePublish(event, style.id)}>
                  <label className="field">
                    <span>Reviewed title</span>
                    <input defaultValue={style.title} name="title" required type="text" />
                  </label>
                  <div className="merchant-style-review-numbers">
                    <label className="field">
                      <span>From price</span>
                      <input min="0" name="price" required step="0.01" type="number" />
                    </label>
                    <label className="field">
                      <span>Duration min</span>
                      <input min="1" name="duration" required step="1" type="number" />
                    </label>
                  </div>
                  <button className="button button-primary button-block" disabled={isPending} type="submit">
                    Publish
                  </button>
                </form>
              ) : null}
              {style.status !== 'archived' ? (
                <button
                  className="button button-secondary button-block"
                  disabled={isPending}
                  type="button"
                  onClick={() => run(() => archiveMerchantStyleAction(style.id), 'Style archived.')}
                >
                  Archive
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
