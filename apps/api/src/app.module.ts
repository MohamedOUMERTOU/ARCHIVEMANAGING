import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './common/auth.guard';
import { ClassificationModule } from './classification/classification.module';
import { DocumentsModule } from './documents/documents.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    AuthModule,
    StorageModule,
    ClassificationModule,
    DocumentsModule,
  ],
  // Toutes les routes exigent un jeton, sauf celles marquées @Public()
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
