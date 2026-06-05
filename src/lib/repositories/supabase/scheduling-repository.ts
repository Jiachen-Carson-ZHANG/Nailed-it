import { getServiceClient } from '@/lib/db/client';
import type {
  BlockedTime,
  LocalMinuteRange,
  StaffItemDuration,
  Weekday,
  WorkingPlanDay,
} from '@/domain/scheduling';
import type {
  BlockedTimeRepository,
  StaffItemDurationRepository,
  WorkingPlanRepository,
} from '../types';

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

    async listByTechnicianInRange(
      technicianId: string,
      startAt: string,
      endAt: string,
    ): Promise<BlockedTime[]> {
      const { data, error } = await getServiceClient()
        .from('blocked_time')
        .select('*')
        .eq('technician_id', technicianId)
        .lt('start_at', endAt)
        .gt('end_at', startAt);
      if (error) {
        throw new Error(`BlockedTimeRepository.listByTechnicianInRange failed: ${error.message}`);
      }
      return (data as BlockedTimeRow[]).map(rowToBlockedTime);
    },
  };
}

export interface StaffItemDurationRow {
  technician_id: string;
  catalog_item_id: string;
  duration_min: number;
}

export function rowToStaffItemDuration(row: StaffItemDurationRow): StaffItemDuration {
  return {
    technicianId: row.technician_id,
    catalogItemId: row.catalog_item_id,
    durationMin: row.duration_min,
  };
}

export function createSupabaseStaffItemDurationRepository(): StaffItemDurationRepository {
  return {
    async listByTechnician(technicianId: string): Promise<StaffItemDuration[]> {
      const { data, error } = await getServiceClient()
        .from('staff_item_duration')
        .select('*')
        .eq('technician_id', technicianId);
      if (error) {
        throw new Error(`StaffItemDurationRepository.listByTechnician failed: ${error.message}`);
      }
      return (data as StaffItemDurationRow[]).map(rowToStaffItemDuration);
    },
  };
}
