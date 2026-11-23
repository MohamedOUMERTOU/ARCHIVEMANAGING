import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { AuthUser } from './auth-user';

export const IS_PUBLIC = 'isPublic';
export const REQUIRED_PERMISSION = 'requiredPermission';

/** Route accessible sans jeton (ex. connexion). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Route réservée aux rôles qui ont cette permission générale. */
export const RequirePermission = (permission: string) => SetMetadata(REQUIRED_PERMISSION, permission);

/** Injecte l'utilisateur connecté dans un paramètre de contrôleur. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});
