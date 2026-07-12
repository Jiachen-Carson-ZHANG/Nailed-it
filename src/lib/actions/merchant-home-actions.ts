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

  // Fan out EVERY independent read in ONE parallel batch. This used to await the sources sequentially
  // (bookings → techs+plans → actions+styles → agents), so the wall-time was the SUM of ~4 round-trips
  // (~5s raw + per-call overhead + latency spikes) — which crossed TodayHome's 8s client timeout under
  // load and marked stats/actions/technicians as failed even though each query individually succeeded.
  // allSettled collapses that to the slowest SINGLE read (~1–2s); one rejection never sinks the batch.
  const [bookingsR, techsR, plansR, actionsR, stylesR, agentsR] = await Promise.allSettled([
    listMerchantBookingViewsAction(),
    repos.technicians.list(),
    repos.workingPlans.list(),
    repos.agents.listActions(demoMerchantId, { statuses: ['proposed', 'applied'] }),
    repos.merchantStyles.listByMerchant(demoMerchantId),
    repos.agents.listAgents(),
  ]);

  // Bookings feed both the stat strip and the technician roll.
  const bookings = bookingsR.status === 'fulfilled' ? bookingsR.value : null;
  if (bookingsR.status === 'rejected') console.error('[today-home] bookings read failed:', bookingsR.reason);

  let stats: TodayHomeData['stats'] = null;
  if (bookings) {
    try {
      stats = computeHomeStats(bookings, MERCHANT_CURRENCY, MERCHANT_TZ, nowMs);
    } catch (e) {
      console.error('[today-home] stats compute failed:', e);
      errors.push('stats');
    }
  } else {
    errors.push('stats');
  }

  // Working plans give the roll a real `off` state (今日未排班). list() is not merchant-scoped yet (repo
  // backlog), so filter to this merchant explicitly; plans are matched to techs by id inside
  // computeTechnicianDay, so other merchants' plans can't leak in.
  let technicians: TodayHomeData['technicians'] = [];
  if (techsR.status === 'rejected') console.error('[today-home] technicians read failed:', techsR.reason);
  if (plansR.status === 'rejected') console.error('[today-home] working_plan read failed:', plansR.reason);
  if (techsR.status === 'fulfilled' && plansR.status === 'fulfilled' && bookings) {
    try {
      const techs = techsR.value.filter((t) => t.merchantId === demoMerchantId);
      technicians = computeTechnicianDay(techs, bookings, plansR.value, MERCHANT_TZ, nowMs);
    } catch (e) {
      console.error('[today-home] technician day failed:', e);
      errors.push('technicians');
    }
  } else {
    errors.push('technicians');
  }

  // Style titles make card titles human ("下架 · Melissa Design 8284", not a machine id). Cosmetic — a
  // titles failure must not take the feed down, so a rejected styles read just yields empty titles.
  let pending: TodayHomeData['pending'] = [];
  let recent: TodayHomeData['recent'] = [];
  if (actionsR.status === 'fulfilled') {
    try {
      const styleRows = stylesR.status === 'fulfilled' ? stylesR.value : [];
      const styleTitles = Object.fromEntries(styleRows.map((s) => [s.id, s.title]));
      ({ pending, recent } = splitActions(actionsR.value, nowMs, 8, styleTitles));
    } catch (e) {
      console.error('[today-home] splitActions failed:', e);
      errors.push('actions');
    }
  } else {
    console.error('[today-home] agent_actions read failed:', actionsR.reason);
    errors.push('actions');
  }

  let agents: TodayHomeData['agents'] = [];
  if (agentsR.status === 'fulfilled') {
    agents = agentsR.value;
  } else {
    console.error('[today-home] agents read failed:', agentsR.reason);
    errors.push('agents');
  }

  return { stats, pending, recent, technicians, agents, errors };
}
