import { describe, expect, it } from 'vitest';
import { mockBlockedTimes, mockWorkingPlans } from '@/mock/scheduling';
import { mockStaffItemDurations } from '@/mock/interval-bookings';
import type { BlockedTime, StaffItemDuration, WorkingPlanDay } from '@/domain/scheduling';
import {
  rowToBlockedTime,
  rowToStaffItemDuration,
  rowToWorkingPlan,
  type BlockedTimeRow,
  type StaffItemDurationRow,
  type WorkingPlanRow,
} from './scheduling-repository';

// Mirror the seed script's camelCase -> snake_case mapping so we can round-trip without a DB.
function workingPlanToRow(p: WorkingPlanDay): WorkingPlanRow {
  return {
    technician_id: p.technicianId,
    weekday: p.weekday,
    open_min: p.openMin,
    close_min: p.closeMin,
    breaks: p.breaks,
  };
}
function blockedTimeToRow(b: BlockedTime): BlockedTimeRow {
  return {
    id: b.id,
    technician_id: b.technicianId,
    start_at: b.startAt,
    end_at: b.endAt,
    reason: b.reason,
  };
}
function staffItemDurationToRow(s: StaffItemDuration): StaffItemDurationRow {
  return {
    technician_id: s.technicianId,
    catalog_item_id: s.catalogItemId,
    duration_min: s.durationMin,
  };
}

describe('supabase scheduling row mappers', () => {
  it('round-trips every working plan (plan -> row -> plan)', () => {
    for (const plan of mockWorkingPlans) {
      expect(rowToWorkingPlan(workingPlanToRow(plan))).toEqual(plan);
    }
  });

  it('round-trips every blocked time (block -> row -> block)', () => {
    for (const block of mockBlockedTimes) {
      expect(rowToBlockedTime(blockedTimeToRow(block))).toEqual(block);
    }
  });

  it('round-trips every staff item duration (override -> row -> override)', () => {
    for (const s of mockStaffItemDurations) {
      expect(rowToStaffItemDuration(staffItemDurationToRow(s))).toEqual(s);
    }
  });

  it('maps snake_case columns and preserves the breaks array shape', () => {
    expect(
      rowToWorkingPlan({
        technician_id: 'tech-z',
        weekday: 3,
        open_min: 600,
        close_min: 1140,
        breaks: [{ startMin: 780, endMin: 840 }],
      }),
    ).toEqual({
      technicianId: 'tech-z',
      weekday: 3,
      openMin: 600,
      closeMin: 1140,
      breaks: [{ startMin: 780, endMin: 840 }],
    });
  });
});
