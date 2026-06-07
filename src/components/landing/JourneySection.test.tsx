import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JourneySection } from './JourneySection';

type MockIntersectionObserverEntry = {
  isIntersecting: boolean;
  target: Element;
};

const observedElements = new Set<Element>();
const observerCallbacksByElement = new Map<
  Element,
  (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => void
>();

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '0px';
  readonly thresholds = [0];
  private readonly callback: (
    entries: IntersectionObserverEntry[],
    observer: IntersectionObserver
  ) => void;

  constructor(
    callback: (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => void
  ) {
    this.callback = callback;
  }

  disconnect() {
    for (const [element, callback] of observerCallbacksByElement.entries()) {
      if (callback === this.callback) {
        observerCallbacksByElement.delete(element);
      }
    }

    observedElements.clear();
  }

  observe(element: Element) {
    observedElements.add(element);
    observerCallbacksByElement.set(element, this.callback);
  }

  takeRecords() {
    return [];
  }

  unobserve(element: Element) {
    observedElements.delete(element);
  }
}

function triggerIntersection(entry: MockIntersectionObserverEntry) {
  const observerCallback = observerCallbacksByElement.get(entry.target);

  if (!observerCallback) {
    throw new Error('IntersectionObserver callback has not been registered.');
  }

  act(() => {
    observerCallback(
      [entry as IntersectionObserverEntry],
      new MockIntersectionObserver(observerCallback)
    );
  });
}

describe('JourneySection', () => {
  beforeEach(() => {
    observedElements.clear();
    observerCallbacksByElement.clear();
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  it('reveals the journey content every time the section re-enters the viewport', () => {
    render(<JourneySection />);

    const merchantJourneySection = screen.getByRole('region', { name: '商家 旅程' });

    expect(merchantJourneySection).toHaveAttribute('data-visible', 'false');
    expect(observedElements.has(merchantJourneySection)).toBe(true);

    triggerIntersection({
      isIntersecting: true,
      target: merchantJourneySection
    });

    expect(merchantJourneySection).toHaveAttribute('data-visible', 'true');

    triggerIntersection({
      isIntersecting: false,
      target: merchantJourneySection
    });

    expect(merchantJourneySection).toHaveAttribute('data-visible', 'false');

    triggerIntersection({
      isIntersecting: true,
      target: merchantJourneySection
    });

    expect(merchantJourneySection).toHaveAttribute('data-visible', 'true');
  });

  it('updates the active mobile step when the journey track scrolls horizontally', () => {
    render(<JourneySection />);

    const merchantJourneySection = screen.getByRole('region', { name: '商家 旅程' });
    const merchantTrack = within(merchantJourneySection).getByLabelText('商家旅程步骤');
    const merchantStatus = within(merchantJourneySection).getByRole('status', {
      name: '商家旅程当前步骤'
    });

    expect(merchantTrack.children[0]).toHaveAttribute('aria-current', 'true');
    expect(merchantTrack.children[1]).not.toHaveAttribute('aria-current');
    expect(merchantStatus.querySelectorAll('[data-active="true"]')).toHaveLength(1);

    Object.defineProperty(merchantTrack, 'clientWidth', {
      configurable: true,
      value: 320
    });

    Object.defineProperty(merchantTrack, 'scrollLeft', {
      configurable: true,
      value: 320,
      writable: true
    });

    fireEvent.scroll(merchantTrack);

    expect(merchantTrack.children[0]).not.toHaveAttribute('aria-current');
    expect(merchantTrack.children[1]).toHaveAttribute('aria-current', 'true');
    expect(merchantStatus.querySelectorAll('[data-active="true"]')).toHaveLength(1);
  });
});
