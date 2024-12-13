import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaService } from 'src/utils/prisma.service';
import { DidController } from './did.controller';
import { DidService } from './did.service';
import { VaultService } from '../utils/vault.service';
import { BlockchainAnchorFactory } from './factories/blockchain-anchor.factory';
import { AnchorCordService } from './implementations/anchor-cord.service';
@Module({
  imports: [HttpModule],
  controllers: [DidController],
  providers: [
    DidService,
    PrismaService,
    VaultService,
    AnchorCordService,
    BlockchainAnchorFactory
  ],
})
export class DidModule {}
