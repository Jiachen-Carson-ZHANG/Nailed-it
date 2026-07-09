import { describe, expect, it } from 'vitest';
import {
  computeHomeStats,
  computeTechnicianDay,
  controlCapabilities,
  splitActions,
  toActionView,
} from './merchant-home';
import type { AgentAction } from './agents';
import type { Weekday, WorkingPlanDay } from './scheduling';

const TZ = 'Asia/Singapore'; // +08:00, no DST
// 2026-07-06T04:00Z === 2026-07-06 12:00 in SGT → todayKey '2026-07-06', nowHm '12:00'.
const NOW = Date.parse('2026-07-06T04:00:00Z');

// Minimal booking shape the pure compute reads (structurally a BookingLike).
function bk(date: string, price: number, status: string, customer: string, techId = 't1', time = '10:00', duration = 60) {
  return { date, time, status, customerName: customer, styleTitle: '法式', quote: { price, duration }, technician: { id: techId } } as never;
}

describe('computeHomeStats (compute-on-read, merchant tz)', () => {
  const bookings = [
    bk('2026-07-06', 100, 'confirmed', 'A'),  // today, earned, new customer this week
    bk('2026-07-02', 200, 'completed', 'B'),  // this week, earned, new customer this week
    bk('2026-06-25', 50, 'completed', 'C'),   // prior week → prevRevenue + not a new customer
    bk('2026-07-06', 999, 'cancelled', 'D'),  // cancelled → excluded everywhere
  ];
  const s = computeHomeStats(bookings, 'SGD', TZ, NOW);

  it('sums this-week earned revenue and ignores cancelled', () => expect(s.revenue).toBe(300));
  it('computes the delta vs the prior 7 days', () => expect(s.revenueDeltaPct).toBe(500));
  it('counts today non-cancelled orders', () => expect(s.ordersToday).toBe(1));
  it('counts customers whose first booking is this week', () => expect(s.newCustomersThisWeek).toBe(2));

  it('returns null delta when there is no prior week (new salon)', () => {
    const fresh = computeHomeStats([bk('2026-07-06', 100, 'confirmed', 'A')], 'SGD', TZ, NOW);
    expect(fresh.revenueDeltaPct).toBeNull();
  });
});

describe('computeTechnicianDay', () => {
  // NOW is 12:00 SGT (see top of file). Weekday of 2026-07-06 drives the working-plan match.
  const WD = new Date(Date.UTC(2026, 6, 6)).getUTCDay() as Weekday;
  const OTHER = ((WD + 1) % 7) as Weekday;
  const plan = (technicianId: string, weekday: Weekday): WorkingPlanDay => ({ technicianId, weekday, openMin: 600, closeMin: 1140, breaks: [] });
  const techs = [
    { id: 't1', name: '小美', initials: '美', active: true }, // free now, next at 13:00
    { id: 't2', name: '阿花', initials: '花', active: true }, // in an 11:30 appointment right now → busy
    { id: 't3', name: '离职', initials: '离', active: false }, // inactive → excluded
    { id: 't4', name: '休息', initials: '休', active: true }, // scheduled another day → off today
    { id: 't5', name: '完工', initials: '完', active: true }, // only an 08:00 appt, already done
  ];
  const workingPlans = [plan('t1', WD), plan('t2', WD), plan('t5', WD), plan('t4', OTHER)];
  const bookings = [
    bk('2026-07-06', 100, 'confirmed', 'A', 't1', '09:00'), // past
    bk('2026-07-06', 100, 'confirmed', 'B', 't1', '13:00'), // upcoming
    bk('2026-07-06', 100, 'confirmed', 'C', 't2', '11:30', 60), // 11:30–12:30 covers 12:00 → busy
    bk('2026-07-06', 100, 'confirmed', 'D', 't5', '08:00'), // 08:00–09:00, done
  ];
  const cards = computeTechnicianDay(techs, bookings, workingPlans, TZ, NOW);

  it('excludes inactive technicians and sorts busy → free → off', () =>
    expect(cards.map((c) => c.id)).toEqual(['t2', 't1', 't5', 't4']));
  it('busy = currently inside an appointment (not merely having a later one)', () => {
    const t2 = cards.find((c) => c.id === 't2')!;
    expect(t2.state).toBe('busy');
    expect(t2.label).toEqual({ kind: 'serving', styleTitle: '法式' });
  });
  it('a later appointment is free-now with a next label, not busy', () => {
    const t1 = cards.find((c) => c.id === 't1')!;
    expect(t1.state).toBe('free');
    expect(t1.load).toBe(2);
    expect(t1.label).toEqual({ kind: 'next', time: '13:00', styleTitle: '法式' });
  });
  it('a tech whose appointments are all past is free + done', () => {
    const t5 = cards.find((c) => c.id === 't5')!;
    expect(t5.state).toBe('free');
    expect(t5.label).toEqual({ kind: 'done' });
  });
  it('an active tech with no working-plan today is off', () => {
    const t4 = cards.find((c) => c.id === 't4')!;
    expect(t4.state).toBe('off');
    expect(t4.label).toEqual({ kind: 'off' });
  });
});

describe('controlCapabilities (backend-honest)', () => {
  it('a proposed draft_upload is the one gate → approve/reject', () =>
    expect(controlCapabilities({ type: 'draft_upload', status: 'proposed' })).toEqual(['approve', 'reject']));
  it('an applied ad → view only (no stop API)', () =>
    expect(controlCapabilities({ type: 'place_ad', status: 'applied' })).toEqual(['view']));
  it('a sent message → view only (never fake-undo)', () =>
    expect(controlCapabilities({ type: 'send_customer_message', status: 'applied' })).toEqual(['view']));
});

describe('toActionView title (payload-shape regression)', () => {
  it('titles a draft_upload from its real { gapTag } payload, not styleTitle/styleId', () => {
    // propose_listing (tools.py) writes { gapTag, reason }; the old title read styleTitle/styleId and
    // rendered "上架建议 ·" with an empty suffix.
    const v = toActionView({
      id: 'd', runId: 'r', merchantId: 'm', type: 'draft_upload', risk: 'irreversible',
      status: 'proposed', payload: { gapTag: '暗黑', reason: '外部趋势上升，站内无匹配' },
      createdAt: new Date(NOW).toISOString(),
    });
    expect(v.title).toBe('上架建议 · 暗黑');
    expect(v.controls).toEqual(['approve', 'reject']);
  });
});

describe('splitActions', () => {
  const mk = (id: string, status: AgentAction['status'], ageMs: number): AgentAction => ({
    id, runId: 'r', merchantId: 'm', type: 'place_ad', risk: 'reversible', status,
    payload: { slot: 'top_funnel' }, createdAt: new Date(NOW - ageMs).toISOString(),
  });

  it('routes proposed → pin, recent applied → roll, and drops stale applied', () => {
    const { pending, recent } = splitActions(
      [mk('p', 'proposed', 0), mk('a', 'applied', 3600_000), mk('old', 'applied', 3 * 86_400_000)],
      NOW,
    );
    expect(pending.map((v) => v.id)).toEqual(['p']);
    expect(recent.map((v) => v.id)).toEqual(['a']); // 'old' (3d > 48h) excluded
  });
});
