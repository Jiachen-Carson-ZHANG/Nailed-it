import type { BlockedTime, LocalMinuteRange, Weekday, WorkingPlanDay } from '@/domain/scheduling';

// Demo working plans + blocked times for the seed technicians (Asia/Singapore).
// Weekday convention: 0=Sunday … 6=Saturday. Sunday closed for all.

const STANDARD_BREAK: LocalMinuteRange = { startMin: 13 * 60, endMin: 14 * 60 }; // 13:00–14:00
const ANNA_BREAK: LocalMinuteRange = { startMin: 14 * 60, endMin: 15 * 60 }; // 14:00–15:00

const MON_TO_SAT: Weekday[] = [1, 2, 3, 4, 5, 6];
const TUE_TO_SAT: Weekday[] = [2, 3, 4, 5, 6];

function plansFor(
  technicianId: string,
  weekdays: Weekday[],
  openMin: number,
  closeMin: number,
  breaks: LocalMinuteRange[],
): WorkingPlanDay[] {
  return weekdays.map((weekday) => ({ technicianId, weekday, openMin, closeMin, breaks }));
}

export const mockWorkingPlans: WorkingPlanDay[] = [
  ...plansFor('tech-mei', MON_TO_SAT, 10 * 60, 19 * 60, [STANDARD_BREAK]),
  ...plansFor('tech-lina', MON_TO_SAT, 10 * 60, 19 * 60, [STANDARD_BREAK]),
  ...plansFor('tech-anna', TUE_TO_SAT, 11 * 60, 20 * 60, [ANNA_BREAK]),
];

export const mockBlockedTimes: BlockedTime[] = [
  {
    id: 'block-mei-training',
    technicianId: 'tech-mei',
    startAt: '2026-06-08T15:00:00+08:00',
    endAt: '2026-06-08T17:00:00+08:00',
    reason: 'Advanced gel training',
  },
  {
    id: 'block-lina-leave',
    technicianId: 'tech-lina',
    startAt: '2026-06-10T11:00:00+08:00',
    endAt: '2026-06-10T12:30:00+08:00',
    reason: 'Personal leave',
  },
];
