import { Module } from '@nestjs/common';
import { CredentialsService } from './credentials.service';
import { CredentialsController } from './credentials.controller';
import { HttpModule, HttpService } from '@nestjs/axios';
import { IdentityUtilsService } from './utils/identity.utils.service';
import { RenderingUtilsService } from './utils/rendering.utils.service';
import { SchemaUtilsSerivce } from './utils/schema.utils.service';
import { BlockchainAnchorFactory } from './factories/blockchain-anchor.factory';
import { AnchorCordService } from './implementations/anchor-cord.service';
import { PrismaClient } from '@prisma/client';

@Module({
  imports: [HttpModule],
  providers: [CredentialsService, PrismaClient, IdentityUtilsService, RenderingUtilsService, SchemaUtilsSerivce, BlockchainAnchorFactory, AnchorCordService],
  controllers: [CredentialsController],
  exports: [IdentityUtilsService]
})
export class CredentialsModule { }
