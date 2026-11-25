import { http } from '@/services/api/http';
import { endpoints } from '@/services/endpoints';

export interface AuditEntry {
  id: number;
  userId: string | null;
  userName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, unknown>;
  ip: string | null;
  at: string;
}

export interface ChainVerification {
  entries: number;
  valid: boolean;
  brokenAt: number | null;
}

export const auditApi = {
  list: async (before?: number): Promise<AuditEntry[]> => {
    const { data } = await http.get<AuditEntry[]>(endpoints.audit.list, { params: { before, size: 50 } });
    return data;
  },
  verify: async (): Promise<ChainVerification> => {
    const { data } = await http.get<ChainVerification>(endpoints.audit.verify);
    return data;
  },
};
