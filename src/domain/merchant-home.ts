// Merchant 今日 home read model (ADR-0011). PURE compute — no I/O — so it is deterministic and unit
// testable. The server action getMerchantTodayHomeAction() fetches raw rows (bookings, agent actions,
// technicians, agents, merchant) and hands them here; TodayHome renders the result.
//
// Design contracts this enforces:
//  - Compute-on-read (ADR-0006): stats are derived from bookings, never stored.
//  - Merchant timezone: "today"/"this week" use merchant.timezone (fixes the UTC todayIso bug the audit
//    flagged at CalendarSchedule.tsx:112). Booking.date is a local YYYY-MM-DD, so date-key string compares
//    are exact and DST-free for the demo tz (Asia/Singapore, +08:00).
//  - Backend-honest controls (DESIGN.md "Reversibility-Honest Control Rule"): controlCapabilities() returns
//    only what setActionStatus() can actually do today (approve/reject for a draft_upload gate; else view).
//    No 停止投放/停止新拼团 — those APIs do not exist yet (backlog).

import type { Agent, AgentAction, AgentActionType, ActionStatus } from './agents';
import { dedupeActionsByEntity } from './agent-transcript';
import { demoStyleName, isGenericDemoTitle } from './demo-style-labels';
import type { Booking } from './nail';
import type { Weekday, WorkingPlanDay } from './scheduling';

// ── read-model contract (getMerchantTodayHomeAction → TodayHome) ────────────────

export type HomeStats = {
  /** This-week (rolling 7d) booked/earned revenue in `currency`. */
  revenue: number;
  currency: string;
  /** vs the prior 7 days; null when there is no prior-week data (new salon → "暂无对比"). */
  revenueDeltaPct: number | null;
  ordersToday: number;
  newCustomersThisWeek: number;
};

export type TechnicianState = 'busy' | 'free' | 'off';
/** Structured status so the UI formats the label per-language — the domain stays i18n-free. */
export type TechnicianLabel =
  | { kind: 'serving'; styleTitle: string } // busy: currently inside this appointment
  | { kind: 'next'; time: string; styleTitle: string } // free now: next upcoming appointment today
  | { kind: 'done' } // free: had appointments, none remaining today
  | { kind: 'idle' } // free: no appointments today
  | { kind: 'off' }; // not scheduled today
export type TechnicianDayCard = {
  id: string;
  name: string;
  initials: string;
  state: TechnicianState;
  label: TechnicianLabel;
  load: number; // today's booking count
};

/** Controls the UI may show — a strict subset of what the backend can actually do. */
export type ControlKind = 'approve' | 'reject' | 'view';

export type HomeActionView = {
  id: string;
  runId: string; // the run that produced this action → the reasoning drill-down (Phase 3)
  type: AgentActionType;
  status: ActionStatus;
  agentLabel: string; // "投广助手" 等
  icon: string; // emoji placeholder (line-icon set is a DESIGN.md backlog item)
  title: string; // derived from type + payload
  createdAt: string;
  controls: ControlKind[];
};

export type TodayHomeData = {
  stats: HomeStats | null;
  pending: HomeActionView[]; // proposed → the pin (human-in-loop)
  recent: HomeActionView[]; // applied, last 48h → the done roll
  technicians: TechnicianDayCard[];
  agents: Agent[];
  /** Zone keys that failed to load. A listed zone renders its error state; the rest still render. */
  errors: string[];
};

// ── merchant-timezone date helpers ──────────────────────────────────────────────

const DAY_MS = 86_400_000;

/** YYYY-MM-DD for `ms` in an IANA `timeZone` (en-CA formats ISO-like). */
export function localDateKey(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
}

/** HH:mm for `ms` in `timeZone` (24h) — used to decide a technician's *next* appointment today. */
export function localTime(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(ms);
}

function inRange(dateKey: string, startKey: string, endKey: string): boolean {
  return dateKey >= startKey && dateKey <= endKey; // YYYY-MM-DD compares lexicographically
}

const EARNED: ReadonlySet<BookingLike['status']> = new Set(['confirmed', 'completed']);
type BookingLike = Pick<Booking, 'date' | 'time' | 'status' | 'customerName' | 'styleTitle'> & {
  quote: { price: number; duration: number };
  technician: { id: string };
};

// ── stats (compute-on-read) ─────────────────────────────────────────────────────

