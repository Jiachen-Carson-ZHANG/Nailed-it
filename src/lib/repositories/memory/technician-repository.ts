import type { Technician } from '@/domain/nail';
import { mockTechnicians } from '@/mock/technicians';
import type { TechnicianRepository } from '../types';

export function createMemoryTechnicianRepository(
  seed: Technician[] = mockTechnicians,
): TechnicianRepository {
  const state: Technician[] = structuredClone(seed);

  return {
    async list(): Promise<Technician[]> {
      return structuredClone(state);
    },
  };
}
