import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { NodeType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators';
import { ClassificationService } from './classification.service';

class CreateNodeDto {
  @IsOptional() @IsUUID() parentId?: string;
  @IsEnum(NodeType) type: NodeType;
  @IsString() @MinLength(1) @MaxLength(80) code: string;
  @IsString() @MinLength(1) @MaxLength(255) title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() retentionRuleId?: string;
}

class UpdateNodeDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) code?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() retentionRuleId?: string | null;
  @IsOptional() @Type(() => Date) @IsDate() closedAt?: Date | null;
}

class MoveNodeDto {
  @IsUUID() newParentId: string;
}

@Controller('classification')
export class ClassificationController {
  constructor(private readonly service: ClassificationService) {}

  @Get('tree')
  tree(@CurrentUser() user: AuthUser) {
    return this.service.tree(user);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateNodeDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateNodeDto) {
    return this.service.update(user, id, dto);
  }

  @Post(':id/move')
  @HttpCode(200)
  move(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MoveNodeDto) {
    return this.service.move(user, id, dto.newParentId);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(user, id);
  }
}
