'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LoadingState } from '@/components/ui/LoadingState';
import type { CatalogSelection } from '@/domain/catalog';
import type { MerchantStyleView } from '@/domain/merchant-style';
import {
  analyzeMerchantStyleAction,
  configureMerchantStyleManuallyAction,
  getMerchantStyleReviewAction,
  listConfigurableCatalogAction,
  previewMerchantStyleQuoteAction,
  publishMerchantStyleAction,
  saveMerchantStyleDraftAction,
  type ConfigurableCatalogItem,
} from '@/lib/actions/merchant-style-actions';
import { useLanguage } from '@/i18n/context';
import type { Quote } from '@/lib/services/quote-service';

type MerchantStyleReviewWorkspaceProps = {
  styleId: string;
};

const BASE_MANICURE_ID = 'basic_manicure_service';

// Add-services list is grouped by catalog category so it scans like the Manage tab instead of one
// long flat list. Categories map to a small set of merchant-facing sections; unknowns fall to 其他.
const CATALOG_SECTIONS: { key: string; label: string; categories: string[] }[] = [
  { key: 'base', label: '基础护理', categories: ['base_service'] },
  { key: 'structure', label: '建构延长', categories: ['structure'] },
  { key: 'color', label: '颜色与效果', categories: ['color_effect'] },
  { key: 'art', label: '美术设计', categories: ['art'] },
  { key: 'decoration', label: '装饰', categories: ['decoration'] },
  { key: 'removal', label: '卸甲', categories: ['removal'] },
  { key: 'other', label: '其他', categories: [] },
];
const SECTION_KEY_BY_CATEGORY = new Map(
  CATALOG_SECTIONS.flatMap((section) => section.categories.map((category) => [category, section.key])),
);

function normalizeSelection(item: ConfigurableCatalogItem, quantity: number): CatalogSelection {
  return {
    catalogItemId: item.id,
    quantity: item.quantityLocked ? 1 : Math.max(1, Math.trunc(quantity) || 1),
  };
}

// Order-insensitive signature of a selection set, used to tell whether a published edit changed anything.
function selectionsKey(selections: CatalogSelection[]): string {
  return selections.map((s) => `${s.catalogItemId}:${s.quantity}`).sort().join('|');
}

