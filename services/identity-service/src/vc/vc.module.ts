import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { DidService } from 'src/did/did.service';
import { VaultService } from 'src/utils/vault.service';
import { PrismaService } from 'src/utils/prisma.service';
import { VcController } from './vc.controller';
import VcService from './vc.service';
import { BlockchainAnchorFactory } from 'src/did/factories/blockchain-anchor.factory';
import { AnchorCordService } from 'src/did/implementations/anchor-cord.service';
// import { AnchorCordService } from 'src/utils/cord.service';

@Module({
  imports: [HttpModule],
  controllers: [VcController],
  providers: [VcService, PrismaService, DidService, VaultService,BlockchainAnchorFactory,AnchorCordService],
  // providers: [VcService, PrismaService, DidService, VaultService,AnchorCordService],
})
export class VcModule {}
