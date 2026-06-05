import { getServiceClient } from '@/lib/db/client';
import type { BlockedTime, LocalMinuteRange, Weekday, WorkingPlanDay } from '@/domain/scheduling';
import type { BlockedTimeRepository, WorkingPlanRepository } from '../types';

export interface WorkingPlanRow {
  technician_id: string;
  weekday: number;
  open_min: number;
  close_min: number;
  breaks: LocalMinuteRange[];
}

export function rowToWorkingPlan(row: WorkingPlanRow): WorkingPlanDay {
  return {
    technicianId: row.technician_id,
    weekday: row.weekday as Weekday,
    openMin: row.open_min,
    closeMin: row.close_min,
    breaks: row.breaks,
  };
}

export interface BlockedTimeRow {
  id: string;
  technician_id: string;
  start_at: string;
  end_at: string;
  reason: string;
}

export function rowToBlockedTime(row: BlockedTimeRow): BlockedTime {
  return {
    id: row.id,
    technicianId: row.technician_id,
    startAt: row.start_at,
    endAt: row.end_at,
    reason: row.reason,
  };
}

export function createSupabaseWorkingPlanRepository(): WorkingPlanRepository {
  return {
    async list(): Promise<WorkingPlanDay[]> {
      const { data, error } = await getServiceClient().from('working_plan').select('*');
      if (error) {
        throw new Error(`WorkingPlanRepository.list failed: ${error.message}`);
      }
      return (data as WorkingPlanRow[]).map(rowToWorkingPlan);
    },

    async listByTechnician(technicianId: string): Promise<WorkingPlanDay[]> {
      const { data, error } = await getServiceClient()
        .from('working_plan')
        .select('*')
        .eq('technician_id', technicianId);
      if (error) {
        throw new Error(`WorkingPlanRepository.listByTechnician failed: ${error.message}`);
      }
      return (data as WorkingPlanRow[]).map(rowToWorkingPlan);
    },
  };
}

export function createSupabaseBlockedTimeRepository(): BlockedTimeRepository {
  return {
    async list(): Promise<BlockedTime[]> {
      const { data, error } = await getServiceClient().from('blocked_time').select('*');
      if (error) {
        throw new Error(`BlockedTimeRepository.list failed: ${error.message}`);
      }
      return (data as BlockedTimeRow[]).map(rowToBlockedTime);
    },

    async listByTechnician(technicianId: string): Promise<BlockedTime[]> {
      const { data, error } = await getServiceClient()
        .from('blocked_time')
        .select('*')
        .eq('technician_id', technicianId);
      if (error) {
        throw new Error(`BlockedTimeRepository.listByTechnician failed: ${error.message}`);
      }
      return (data as BlockedTimeRow[]).map(rowToBlockedTime);
    },
  };
}
