import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WhyItWorksSection } from './WhyItWorksSection';

const observedElements = new Set<Element>();

let latestObserverCallback:
  | ((entries: IntersectionObserverEntry[], observer: IntersectionObserver) => void)
  | null = null;

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '0px';
  readonly thresholds = [0];

  constructor(
    callback: (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => void
  ) {
    latestObserverCallback = callback;
  }

  disconnect() {
    observedElements.clear();
  }

  observe(element: Element) {
    observedElements.add(element);
  }

  takeRecords() {
    return [];
  }

  unobserve(element: Element) {
    observedElements.delete(element);
  }
}

function triggerIntersection(target: Element, isIntersecting: boolean) {
  if (!latestObserverCallback) {
    throw new Error('IntersectionObserver callback has not been registered.');
  }

  act(() => {
    latestObserverCallback?.(
      [{ isIntersecting, target } as IntersectionObserverEntry],
      new MockIntersectionObserver(latestObserverCallback)
    );
  });
}

describe('WhyItWorksSection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    observedElements.clear();
    latestObserverCallback = null;
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  it('keeps looping while visible and stops autoplay after leaving the viewport', () => {
    render(<WhyItWorksSection />);

    const section = screen.getByRole('region', { name: 'Why It Works' });

    expect(section).toHaveAttribute('data-active-step', '0');
    expect(section).toHaveAttribute('data-animated', 'false');
    expect(observedElements.has(section)).toBe(true);

    triggerIntersection(section, true);

    expect(section).toHaveAttribute('data-animated', 'true');

    act(() => {
      vi.advanceTimersByTime(1600);
    });

    expect(section).toHaveAttribute('data-active-step', '1');
    expect(section).toHaveAttribute('data-rotation-step', '1');

    act(() => {
      vi.advanceTimersByTime(1600 * 3);
    });

    expect(section).toHaveAttribute('data-active-step', '0');
    expect(section).toHaveAttribute('data-rotation-step', '4');

    triggerIntersection(section, false);

    expect(section).toHaveAttribute('data-animated', 'false');
  });
});
