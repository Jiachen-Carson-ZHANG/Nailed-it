// availabilityService — see ADR-0005 (P4b). Bridges the pure scheduling kernel to the repos +
// merchant timezone: resolves a local slot, scopes to the merchant's technicians (tenant
// isolation), loads range-scoped blocks + bookings, and returns the available technicians.

import type { TechnicianSnapshot } from '@/domain/nail';
import { findAvailableTechnicians } from '@/domain/scheduling';
import type { MsInterval } from '@/domain/scheduling';
import type { RepositoryBundle } from '@/lib/repositories/types';
import { resolveSlot } from './timezone';

export type FindAvailableInput = {
  merchantId: string;
  date: string;
  time: string;
  durationMin: number;
};

export type AvailabilityService = {
  findAvailable(input: FindAvailableInput): Promise<TechnicianSnapshot[]>;
};

export function createAvailabilityService(repos: RepositoryBundle): AvailabilityService {
  return {
    async findAvailable({ merchantId, date, time, durationMin }: FindAvailableInput) {
      const merchant = await repos.merchants.getById(merchantId);
      if (!merchant) throw new Error(`unknown_merchant: ${merchantId}`);
      const request = resolveSlot(merchant.timezone, date, time, durationMin);

      // Tenant scope: only this merchant's technicians are candidates.
      const technicians = (await repos.technicians.list()).filter((t) => t.merchantId === merchantId);
      const workingPlans = await repos.workingPlans.list();

      const startISO = new Date(request.interval.startMs).toISOString();
      const endISO = new Date(request.interval.endMs).toISOString();

      const blockedTimes = (
        await Promise.all(
          technicians.map((t) => repos.blockedTimes.listByTechnicianInRange(t.id, startISO, endISO)),
        )
      ).flat();

      const existingByTechnician: Record<string, MsInterval[]> = {};
      await Promise.all(
        technicians.map(async (t) => {
          const bs = await repos.intervalBookings.listByTechnicianInRange(t.id, startISO, endISO);
          existingByTechnician[t.id] = bs.map((b) => ({
            startMs: Date.parse(b.startAt),
            endMs: Date.parse(b.endAt),
          }));
        }),
      );

      return findAvailableTechnicians({
        technicians,
        workingPlans,
        blockedTimes,
        existingByTechnician,
        request,
      });
    },
  };
}