export function computeHomeStats(bookings: BookingLike[], currency: string, timeZone: string, nowMs: number): HomeStats {
  const todayKey = localDateKey(nowMs, timeZone);
  const last7Start = localDateKey(nowMs - 6 * DAY_MS, timeZone);
  const prev7Start = localDateKey(nowMs - 13 * DAY_MS, timeZone);
  const prev7End = localDateKey(nowMs - 7 * DAY_MS, timeZone);

  let revenue = 0;
  let prevRevenue = 0;
  let ordersToday = 0;
  const firstSeen = new Map<string, string>(); // customer → earliest booking date

  for (const b of bookings) {
    if (b.status === 'cancelled') continue;
    if (b.date === todayKey) ordersToday += 1;
    if (EARNED.has(b.status)) {
      if (inRange(b.date, last7Start, todayKey)) revenue += b.quote.price;
      else if (inRange(b.date, prev7Start, prev7End)) prevRevenue += b.quote.price;
    }
    const seen = firstSeen.get(b.customerName);
    if (!seen || b.date < seen) firstSeen.set(b.customerName, b.date);
  }

  let newCustomersThisWeek = 0;
  for (const first of firstSeen.values()) if (inRange(first, last7Start, todayKey)) newCustomersThisWeek += 1;

  const revenueDeltaPct = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null;
  return { revenue, currency, revenueDeltaPct, ordersToday, newCustomersThisWeek };
}

// ── technician "today" ──────────────────────────────────────────────────────────

type TechLike = { id: string; name: string; initials: string; active: boolean };

const STATE_RANK: Record<TechnicianState, number> = { busy: 0, free: 1, off: 2 };
const DEFAULT_DURATION_MIN = 60; // fallback when a booking has no duration (matches availability.ts)

/** JS weekday (0=Sun…6=Sat) for a local YYYY-MM-DD date key — the axis working plans are keyed on. */
function weekdayOf(dateKey: string): Weekday {
  const [y, mo, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay() as Weekday;
}

/** "HH:mm" → minutes since local midnight. */
function hmToMin(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** One card per active technician: today's working state + load + a structured status label (merchant tz).
 *  - `busy` = *currently inside* an appointment interval [start, start+duration); a later appointment is
 *    `free` now with a `next` label (DESIGN.md: 空闲 = free now / between appointments), not busy-all-day.
 *  - `off` is real — no working-plan covering today's weekday (the scheduling kernel's `workingPlans`, the
 *    same source the booking grid uses). Blocked-time is a partial-window concept left to the full calendar. */
export function computeTechnicianDay(
  techs: TechLike[],
  bookings: BookingLike[],
  workingPlans: WorkingPlanDay[],
  timeZone: string,
  nowMs: number,
): TechnicianDayCard[] {
  const todayKey = localDateKey(nowMs, timeZone);
  const nowMin = hmToMin(localTime(nowMs, timeZone));
  const weekday = weekdayOf(todayKey);

  return techs
    .filter((t) => t.active)
    .map((t): TechnicianDayCard => {
      const today = bookings
        .filter((b) => b.technician.id === t.id && b.date === todayKey && b.status !== 'cancelled')
        .sort((a, b) => a.time.localeCompare(b.time));
      const load = today.length;
      const base = { id: t.id, name: t.name, initials: t.initials, load };

      const scheduledToday = workingPlans.some((p) => p.technicianId === t.id && p.weekday === weekday);
      if (!scheduledToday) return { ...base, state: 'off', label: { kind: 'off' } };

      const serving = today.find((b) => {
        const start = hmToMin(b.time);
        return start <= nowMin && nowMin < start + (b.quote.duration || DEFAULT_DURATION_MIN);
      });
      if (serving) return { ...base, state: 'busy', label: { kind: 'serving', styleTitle: serving.styleTitle } };

      const upcoming = today.find((b) => hmToMin(b.time) >= nowMin);
      const label: TechnicianLabel = upcoming
        ? { kind: 'next', time: upcoming.time, styleTitle: upcoming.styleTitle }
        : load > 0
          ? { kind: 'done' }
          : { kind: 'idle' };
      return { ...base, state: 'free', label };
    })
    .sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state]); // busy → free → off
}

// ── agent actions → card view models + backend-honest controls ──────────────────

/** styleId → merchant-facing name. Cards must show nail names, not machine ids or generic seed titles. */
type StyleName = (id: string) => string;

