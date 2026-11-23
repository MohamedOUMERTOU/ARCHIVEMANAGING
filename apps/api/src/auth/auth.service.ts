import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, ip?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { organization: true },
    });
    const ok = !!user && user.active && user.organization.active && (await bcrypt.compare(password, user.passwordHash));

    if (!ok) {
      await this.audit.log({
        organizationId: user?.organizationId ?? null,
        userId: null,
        action: 'CONNEXION_REFUSEE',
        entity: 'user',
        entityId: email,
        ip,
      });
      // Même message dans tous les cas : on ne révèle pas si le compte existe
      throw new UnauthorizedException('E-mail ou mot de passe incorrect');
    }

    await this.audit.log({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'CONNEXION',
      entity: 'user',
      entityId: user.id,
      ip,
    });

    const payload: JwtPayload = { sub: user.id, org: user.organizationId };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        organization: { id: user.organization.id, code: user.organization.code, name: user.organization.name },
      },
    };
  }

  static hashPassword(password: string) {
    return bcrypt.hash(password, 10);
  }
}
