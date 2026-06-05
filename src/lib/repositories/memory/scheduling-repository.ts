import type { BlockedTime, WorkingPlanDay } from '@/domain/scheduling';
import { mockBlockedTimes, mockWorkingPlans } from '@/mock/scheduling';
import type { BlockedTimeRepository, WorkingPlanRepository } from '../types';

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
  };
}
