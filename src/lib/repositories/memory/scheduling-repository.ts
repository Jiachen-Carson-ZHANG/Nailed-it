import type { BlockedTime, StaffItemDuration, WorkingPlanDay } from '@/domain/scheduling';
import { intervalsOverlap } from '@/domain/scheduling';
import { mockBlockedTimes, mockWorkingPlans } from '@/mock/scheduling';
import { mockStaffItemDurations } from '@/mock/interval-bookings';
import type {
  BlockedTimeRepository,
  StaffItemDurationRepository,
  WorkingPlanRepository,
} from '../types';

function toInterval(b: { startAt: string; endAt: string }) {
  return { startMs: new Date(b.startAt).getTime(), endMs: new Date(b.endAt).getTime() };
}

export function createMemoryWorkingPlanRepository(
  seed: WorkingPlanDay[] = mockWorkingPlans,
): WorkingPlanRepository {
  const state: WorkingPlanDay[] = structuredClone(seed);

  return {
    async list(): Promise<WorkingPlanDay[]> {
      return structuredClone(state);
    },

    async listByTechnician(technicianId: string): Promise<WorkingPlanDay[]> {
      return structuredClone(state.filter((p) => p.technicianId === technicianId));
    },
  };
}

export function createMemoryBlockedTimeRepository(
  seed: BlockedTime[] = mockBlockedTimes,
): BlockedTimeRepository {
  const state: BlockedTime[] = structuredClone(seed);

  return {
    async list(): Promise<BlockedTime[]> {
      return structuredClone(state);
    },

    async listByTechnician(technicianId: string): Promise<BlockedTime[]> {
      return structuredClone(state.filter((b) => b.technicianId === technicianId));
    },

    async listByTechnicianInRange(
      technicianId: string,
      startAt: string,
      endAt: string,
    ): Promise<BlockedTime[]> {
      const reqInterval = toInterval({ startAt, endAt });
      return structuredClone(
        state.filter(
          (b) => b.technicianId === technicianId && intervalsOverlap(reqInterval, toInterval(b)),
        ),
      );
    },
  };
}

export function createMemoryStaffItemDurationRepository(
  seed: StaffItemDuration[] = mockStaffItemDurations,
): StaffItemDurationRepository {
  const state: StaffItemDuration[] = structuredClone(seed);

  return {
    async listByTechnician(technicianId: string): Promise<StaffItemDuration[]> {
      return structuredClone(state.filter((s) => s.technicianId === technicianId));
    },
  };
}
