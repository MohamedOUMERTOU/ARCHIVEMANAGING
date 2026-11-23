// Utilisateur connecté, tel que le voit le reste de l'application
export interface AuthUser {
  id: string;
  organizationId: string;
  email: string;
  fullName: string;
  roleIds: string[];
  // Union des permissions générales de tous ses rôles ("*" = tout)
  permissions: string[];
  isSuperAdmin: boolean;
}

export interface JwtPayload {
  sub: string;
  org: string;
}

export function hasPermission(user: AuthUser, permission: string): boolean {
  return user.isSuperAdmin || user.permissions.includes('*') || user.permissions.includes(permission);
}
