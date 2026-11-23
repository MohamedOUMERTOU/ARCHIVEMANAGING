import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClassificationNode, NodeType, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { AuthUser, hasPermission } from '../common/auth-user';
import { ancestorIds, buildIdPath, depthOf, isSelfOrDescendant } from '../common/tree-path';
import { PrismaService } from '../prisma/prisma.service';
import { ALL_RIGHTS, effectiveRights, NodeRights } from './node-access';

export interface CreateNodeInput {
  parentId?: string | null;
  type: NodeType;
  code: string;
  title: string;
  description?: string;
  retentionRuleId?: string | null;
}

export interface UpdateNodeInput {
  code?: string;
  title?: string;
  description?: string | null;
  retentionRuleId?: string | null;
  closedAt?: Date | null;
}

const MANAGE = 'classification.manage';

@Injectable()
export class ClassificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ───────── Droits ─────────

  async rightsOn(user: AuthUser, node: Pick<ClassificationNode, 'idPath'>): Promise<NodeRights> {
    if (hasPermission(user, MANAGE)) return ALL_RIGHTS;
    const rows = await this.prisma.nodePermission.findMany({
      where: { roleId: { in: user.roleIds }, nodeId: { in: ancestorIds(node.idPath) } },
    });
    return effectiveRights(node.idPath, user.roleIds, rows);
  }

  async assertRight(user: AuthUser, node: Pick<ClassificationNode, 'idPath'>, right: keyof NodeRights) {
    const rights = await this.rightsOn(user, node);
    if (!rights[right]) throw new ForbiddenException('Vous n’avez pas les droits nécessaires sur ce dossier');
  }

  // ───────── Lecture ─────────

  /** Tout l'arbre visible par l'utilisateur, à plat et trié (le client le remet en arbre via parentId). */
  async tree(user: AuthUser) {
    const nodes = await this.prisma.classificationNode.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ depth: 'asc' }, { code: 'asc' }],
      include: { _count: { select: { documents: true } } },
    });
    if (hasPermission(user, MANAGE)) return nodes.map((n) => this.toDto(n));

    const rows = await this.prisma.nodePermission.findMany({ where: { roleId: { in: user.roleIds } } });
    const readable = nodes.filter((n) => effectiveRights(n.idPath, user.roleIds, rows).read);
    // On garde les ancêtres d'un nœud lisible pour que l'arbre reste navigable
    const keep = new Set(readable.flatMap((n) => ancestorIds(n.idPath)));
    return nodes.filter((n) => keep.has(n.id)).map((n) => this.toDto(n));
  }

  async get(user: AuthUser, id: string) {
    const node = await this.findOrFail(user.organizationId, id);
    await this.assertRight(user, node, 'read');
    const [path, rights, retention] = await Promise.all([
      this.displayPath(node),
      this.rightsOn(user, node),
      this.effectiveRetentionRule(node),
    ]);
    return { ...node, path, rights, effectiveRetentionRule: retention };
  }

  /** Chemin lisible, recalculé à chaque lecture : un renommage est visible tout de suite. */
  async displayPath(node: Pick<ClassificationNode, 'idPath'>): Promise<string> {
    const ids = ancestorIds(node.idPath);
    const ancestors = await this.prisma.classificationNode.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true },
    });
    const byId = new Map(ancestors.map((a) => [a.id, a.title]));
    return ids.map((id) => byId.get(id) ?? '?').join(' › ');
  }

  /** Règle du nœud, ou à défaut celle de l'ancêtre le plus proche qui en a une. */
  async effectiveRetentionRule(node: Pick<ClassificationNode, 'idPath'>) {
    const ids = ancestorIds(node.idPath).reverse();
    const chain = await this.prisma.classificationNode.findMany({
      where: { id: { in: ids } },
      include: { retentionRule: true },
    });
    for (const id of ids) {
      const rule = chain.find((n) => n.id === id)?.retentionRule;
      if (rule) return { ...rule, inheritedFromNodeId: id };
    }
    return null;
  }

  // ───────── Écriture ─────────

  async create(user: AuthUser, input: CreateNodeInput) {
    const parent = input.parentId ? await this.findOrFail(user.organizationId, input.parentId) : null;
    if (!parent && input.type !== NodeType.FONDS) {
      throw new BadRequestException('Seul un fonds peut être placé à la racine du plan de classement');
    }
    if (parent && input.type === NodeType.FONDS) {
      throw new BadRequestException('Un fonds ne peut pas être placé sous un autre nœud');
    }
    if (parent) await this.assertRight(user, parent, 'admin');
    else if (!hasPermission(user, MANAGE)) throw new ForbiddenException('Création d’un fonds réservée aux administrateurs');

    const id = randomUUID();
    const idPath = buildIdPath(parent?.idPath ?? null, id);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const node = await tx.classificationNode.create({
          data: {
            id,
            organizationId: user.organizationId,
            parentId: parent?.id ?? null,
            type: input.type,
            code: input.code.trim(),
            title: input.title.trim(),
            description: input.description,
            retentionRuleId: input.retentionRuleId ?? null,
            idPath,
            depth: depthOf(idPath),
          },
        });
        await this.audit.log(
          { organizationId: user.organizationId, userId: user.id, action: 'NOEUD_CREE', entity: 'classification_node', entityId: id, details: { code: node.code, title: node.title, parentId: node.parentId } },
          tx,
        );
        return node;
      });
    } catch (e) {
      throw this.mapUniqueError(e, input.code);
    }
  }

  async update(user: AuthUser, id: string, input: UpdateNodeInput) {
    const node = await this.findOrFail(user.organizationId, id);
    await this.assertRight(user, node, 'admin');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.classificationNode.update({ where: { id }, data: input });
        await this.audit.log(
          { organizationId: user.organizationId, userId: user.id, action: 'NOEUD_MODIFIE', entity: 'classification_node', entityId: id, details: { before: pick(node, input), after: input } },
          tx,
        );
        return updated;
      });
    } catch (e) {
      throw this.mapUniqueError(e, input.code ?? node.code);
    }
  }

  /** Déplace un nœud et tout son sous-arbre ; les documents suivent car ils pointent vers le nœud. */
  async move(user: AuthUser, id: string, newParentId: string) {
    const node = await this.findOrFail(user.organizationId, id);
    const newParent = await this.findOrFail(user.organizationId, newParentId);
    if (node.type === NodeType.FONDS) throw new BadRequestException('Un fonds reste à la racine');
    if (isSelfOrDescendant(node.idPath, newParent.idPath)) {
      throw new BadRequestException('Impossible de déplacer un nœud dans son propre sous-arbre');
    }
    if (node.parentId === newParent.id) return node;
    await this.assertRight(user, node, 'admin');
    await this.assertRight(user, newParent, 'admin');

    const oldPrefix = node.idPath;
    const newPrefix = buildIdPath(newParent.idPath, node.id);
    const deltaDepth = depthOf(newPrefix) - node.depth;
    const fromPath = await this.displayPath(node);

    await this.prisma.$transaction(async (tx) => {
      await tx.classificationNode.update({ where: { id }, data: { parentId: newParent.id } });
      // Une seule requête pour tout le sous-arbre
      await tx.$executeRaw`
        UPDATE classification_nodes
        SET id_path = ${newPrefix} || substring(id_path FROM ${oldPrefix.length + 1}),
            depth = depth + ${deltaDepth}
        WHERE organization_id = ${user.organizationId}::uuid
          AND id_path LIKE ${oldPrefix + '%'}`;
      const toPath = `${await this.displayPath(newParent)} › ${node.title}`;
      await this.audit.log(
        { organizationId: user.organizationId, userId: user.id, action: 'NOEUD_DEPLACE', entity: 'classification_node', entityId: id, details: { from: fromPath, to: toPath } },
        tx,
      );
    });
    return this.findOrFail(user.organizationId, id);
  }

  async remove(user: AuthUser, id: string) {
    const node = await this.findOrFail(user.organizationId, id);
    await this.assertRight(user, node, 'admin');
    const [children, documents] = await Promise.all([
      this.prisma.classificationNode.count({ where: { parentId: id } }),
      this.prisma.document.count({ where: { nodeId: id } }),
    ]);
    if (children || documents) {
      throw new ConflictException(`Le nœud contient ${children} sous-nœud(s) et ${documents} document(s) : videz-le avant de le supprimer`);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.classificationNode.delete({ where: { id } });
      await this.audit.log(
        { organizationId: user.organizationId, userId: user.id, action: 'NOEUD_SUPPRIME', entity: 'classification_node', entityId: id, details: { code: node.code, title: node.title } },
        tx,
      );
    });
  }

  // ───────── Utilitaires ─────────

  async findOrFail(organizationId: string, id: string) {
    const node = await this.prisma.classificationNode.findFirst({ where: { id, organizationId } });
    if (!node) throw new NotFoundException('Nœud introuvable');
    return node;
  }

  private toDto(n: ClassificationNode & { _count: { documents: number } }) {
    const { _count, ...rest } = n;
    return { ...rest, documentCount: _count.documents };
  }

  private mapUniqueError(e: unknown, code: string) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return new ConflictException(`La cote « ${code} » est déjà utilisée`);
    }
    return e;
  }
}

function pick<T extends object>(source: T, keysOf: object): Partial<T> {
  return Object.fromEntries(Object.keys(keysOf).map((k) => [k, (source as Record<string, unknown>)[k]])) as Partial<T>;
}
