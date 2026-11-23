import { Lock, ClipboardList } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/utils/format';
import type { DocumentDetail } from '../types';

const LIST_STATUS: Record<string, string> = {
  BROUILLON: 'brouillon',
  SOUMIS: 'en attente de visa',
  APPROUVE: 'visé, à exécuter',
};

/** Gels juridiques actifs, bordereau en cours et sort final exécuté. Rien à montrer : la carte n'apparaît pas. */
export function LifecycleCard({ doc }: { doc: DocumentDetail }) {
  const lc = doc.lifecycle;
  if (lc.holds.length === 0 && !lc.pendingList && !lc.disposedAt) return null;
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>Cycle de vie</CardTitle>
      {lc.holds.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {lc.holds.map((h) => (
            <Link
              key={h.id}
              to={`/cycle-de-vie/gels?gel=${h.id}`}
              className="bg-danger-soft text-danger flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium no-underline"
            >
              <Lock aria-hidden="true" className="size-4 shrink-0" />
              <span>
                Gel juridique : {h.name}
                {h.caseReference && <span className="font-mono font-normal"> · {h.caseReference}</span>}
              </span>
            </Link>
          ))}
          <p className="text-muted text-xs">
            Tant que le gel est actif, le document ne peut être ni modifié, ni reclassé, ni éliminé, ni versé.
          </p>
        </div>
      )}
      {lc.pendingList && (
        <Link
          to={`/cycle-de-vie/bordereaux/${lc.pendingList.id}`}
          className="bg-warning-soft text-warning flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium no-underline"
        >
          <ClipboardList aria-hidden="true" className="size-4 shrink-0" />
          Inscrit au bordereau {lc.pendingList.number} (
          {lc.pendingList.kind === 'ELIMINATION' ? 'élimination' : 'versement'},{' '}
          {LIST_STATUS[lc.pendingList.status] ?? lc.pendingList.status})
        </Link>
      )}
      {lc.disposedAt && (
        <p className="flex flex-wrap items-center gap-2 text-[13px]">
          <Badge>
            {doc.status === 'ELIMINE'
              ? 'Éliminé'
              : doc.status === 'VERSE'
                ? 'Versé'
                : 'Conservation définitive'}
          </Badge>
          le {formatDateTime(lc.disposedAt)}
        </p>
      )}
    </Card>
  );
}
