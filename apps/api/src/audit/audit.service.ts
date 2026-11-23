import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { computeAuditHash, verifyAuditChain } from './audit-hash';

export interface AuditEntry {
  organizationId: string | null;
  userId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
  ip?: string | null;
}

type Tx = Prisma.TransactionClient;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ajoute une entrée au journal de la société.
   * Passer `tx` pour l'écrire dans la même transaction que l'action journalisée.
   */
  async log(entry: AuditEntry, tx?: Tx): Promise<void> {
    if (tx) return this.append(tx, entry);
    await this.prisma.$transaction((t) => this.append(t, entry));
  }

  private async append(tx: Tx, entry: AuditEntry): Promise<void> {
    const chainKey = entry.organizationId ?? 'platform';
    // Verrou par société : deux écritures simultanées ne peuvent pas prendre le même « précédent »
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${chainKey}))`;

    const last = await tx.auditLog.findFirst({
      where: { organizationId: entry.organizationId },
      orderBy: { id: 'desc' },
      select: { hash: true },
    });

    const data = {
      organizationId: entry.organizationId,
      userId: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      details: entry.details ?? {},
      ip: entry.ip ?? null,
      at: new Date(),
    };
    const prevHash = last?.hash ?? null;
    await tx.auditLog.create({
      data: { ...data, details: data.details as Prisma.InputJsonValue, prevHash, hash: computeAuditHash(prevHash, data) },
    });
  }

  list(organizationId: string, take = 100, beforeId?: string) {
    return this.prisma.auditLog
      .findMany({
        where: { organizationId, ...(beforeId ? { id: { lt: BigInt(beforeId) } } : {}) },
        orderBy: { id: 'desc' },
        take: Math.min(take, 500),
      })
      .then((rows) => rows.map((r) => ({ ...r, id: r.id.toString() })));
  }

  async verify(organizationId: string) {
    const rows = await this.prisma.auditLog.findMany({ where: { organizationId }, orderBy: { id: 'asc' } });
    return { entries: rows.length, ...verifyAuditChain(rows) };
  }
}
