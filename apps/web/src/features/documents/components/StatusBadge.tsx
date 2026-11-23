import { Badge } from '@/components/ui/badge';
import type { DocumentStatus } from '../types';
import { STATUS_INFO } from '../utils/status';

export function StatusBadge({ status, legalHold = false }: { status: DocumentStatus; legalHold?: boolean }) {
  if (legalHold) return <Badge tone="danger">Gel juridique</Badge>;
  const { label, tone } = STATUS_INFO[status];
  return <Badge tone={tone}>{label}</Badge>;
}