export function MerchantStyleReviewWorkspace({ styleId }: MerchantStyleReviewWorkspaceProps) {
  const { language } = useLanguage();
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
  // Snapshot of the loaded config so a published edit can tell whether anything actually changed.
  const baselineRef = useRef<{ title: string; description: string; selKey: string }>({
    title: '',
    description: '',
    selKey: '',
  });

  function syncStyle(next: MerchantStyleView) {
    setStyle(next);
    setTitle(next.title);
    setDescription(next.description);
    // Always show the mandatory base manicure (the $28/51-min floor) so the live total is right and
    // the merchant can see the prep that's included. The server injects it on save regardless.
    const hasBase = next.catalogBreakdown.some((s) => s.catalogItemId === BASE_MANICURE_ID);
    const nextSelections = hasBase
      ? next.catalogBreakdown
      : [{ catalogItemId: BASE_MANICURE_ID, quantity: 1 }, ...next.catalogBreakdown];
    setSelections(nextSelections);
    baselineRef.current = {
      title: next.title,
      description: next.description,
      selKey: selectionsKey(nextSelections),
    };
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

  async function runAiBreakdown() {
    if (!style || style.status !== 'processing') return;
    setIsAnalyzing(true);
    setMessage('');
    try {
      let analyzed = await analyzeMerchantStyleAction(style.id, language);
      for (let attempt = 0; analyzed.status === 'processing' && attempt < 30; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const current = await getMerchantStyleReviewAction(style.id);
        if (!current) break;
        analyzed = current;
      }
      syncStyle(analyzed);
      if (analyzed.status === 'processing') {
        setMessage('Analysis is still running. Reload this page in a moment.');
      } else if (analyzed.catalogBreakdown.length === 0) {
        setMessage('AI could not complete the breakdown. Review the design manually.');
      } else {
        setMessage('AI breakdown ready. Review before publishing.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to run AI breakdown.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function configureManually() {
    if (!style || style.status !== 'processing') return;
    setIsSaving(true);
    setMessage('');
    try {
      syncStyle(await configureMerchantStyleManuallyAction(style.id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to open manual configuration.');
    } finally {
      setIsSaving(false);
    }
  }

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
  const groupedAvailable = CATALOG_SECTIONS.flatMap((section) => {
    const items = availableItems.filter(
      (item) => (SECTION_KEY_BY_CATEGORY.get(item.category) ?? 'other') === section.key,
    );
    return items.length > 0 ? [{ section, items }] : [];
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
      // Saving is a terminal step — return to the library so the merchant sees the updated card.
      router.push('/merchant/styles');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save draft.');
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
  const isProcessing = style.status === 'processing';
  const isPublished = style.status === 'published';
  const isFailed = style.status === 'failed';
  // A published style stays editable so the merchant can fix a wrong layer; changes go straight live.
  const editable = canEdit || isPublished;
  const showEditor = editable && !isAnalyzing;
  const hasValidQuote = Boolean(title.trim()) && Boolean(quote?.totalPriceCents && quote.totalDurationMin);
  const canPublish = canEdit && hasValidQuote;
  const isDirty =
    title.trim() !== baselineRef.current.title.trim() ||
    description !== baselineRef.current.description ||
    selectionsKey(selections) !== baselineRef.current.selKey;

  return (
    <div className="merchant-review-workspace">
      <header className="merchant-review-heading">
        <Link className="merchant-review-back" href="/merchant/styles">Collection</Link>
        <h1>{isProcessing || isAnalyzing ? 'Analyze design' : isPublished ? 'Published design' : 'Review design'}</h1>
        {!isPublished ? (
          <p>
            {isProcessing || isAnalyzing
              ? 'AI suggests the name, description, and service breakdown. You can edit everything after.'
              : 'Confirm every service that affects the customer price or booking time, then publish.'}
          </p>
        ) : null}
      </header>

      <div className="merchant-review-media">
        <img alt={style.title} src={style.imageUrl} />
      </div>

      {isAnalyzing ? (
        <LoadingState title="AI is analyzing this design" body="Detecting nail shape, colors, and the priced service breakdown…" />
      ) : null}

      {isProcessing && !isAnalyzing ? (
        <section className="merchant-review-cta">
          <button
            className="button button-primary button-block"
            disabled={isSaving}
            type="button"
            onClick={runAiBreakdown}
          >
            Run AI breakdown
          </button>
          <button
            className="button button-ghost button-block"
            disabled={isSaving}
            type="button"
            onClick={configureManually}
          >
            Configure manually instead
          </button>
          {message ? <p className="helper-copy" role="status">{message}</p> : null}
        </section>
      ) : null}

      {isFailed && !isAnalyzing ? (
        <section className="merchant-review-cta">
          <p className="merchant-review-empty">{message || 'Analysis failed for this upload. Archive it and upload the photo again.'}</p>
          <Link className="button button-secondary button-block" href="/merchant/styles">Back to collection</Link>
        </section>
      ) : null}

      {showEditor ? (
        <>
          <div className="merchant-review-quote" aria-label="Quote preview">
            <span>
              <small>Reference price</small>
              <strong>{quote ? `$${(quote.totalPriceCents / 100).toFixed(2)}` : '—'}</strong>
            </span>
            <span>
              <small>Booking time</small>
              <strong>{quote ? `${quote.totalDurationMin} min` : '—'}</strong>
            </span>
          </div>

          <section className="merchant-review-section">
            <div className="merchant-review-section-heading">
              <h2>Design details</h2>
            </div>
            <label className="field">
              <span>Design title</span>
              <input
                disabled={!editable || isSaving}
                placeholder="Name this design"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea
                disabled={!editable || isSaving}
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
          </section>

          <section className="merchant-review-section">
            <div className="merchant-review-section-heading">
              <h2>Services</h2>
              {selectedItems.length > 0 ? <span>{selectedItems.length}</span> : null}
            </div>
            {selectedItems.length === 0 ? (
              <p className="merchant-review-empty">AI did not detect any priced services. Add them below.</p>
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
                      </small>
                    </div>
                    <label className="merchant-review-quantity">
                      <span>Qty</span>
                      <input
                        aria-label={`${item.nameZh} quantity`}
                        disabled={!editable || isSaving || item.quantityLocked}
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
                      disabled={!editable || isSaving || item.id === BASE_MANICURE_ID}
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

          {editable ? (
            <section className="merchant-review-section">
              <div className="merchant-review-section-heading">
                <h2>Add services</h2>
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
              {groupedAvailable.length === 0 ? (
                <p className="merchant-review-empty">No more services match your search.</p>
              ) : (
                groupedAvailable.map(({ section, items }) => (
                  <div className="merchant-review-catalog-group" key={section.key}>
                    <p className="merchant-review-catalog-group-title">{section.label}</p>
                    <div className="merchant-review-catalog-list">
                      {items.map((item) => (
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
                            disabled={isSaving || !item.enabled}
                            type="button"
                            onClick={() => addSelection(item)}
                          >
                            +
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </section>
          ) : null}
        </>
      ) : null}

      {showEditor ? (
        <footer className="merchant-review-actions">
          {message ? <p role="status">{message}</p> : null}
          {isPublished ? (
            <div>
              <Link className="button button-secondary button-default" href="/merchant/styles">
                ← Back
              </Link>
              <button
                className="button button-primary button-default"
                disabled={!hasValidQuote || !isDirty || isSaving}
                type="button"
                onClick={saveDraft}
              >
                Save changes
              </button>
            </div>
          ) : (
            <div>
              <button
                className="button button-secondary button-default"
                disabled={isSaving}
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
          )}
        </footer>
      ) : null}
    </div>
  );
}
