'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CatalogSelection } from '@/domain/catalog';
import type { MerchantStyleView } from '@/domain/merchant-style';
import {
  analyzeMerchantStyleAction,
  getMerchantStyleReviewAction,
  listConfigurableCatalogAction,
  previewMerchantStyleQuoteAction,
  publishMerchantStyleAction,
  saveMerchantStyleDraftAction,
  type ConfigurableCatalogItem,
} from '@/lib/actions/merchant-style-actions';
import type { Quote } from '@/lib/services/quote-service';

type MerchantStyleReviewWorkspaceProps = {
  styleId: string;
};

function normalizeSelection(item: ConfigurableCatalogItem, quantity: number): CatalogSelection {
  return {
    catalogItemId: item.id,
    quantity: item.quantityLocked ? 1 : Math.max(1, Math.trunc(quantity) || 1),
  };
}

export function MerchantStyleReviewWorkspace({ styleId }: MerchantStyleReviewWorkspaceProps) {
  const router = useRouter();
  const [style, setStyle] = useState<MerchantStyleView | null>(null);
  const [catalog, setCatalog] = useState<ConfigurableCatalogItem[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selections, setSelections] = useState<CatalogSelection[]>([]);
  const [search, setSearch] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  function syncStyle(next: MerchantStyleView) {
    setStyle(next);
    setTitle(next.title);
    setDescription(next.description);
    setSelections(next.catalogBreakdown);
  }

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [initial, configurableCatalog] = await Promise.all([
          getMerchantStyleReviewAction(styleId),
          listConfigurableCatalogAction(),
        ]);
        if (!active) return;
        setCatalog(configurableCatalog);
        if (!initial) {
          setMessage('Style not found.');
          return;
        }
        syncStyle(initial);
        setIsLoading(false);
        if (initial.status === 'processing') {
          setIsAnalyzing(true);
          let analyzed = await analyzeMerchantStyleAction(styleId);
          // A second page instance may lose the atomic AI claim. Follow the owner request's result
          // instead of spending a duplicate model call or leaving this page stale.
          for (let attempt = 0; active && analyzed.status === 'processing' && attempt < 30; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const current = await getMerchantStyleReviewAction(styleId);
            if (!current) break;
            analyzed = current;
          }
          if (active) syncStyle(analyzed);
          if (active && analyzed.status === 'processing') {
            setMessage('Analysis is still running. Reload this page in a moment.');
          }
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'Unable to load this style.');
      } finally {
        if (active) {
          setIsAnalyzing(false);
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [styleId]);

  useEffect(() => {
    let active = true;
    if (selections.length === 0) {
      setQuote(null);
      return () => {
        active = false;
      };
    }

    previewMerchantStyleQuoteAction(selections)
      .then((next) => {
        if (active) {
          setQuote(next);
          setMessage('');
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setQuote(null);
          setMessage(error instanceof Error ? error.message : 'Unable to price this selection.');
        }
      });
    return () => {
      active = false;
    };
  }, [selections]);

  const catalogById = useMemo(
    () => new Map(catalog.map((item) => [item.id, item])),
    [catalog],
  );
  const selectedItems = selections.flatMap((selection) => {
    const item = catalogById.get(selection.catalogItemId);
    return item ? [{ item, selection }] : [];
  });
  const searchTerm = search.trim().toLocaleLowerCase();
  const availableItems = catalog.filter((item) => {
    if (selections.some((selection) => selection.catalogItemId === item.id)) return false;
    if (!searchTerm) return true;
    return item.nameZh.toLocaleLowerCase().includes(searchTerm)
      || item.id.toLocaleLowerCase().includes(searchTerm);
  });

  function addSelection(item: ConfigurableCatalogItem) {
    setSelections((current) => [...current, normalizeSelection(item, 1)]);
  }

  function updateQuantity(item: ConfigurableCatalogItem, quantity: number) {
    setSelections((current) => current.map((selection) => (
      selection.catalogItemId === item.id ? normalizeSelection(item, quantity) : selection
    )));
  }

  function removeSelection(catalogItemId: string) {
    setSelections((current) => current.filter((selection) => selection.catalogItemId !== catalogItemId));
  }

  async function saveDraft() {
    if (!style) return;
    setIsSaving(true);
    setMessage('');
    try {
      const saved = await saveMerchantStyleDraftAction({
        styleId: style.id,
        title,
        description,
        selections,
      });
      syncStyle(saved);
      setMessage('Draft saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save draft.');
    } finally {
      setIsSaving(false);
    }
  }

  async function publish() {
    if (!style) return;
    setIsSaving(true);
    setMessage('');
    try {
      await publishMerchantStyleAction({
        styleId: style.id,
        title,
        description,
        selections,
      });
      router.push('/merchant/styles');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to publish style.');
      setIsSaving(false);
    }
  }

  if (isLoading && !style) {
    return (
      <section className="merchant-review-loading" aria-live="polite">
        <span className="loading-dot" />
        <strong>Preparing review workspace</strong>
      </section>
    );
  }

  if (!style) {
    return (
      <section className="empty-state">
        <strong>Style unavailable</strong>
        <p>{message || 'This design could not be loaded.'}</p>
        <Link className="button button-secondary button-default" href="/merchant/styles">Back to collection</Link>
      </section>
    );
  }

  const canEdit = style.status === 'needs_review';
  const canPublish = canEdit && Boolean(title.trim()) && Boolean(quote?.totalPriceCents && quote.totalDurationMin);

  return (
    <div className="merchant-review-workspace">
      <header className="merchant-review-heading">
        <div>
          <Link className="merchant-review-back" href="/merchant/styles">← Collection</Link>
          <p className="section-eyebrow">Merchant collection</p>
          <h1>Review design</h1>
          <p>Confirm every service that affects the customer price or booking time.</p>
        </div>
        <span className={`merchant-style-status merchant-style-status-${style.status}`}>
          {isAnalyzing ? 'Analyzing' : style.status.replace('_', ' ')}
        </span>
      </header>

      {isAnalyzing ? (
        <section className="merchant-review-analysis" aria-live="polite">
          <span className="loading-dot" />
          <div>
            <strong>Analyzing the uploaded design</strong>
            <p>The image is already stored. AI suggestions will appear here when ready.</p>
          </div>
        </section>
      ) : null}

      <div className="merchant-review-layout">
        <aside className="merchant-review-media">
          <img alt={style.title} src={style.imageUrl} />
          <div className="merchant-review-quote" aria-label="Quote preview">
            <span>
              <small>Preview price</small>
              <strong>{quote ? `$${(quote.totalPriceCents / 100).toFixed(2)}` : '—'}</strong>
            </span>
            <span>
              <small>Booking time</small>
              <strong>{quote ? `${quote.totalDurationMin} min` : '—'}</strong>
            </span>
          </div>
        </aside>

        <div className="merchant-review-editor">
          <section className="merchant-review-section">
            <div className="merchant-review-section-heading">
              <div>
                <p className="section-eyebrow">Customer-facing details</p>
                <h2>Design details</h2>
              </div>
            </div>
            <label className="field">
              <span>Design title</span>
              <input
                disabled={!canEdit || isSaving}
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea
                disabled={!canEdit || isSaving}
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
          </section>

          <section className="merchant-review-section">
            <div className="merchant-review-section-heading">
              <div>
                <p className="section-eyebrow">Price and time</p>
                <h2>Selected services</h2>
              </div>
              <span>{selectedItems.length}</span>
            </div>
            {selectedItems.length === 0 ? (
              <p className="merchant-review-empty">No services selected yet. Add everything required to create this design.</p>
            ) : (
              <div className="merchant-review-selected-list">
                {selectedItems.map(({ item, selection }) => (
                  <div className="merchant-review-service-row" key={item.id}>
                    <div>
                      <strong>{item.nameZh}</strong>
                      <small>
                        {item.enabled ? `$${(item.priceCents / 100).toFixed(2)}` : 'Unavailable'}
                        {' · '}
                        {item.affectsDuration ? `${item.durationMin} min` : 'No booking time'}
                        {' · '}
                        {item.pricingUnit}
                      </small>
                    </div>
                    <label className="merchant-review-quantity">
                      <span>Qty</span>
                      <input
                        aria-label={`${item.nameZh} quantity`}
                        disabled={!canEdit || isSaving || item.quantityLocked}
                        min="1"
                        step="1"
                        type="number"
                        value={item.quantityLocked ? 1 : selection.quantity}
                        onChange={(event) => updateQuantity(item, Number(event.target.value))}
                      />
                    </label>
                    <button
                      aria-label={`Remove ${item.nameZh}`}
                      className="merchant-review-remove"
                      disabled={!canEdit || isSaving}
                      type="button"
                      onClick={() => removeSelection(item.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="merchant-review-section">
            <div className="merchant-review-section-heading">
              <div>
                <p className="section-eyebrow">Catalog</p>
                <h2>Add services</h2>
              </div>
            </div>
            <label className="merchant-review-search">
              <span className="sr-only">Search services</span>
              <input
                aria-label="Search services"
                placeholder="Search services"
                role="searchbox"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="merchant-review-catalog-list">
              {availableItems.map((item) => (
                <div className="merchant-review-catalog-row" key={item.id}>
                  <div>
                    <strong>{item.nameZh}</strong>
                    <small>
                      {item.enabled ? `$${(item.priceCents / 100).toFixed(2)}` : 'Pricing unavailable'}
                      {' · '}
                      {item.affectsDuration ? `${item.durationMin} min` : 'No booking time'}
                    </small>
                  </div>
                  <button
                    aria-label={`Add ${item.nameZh}`}
                    className="merchant-review-add"
                    disabled={!canEdit || isSaving || !item.enabled}
                    type="button"
                    onClick={() => addSelection(item)}
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <footer className="merchant-review-actions">
        <div>
          <strong>{quote ? `$${(quote.totalPriceCents / 100).toFixed(2)} · ${quote.totalDurationMin} min` : 'Add services to calculate quote'}</strong>
          {message ? <p role="status">{message}</p> : <p>AI suggestions remain private until you publish.</p>}
        </div>
        <div>
          <button
            className="button button-secondary button-default"
            disabled={!canEdit || isSaving}
            type="button"
            onClick={saveDraft}
          >
            Save draft
          </button>
          <button
            className="button button-primary button-default"
            disabled={!canPublish || isSaving}
            type="button"
            onClick={publish}
          >
            Publish
          </button>
        </div>
      </footer>
    </div>
  );
}
