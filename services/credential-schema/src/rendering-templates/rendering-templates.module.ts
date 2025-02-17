import { Module } from '@nestjs/common';
import { RenderingTemplatesService } from './rendering-templates.service';
import { RenderingTemplatesController } from './rendering-templates.controller';
import { ValidateTemplateService } from './validate-template.service';
import { SchemaService } from '../schema/schema.service';
import { HttpModule } from '@nestjs/axios';
import { UtilsService } from '../utils/utils.service';
import { PrismaClient } from '@prisma/client';
import { BlockchainAnchorFactory } from 'src/schema/factories/blockchain-anchor.factory';
import { AnchorCordService } from 'src/schema/implementations/anchor-cord.service';

@Module({
  imports: [HttpModule],
  providers: [
    RenderingTemplatesService,
    PrismaClient,
    ValidateTemplateService,
    SchemaService,
    UtilsService,
    BlockchainAnchorFactory,
    AnchorCordService,
  ],
  controllers: [RenderingTemplatesController],
})
export class RenderingTemplatesModule {}
