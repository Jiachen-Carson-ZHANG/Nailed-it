import { getServiceClient } from '@/lib/db/client';
import type { Technician } from '@/domain/nail';
import type { TechnicianRepository } from '../types';

interface TechnicianRow {
  id: string;
  name: string;
  initials: string;
  title: string;
  active: boolean;
}

function rowToTechnician(row: TechnicianRow): Technician {
  return {
    id: row.id,
    name: row.name,
    initials: row.initials,
    title: row.title,
    active: row.active,
  };
}

export function createSupabaseTechnicianRepository(): TechnicianRepository {
  return {
    async list(): Promise<Technician[]> {
      const { data, error } = await getServiceClient()
        .from('technicians')
        .select('*');
      if (error) {
        throw new Error(`TechnicianRepository.list failed: ${error.message}`);
      }
      return (data as TechnicianRow[]).map(rowToTechnician);
    },
  };
}
