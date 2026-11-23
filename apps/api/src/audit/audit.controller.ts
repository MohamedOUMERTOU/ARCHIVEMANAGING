import { Controller, Get, Query } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { CurrentUser, RequirePermission } from '../common/decorators';
import { AuditService } from './audit.service';

@Controller('audit')
@RequirePermission('audit.read')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('take') take?: string, @Query('before') before?: string) {
    return this.audit.list(user.organizationId, take ? Number(take) : 100, before);
  }

  /** Recalcule toute la chaîne et indique la première entrée altérée, s'il y en a une. */
  @Get('verify')
  verify(@CurrentUser() user: AuthUser) {
    return this.audit.verify(user.organizationId);
  }
}
