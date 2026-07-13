import { describe, expect, it } from 'vitest';
import {
  canTransitionGroupbuy,
  canTransitionStyleAd,
  groupbuyActionStatus,
  groupbuyWithdrawTarget,
  styleAdActionStatus,
  styleAdWithdrawTarget,
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
  it('allows publish → unlist → relist, and shelving a rejected draft', () => {
    expect(canTransitionGroupbuy('draft', 'published')).toBe(true);
    expect(canTransitionGroupbuy('published', 'unlisted')).toBe(true);
    expect(canTransitionGroupbuy('unlisted', 'published')).toBe(true);
    expect(canTransitionGroupbuy('draft', 'unlisted')).toBe(true); // merchant rejects the agent's proposal
  });
  it('mirrors entity status to a coarse action status', () => {
    expect(groupbuyActionStatus('draft')).toBe('proposed');
    expect(groupbuyActionStatus('published')).toBe('applied');
    expect(groupbuyActionStatus('unlisted')).toBe('undone');
  });
});

describe('withdrawal targets', () => {
  it('pauses a live ad (resumable) and discards a never-launched draft', () => {
    expect(styleAdWithdrawTarget('active')).toBe('paused');
    expect(styleAdWithdrawTarget('draft')).toBe('ended');
  });

  it('unlists a live deal and shelves a rejected draft', () => {
    expect(groupbuyWithdrawTarget('published')).toBe('unlisted');
    expect(groupbuyWithdrawTarget('draft')).toBe('unlisted');
  });

  it('returns null when the entity is already not live — a withdraw is a no-op, not an error', () => {
    expect(styleAdWithdrawTarget('paused')).toBeNull();
    expect(styleAdWithdrawTarget('ended')).toBeNull();
    expect(groupbuyWithdrawTarget('unlisted')).toBeNull();
  });

  it('every withdrawal target is itself a legal transition', () => {
    for (const from of ['active', 'draft'] as const) {
      expect(canTransitionStyleAd(from, styleAdWithdrawTarget(from)!)).toBe(true);
    }
    for (const from of ['published', 'draft'] as const) {
      expect(canTransitionGroupbuy(from, groupbuyWithdrawTarget(from)!)).toBe(true);
    }
  });

  it('withdrawing always lands on a not-live coarse status', () => {
    expect(styleAdActionStatus(styleAdWithdrawTarget('active')!)).toBe('undone');
    expect(groupbuyActionStatus(groupbuyWithdrawTarget('published')!)).toBe('undone');
  });
});
