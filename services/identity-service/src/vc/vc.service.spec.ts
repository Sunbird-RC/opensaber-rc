import { Test, TestingModule } from '@nestjs/testing';
import VcService from './vc.service';
import { PrismaService } from '../utils/prisma.service';
import { DidService } from '../did/did.service';
import { VaultService } from '../utils/vault.service';
import { BlockchainAnchorFactory } from 'src/did/factories/blockchain-anchor.factory';
import { AnchorCordService } from 'src/did/implementations/anchor-cord.service';
describe('DidService', () => {
  let service: VcService;
  let didService: DidService;
  let signingDID: string;
  let signPayload = {
    "@context": {
      "name": "http://schema.org/name"
    },
    "name": "Hello!"
  }

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VcService, PrismaService, DidService, VaultService,BlockchainAnchorFactory,AnchorCordService],
    }).compile();

    service = module.get<VcService>(VcService);
    didService = module.get<DidService>(DidService);
    const testDidDoc = await didService.generateDID({
      alsoKnownAs: [],
      services: [],
      method: 'test'
    });
    signingDID = testDidDoc.id;
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should sign a payload', async () => {
    const signedPayload = await service.sign(signingDID, signPayload);
    expect(signedPayload).toBeDefined();
    expect(signedPayload.proof).toBeDefined();
  });

  it('should verify a signed payload successfully', async () => {
    const signedPayload = await service.sign(signingDID, signPayload);
    const verified = await service.verify(signingDID, signedPayload);
    expect(verified).toBeDefined();
    expect(verified).toBeTruthy();
    expect(verified).toEqual(true);
  });
  it('should fail to verify a signed payload', async () => {
    const signedPayload = await service.sign(signingDID, signPayload);
    signedPayload.name = "Hello changed";
    const verified = await service.verify(signingDID, signedPayload);
    expect(verified).toBeDefined();
    expect(verified).toBeFalsy();
    expect(verified).toEqual(false);
  });
});
