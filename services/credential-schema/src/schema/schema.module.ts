import { Module } from '@nestjs/common';
import { SchemaController } from './schema.controller';
import { SchemaService } from './schema.service';
import { HttpModule } from '@nestjs/axios';
import { UtilsService } from '../utils/utils.service';
import { PrismaClient } from '@prisma/client';
import { AnchorCordService } from './implementations/anchor-cord.service';
import { BlockchainAnchorFactory } from './factories/blockchain-anchor.factory';

@Module({
  imports: [HttpModule],
  controllers: [SchemaController],
  providers: [SchemaService, PrismaClient, UtilsService,AnchorCordService,BlockchainAnchorFactory],
})
export class SchemaModule {}