const ACTION_META: Record<AgentActionType, { icon: string; agent: string; title: (p: Record<string, unknown>, name: StyleName) => string }> = {
  place_ad: { icon: '📣', agent: '投广助手', title: (p, name) => `投广 · ${name(str(p.styleId)) || str(p.audience) || str(p.slot) || ''}`.trim() },
  update_ad_campaign: { icon: '📣', agent: '投广助手', title: (p, name) => `修改广告 · ${name(str(p.styleId)) || str(p.campaignId) || ''}`.trim() },
  pause_ad_campaign: { icon: '⏸', agent: '投广助手', title: (p, name) => `暂停广告 · ${name(str(p.styleId)) || str(p.campaignId) || ''}`.trim() },
  set_group_buy_coupon: { icon: '🛍', agent: '团购助手', title: (p, name) => `团购券 · ${name(str(p.styleId))}`.trim() },
  // propose_listing writes { gapTag, reason } (tools.py) — the demand gap, not a style id. gapTag first;
  // styleTitle/styleId kept only as defensive fallbacks for any legacy payload shape.
  draft_upload: { icon: '🎯', agent: '决策助手', title: (p, name) => `上架建议 · ${str(p.gapTag) || str(p.styleTitle) || name(str(p.styleId)) || ''}`.trim() },
  send_customer_message: { icon: '💬', agent: '用户运营', title: (p) => `唤回 · ${str(p.customerName) || str(p.name) || ''}`.trim() },
  list_style: { icon: '✨', agent: '选品助手', title: (p, name) => `上架 · ${name(str(p.styleId))}` },
  delist_style: { icon: '✨', agent: '选品助手', title: (p, name) => `下架 · ${name(str(p.styleId))}` },
  feature_style: { icon: '✨', agent: '陈列助手', title: (p, name) => `推荐加权 · ${name(str(p.styleId))}` },
  deprioritize_style: { icon: '✨', agent: '陈列助手', title: (p, name) => `降低曝光 · ${name(str(p.styleId))}` },
  draft_customer_message: { icon: '💬', agent: '用户运营', title: (p) => `消息草稿 · ${str(p.customerName) || ''}`.trim() },
};

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** What the UI may offer, from what setActionStatus() can actually do (agent-repository.ts):
 *  - a proposed `draft_upload` is the one human gate → 批准 / 拒绝.
 *  - everything else → 查看 only. No stop/unlist API exists; never fake-undo a sent/spent action. */
export function controlCapabilities(action: Pick<AgentAction, 'type' | 'status'>): ControlKind[] {
  if (action.status === 'proposed') {
    return action.type === 'draft_upload' ? ['approve', 'reject'] : ['view'];
  }
  return ['view'];
}

export function toActionView(action: AgentAction, styleTitles: Record<string, string> = {}): HomeActionView {
  const meta = ACTION_META[action.type];
  const name: StyleName = (id) => {
    if (!id) return '';
    const title = styleTitles[id]?.trim();
    if (title && !isGenericDemoTitle(title)) return title;
    return demoStyleName(id, 'zh-CN') ?? title ?? id;
  };
  return {
    id: action.id,
    runId: action.runId,
    type: action.type,
    status: action.status,
    agentLabel: meta.agent,
    icon: meta.icon,
    title: meta.title(action.payload, name) || meta.agent,
    createdAt: action.createdAt,
    controls: controlCapabilities(action),
  };
}

/** Split raw actions into the pin (proposed) and the done roll (applied, last 48h, capped). */
export function splitActions(
  actions: AgentAction[],
  nowMs: number,
  recentLimit = 8,
  styleTitles: Record<string, string> = {},
): { pending: HomeActionView[]; recent: HomeActionView[] } {
  // Show CURRENT decisions, not every historical re-proposal. Each round re-proposes the same handful of
  // entities, so a raw list inflates to "36 待你确认" over "8 distinct things". Dedupe by entity (latest
  // per entity — `actions` is newest-first) so the merchant sees what actually awaits a call. Purely a
  // read-side collapse; the underlying rows are untouched.
  const pending = dedupeActionsByEntity(actions.filter((a) => a.status === 'proposed'))
    .map((a) => toActionView(a, styleTitles));
  const recent = dedupeActionsByEntity(
    actions.filter((a) => a.status === 'applied' && nowMs - Date.parse(a.createdAt) <= 2 * DAY_MS),
  )
    .slice(0, recentLimit)
    .map((a) => toActionView(a, styleTitles));
  return { pending, recent };
}
