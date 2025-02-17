import { Test, TestingModule } from '@nestjs/testing';
import { SchemaController } from './schema.controller';
import { HttpModule } from '@nestjs/axios';
import { SchemaService } from './schema.service';
import { UtilsService } from '../utils/utils.service';
import { CacheModule } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { BlockchainAnchorFactory } from './factories/blockchain-anchor.factory';
import { AnchorCordService } from './implementations/anchor-cord.service';

describe('SchemaController', () => {
  let controller: SchemaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SchemaController],
      imports: [HttpModule, CacheModule.register()],
      providers: [SchemaService, UtilsService, PrismaClient,BlockchainAnchorFactory,AnchorCordService],
    }).compile();

    controller = module.get<SchemaController>(SchemaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
