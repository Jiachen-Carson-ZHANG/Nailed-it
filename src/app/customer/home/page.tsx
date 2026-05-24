 'use client';

import { useMemo, useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { getTrendingStyles } from '@/mock/styles';
import { StyleWaterfallGrid } from '@/features/customer/StyleWaterfallGrid';

export default function CustomerHomePage() {
  const styles = getTrendingStyles();
  const [selectedStyleLabels, setSelectedStyleLabels] = useState<string[]>([]);
  const [stylesMenuOpen, setStylesMenuOpen] = useState(false);
  const [minimumPriceInput, setMinimumPriceInput] = useState('');
  const [maximumPriceInput, setMaximumPriceInput] = useState('');

  const availableStyleLabels = useMemo(
    () =>
      Array.from(
        new Set(
          styles.flatMap((style) =>
            style.discoveryFacets
              .filter((facet) => facet.kind === 'style')
              .map((facet) => facet.label)
          )
        )
      ),
    [styles]
  );

  const filteredStyles = useMemo(() => {
    const minimumPrice = parsePriceInput(minimumPriceInput);
    const maximumPrice = parsePriceInput(maximumPriceInput);

    return styles.filter((style) => {
      const styleLabels = style.discoveryFacets
        .filter((facet) => facet.kind === 'style')
        .map((facet) => facet.label);
      const matchesSelectedStyles =
        selectedStyleLabels.length === 0 ||
        selectedStyleLabels.some((label) => styleLabels.includes(label));
      const matchesMinimumPrice =
        minimumPrice === undefined || style.previewQuote.price >= minimumPrice;
      const matchesMaximumPrice =
        maximumPrice === undefined || style.previewQuote.price <= maximumPrice;

      return matchesSelectedStyles && matchesMinimumPrice && matchesMaximumPrice;
    });
  }, [maximumPriceInput, minimumPriceInput, selectedStyleLabels, styles]);

  const stylesButtonLabel =
    selectedStyleLabels.length === 0 ? 'All styles' : selectedStyleLabels.join(', ');

  return (
    <MobileLayout
      role="customer"
      title="Nailed-it"
    >
      <section className="customer-filter-panel" aria-label="Customer home filters">
        <div className="filter-card filter-card-styles">
          <h1>Styles</h1>
          <div className="filter-dropdown">
            <button
              aria-expanded={stylesMenuOpen}
              aria-haspopup="true"
              className="filter-pill-button"
              type="button"
              onClick={() => setStylesMenuOpen((currentValue) => !currentValue)}
            >
              <span>{stylesButtonLabel}</span>
              <span aria-hidden="true" className="filter-pill-glyph">
                ▾
              </span>
            </button>

            {stylesMenuOpen ? (
              <div className="filter-dropdown-panel" role="group" aria-label="Style filters">
                {availableStyleLabels.map((label) => {
                  const selected = selectedStyleLabels.includes(label);

                  return (
                    <label key={label} className="filter-option">
                      <input
                        checked={selected}
                        type="checkbox"
                        onChange={() =>
                          setSelectedStyleLabels((currentLabels) =>
                            selected
                              ? currentLabels.filter((currentLabel) => currentLabel !== label)
                              : [...currentLabels, label]
                          )
                        }
                      />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        <div className="filter-card filter-card-price">
          <h2>Price Range</h2>
          <div className="price-range-fields">
            <label className="price-input-shell">
              <input
                inputMode="numeric"
                placeholder="20"
                type="text"
                value={minimumPriceInput}
                onChange={(event) => setMinimumPriceInput(event.target.value)}
              />
            </label>
            <span aria-hidden="true" className="price-range-divider">
              ~
            </span>
            <label className="price-input-shell">
              <input
                inputMode="numeric"
                placeholder="100"
                type="text"
                value={maximumPriceInput}
                onChange={(event) => setMaximumPriceInput(event.target.value)}
              />
            </label>
          </div>
        </div>
      </section>

      <StyleWaterfallGrid hideHeading styles={filteredStyles} />
    </MobileLayout>
  );
}

function parsePriceInput(value: string): number | undefined {
  const parsedValue = Number(value.trim());

  return Number.isFinite(parsedValue) && value.trim() !== '' ? parsedValue : undefined;
}
