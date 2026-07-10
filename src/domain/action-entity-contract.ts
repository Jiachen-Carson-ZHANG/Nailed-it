// ADR-0012 Phase 0a — the contract between an agent action and the real commercial object it produced.
//
// An agent_action links FORWARD to its entity via (entity_type, entity_id); the entity links BACK via
// source_run_id. The entity's own status (StyleAd draft/active/paused/ended, GroupbuyDeal
// draft/published/unlisted) is AUTHORITATIVE; agent_actions.status is a COARSE mirror answering only
// "is this live?" so the home/feed can show a truthful pill without re-reading the entity. Undo/stop must
// act on the entity (this module says which transitions are legal), then reflect the coarse status back.

import type { ActionStatus } from './agents';
import type { StyleAdStatus } from './style-ad';
import type { GroupbuyStatus } from './groupbuy';

export type EntityType = 'style_ad' | 'groupbuy_deal';

/** Legal entity-status transitions. A withdraw/stop is just a transition to a not-live state. */
export const STYLE_AD_TRANSITIONS: Record<StyleAdStatus, readonly StyleAdStatus[]> = {
  draft: ['active', 'ended'], // merchant launches (or above-cap draft is discarded)
  active: ['paused', 'ended'], // withdraw = pause; stop = ended
  paused: ['active', 'ended'],
  ended: [],
};

export const GROUPBUY_TRANSITIONS: Record<GroupbuyStatus, readonly GroupbuyStatus[]> = {
  draft: ['published', 'unlisted'], // merchant publishes, or rejects the proposal (shelve, don't delete)
  published: ['unlisted'], // withdraw = unlist
  unlisted: ['published'], // relist
};

export function canTransitionStyleAd(from: StyleAdStatus, to: StyleAdStatus): boolean {
  return STYLE_AD_TRANSITIONS[from].includes(to);
}

export function canTransitionGroupbuy(from: GroupbuyStatus, to: GroupbuyStatus): boolean {
  return GROUPBUY_TRANSITIONS[from].includes(to);
}

/** Coarse action-status mirror of an entity's authoritative status.
 *  proposed = awaiting the merchant (a not-yet-launched draft); applied = live; undone = withdrawn/ended. */
export function styleAdActionStatus(status: StyleAdStatus): ActionStatus {
  switch (status) {
    case 'draft': return 'proposed';
    case 'active': return 'applied';
    case 'paused':
    case 'ended': return 'undone';
  }
}

export function groupbuyActionStatus(status: GroupbuyStatus): ActionStatus {
  switch (status) {
    case 'draft': return 'proposed';
    case 'published': return 'applied';
    case 'unlisted': return 'undone';
  }
}

// ── Withdrawal (ADR-0012 Phase 2) ──────────────────────────────────────────────────────────────
// Undoing/rejecting an agent action must move the REAL entity to a not-live state — flipping
// agent_actions.status alone would leave the campaign spending money. These say where each entity goes;
// `null` means it is already not live, so a withdraw is a no-op rather than an illegal transition.

/** A live ad is paused, not ended: the merchant may resume it. A never-launched draft is discarded. */
export function styleAdWithdrawTarget(status: StyleAdStatus): StyleAdStatus | null {
  switch (status) {
    case 'active': return 'paused';
    case 'draft': return 'ended';
    case 'paused':
    case 'ended': return null;
  }
}

/** Both a live deal and a rejected draft go to `unlisted` — recoverable via the relist transition. */
export function groupbuyWithdrawTarget(status: GroupbuyStatus): GroupbuyStatus | null {
  switch (status) {
    case 'published':
    case 'draft': return 'unlisted';
    case 'unlisted': return null;
  }
}
