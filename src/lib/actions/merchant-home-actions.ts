'use server';

import { getRepositories } from '@/lib/repositories';
import { demoMerchantId } from '@/mock/merchants';
import { computeHomeStats, computeTechnicianDay, splitActions, type TodayHomeData } from '@/domain/merchant-home';
import { listMerchantBookingViewsAction } from './booking-actions';

// Demo merchant config (mock/merchants → 'Nailed-it Studio'; availability.ts treats it as a fixed +08:00).
// Reading tz/currency from the merchants repo per-merchant = backlog.
const MERCHANT_TZ = 'Asia/Singapore';
const MERCHANT_CURRENCY = 'SGD';

/**
 * The single read model for the 今日 home (ADR-0011). Each zone is fetched independently and failures
 * are isolated (per-field try/catch): one broken source pushes its key to `errors` and the UI renders
 * that zone's error state — it never blanks the whole page (DESIGN.md interaction-state table). All
 * numbers are compute-on-read (ADR-0006) in the merchant timezone.
 */
export async function getMerchantTodayHomeAction(): Promise<TodayHomeData> {
  const repos = getRepositories();
  const nowMs = Date.now();
  const errors: string[] = [];

  let stats: TodayHomeData['stats'] = null;
  let technicians: TodayHomeData['technicians'] = [];
  let pending: TodayHomeData['pending'] = [];
  let recent: TodayHomeData['recent'] = [];
  let agents: TodayHomeData['agents'] = [];

  // Bookings feed both the stat strip and the technician roll — fetch once.
  let bookings: Awaited<ReturnType<typeof listMerchantBookingViewsAction>> = [];
  let bookingsOk = true;
  try {
    bookings = await listMerchantBookingViewsAction();
  } catch {
    bookingsOk = false;
  }

  if (bookingsOk) {
    try {
      stats = computeHomeStats(bookings, MERCHANT_CURRENCY, MERCHANT_TZ, nowMs);
    } catch {
      errors.push('stats');
    }
  } else {
    errors.push('stats');
  }

  try {
    // Working plans give the roll a real `off` state (今日未排班) — same source the booking grid uses.
    // list() is not merchant-scoped yet (repo backlog), so filter to this merchant explicitly; plans are
    // matched to these techs by id inside computeTechnicianDay, so other merchants' plans can't leak in.
    const [allTechs, workingPlans] = await Promise.all([repos.technicians.list(), repos.workingPlans.list()]);
    const techs = allTechs.filter((t) => t.merchantId === demoMerchantId);
    if (bookingsOk) technicians = computeTechnicianDay(techs, bookings, workingPlans, MERCHANT_TZ, nowMs);
    else errors.push('technicians');
  } catch {
    errors.push('technicians');
  }

  try {
    const actions = await repos.agents.listActions(demoMerchantId, { statuses: ['proposed', 'applied'] });
    ({ pending, recent } = splitActions(actions, nowMs));
  } catch {
    errors.push('actions');
  }

  try {
    agents = await repos.agents.listAgents();
  } catch {
    errors.push('agents');
  }

  return { stats, pending, recent, technicians, agents, errors };
}
