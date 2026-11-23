import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, hasPermission, JwtPayload } from './auth-user';
import { IS_PUBLIC, REQUIRED_PERMISSION } from './decorators';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Jeton manquant');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(header.slice(7));
    } catch {
      throw new UnauthorizedException('Jeton invalide ou expiré');
    }

    // Les rôles sont relus à chaque requête : un retrait de droit prend effet immédiatement
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { role: true } }, organization: true },
    });
    if (!user || !user.active || !user.organization.active) {
      throw new UnauthorizedException('Compte désactivé');
    }

    const authUser: AuthUser = {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      fullName: user.fullName,
      roleIds: user.roles.map((r) => r.roleId),
      permissions: [...new Set(user.roles.flatMap((r) => r.role.permissions))],
      isSuperAdmin: user.isSuperAdmin,
    };
    request.user = authUser;

    const required = this.reflector.getAllAndOverride<string>(REQUIRED_PERMISSION, targets);
    if (required && !hasPermission(authUser, required)) {
      throw new ForbiddenException(`Permission requise : ${required}`);
    }
    return true;
  }
}
