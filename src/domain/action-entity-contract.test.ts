import { describe, expect, it } from 'vitest';
import {
  canTransitionGroupbuy,
  canTransitionStyleAd,
  groupbuyActionStatus,
  styleAdActionStatus,
} from './action-entity-contract';

describe('style_ad transitions + coarse action-status mirror', () => {
  it('allows launch (draft→active) and withdraw (active→paused), rejects illegal jumps', () => {
    expect(canTransitionStyleAd('draft', 'active')).toBe(true);
    expect(canTransitionStyleAd('active', 'paused')).toBe(true);
    expect(canTransitionStyleAd('paused', 'active')).toBe(true);
    expect(canTransitionStyleAd('draft', 'paused')).toBe(false); // can't pause what never launched
    expect(canTransitionStyleAd('ended', 'active')).toBe(false); // ended is terminal
  });
  it('mirrors entity status to a coarse live/not-live action status', () => {
    expect(styleAdActionStatus('draft')).toBe('proposed');
    expect(styleAdActionStatus('active')).toBe('applied');
    expect(styleAdActionStatus('paused')).toBe('undone');
    expect(styleAdActionStatus('ended')).toBe('undone');
  });
});

describe('groupbuy_deal transitions + coarse action-status mirror', () => {
  it('allows publish → unlist → relist, rejects skipping publish', () => {
    expect(canTransitionGroupbuy('draft', 'published')).toBe(true);
    expect(canTransitionGroupbuy('published', 'unlisted')).toBe(true);
    expect(canTransitionGroupbuy('unlisted', 'published')).toBe(true);
    expect(canTransitionGroupbuy('draft', 'unlisted')).toBe(false);
  });
  it('mirrors entity status to a coarse action status', () => {
    expect(groupbuyActionStatus('draft')).toBe('proposed');
    expect(groupbuyActionStatus('published')).toBe('applied');
    expect(groupbuyActionStatus('unlisted')).toBe('undone');
  });
});
