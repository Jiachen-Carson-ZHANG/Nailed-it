'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { MerchantStyleView } from '@/domain/merchant-style';
import {
  archiveMerchantStyleAction,
  listConfigurableCatalogAction,
  listMerchantStylesAction,
  publishMerchantStyleAction,
  uploadMerchantStyleAction,
  type ConfigurableCatalogItem,
} from '@/lib/actions/merchant-style-actions';

export function MerchantStyleLibrary() {
  const [styles, setStyles] = useState<MerchantStyleView[]>([]);
  const [catalog, setCatalog] = useState<ConfigurableCatalogItem[]>([]);
  const [message, setMessage] = useState('');
  const [isPending, setIsPending] = useState(false);

  const refresh = useCallback(async () => {
    setStyles(await listMerchantStylesAction());
  }, []);

  useEffect(() => {
    refresh().catch(() => setMessage('Unable to load the style library.'));
    listConfigurableCatalogAction()
      .then(setCatalog)
      .catch(() => setMessage('Unable to load the catalog.'));
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
    // Price + duration are derived server-side from the chosen catalog items, never typed here.
    const selections = data.getAll('selection').map((id) => {
      const quantity = Number(data.get(`qty-${String(id)}`)) || 1;
      return { catalogItemId: String(id), quantity };
    });
    run(
      () =>
        publishMerchantStyleAction({
          styleId,
          title: String(data.get('title') ?? ''),
          description: String(data.get('description') ?? ''),
          selections,
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
                  <label className="field">
                    <span>Description</span>
                    <textarea defaultValue={style.description} name="description" rows={2} />
                  </label>
                  <fieldset className="merchant-style-selections">
                    <legend>Service breakdown (price &amp; time are auto-calculated)</legend>
                    {catalog.map((item) => {
                      const existing = style.catalogBreakdown.find((s) => s.catalogItemId === item.id);
                      return (
                        <div className="merchant-style-selection-row" key={item.id}>
                          <label>
                            <input
                              defaultChecked={Boolean(existing)}
                              name="selection"
                              type="checkbox"
                              value={item.id}
                            />
                            <span>{item.nameZh}</span>
                            <small>{item.defaultPricingUnit}</small>
                          </label>
                          <input
                            aria-label={`${item.nameZh} quantity`}
                            defaultValue={existing?.quantity ?? 1}
                            min="1"
                            name={`qty-${item.id}`}
                            step="1"
                            type="number"
                          />
                        </div>
                      );
                    })}
                  </fieldset>
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
