import { Test, TestingModule } from '@nestjs/testing';
import { DidController } from './did.controller';
import { InternalServerErrorException } from '@nestjs/common';
import { DidService } from './did.service';
import { PrismaService } from '../utils/prisma.service';
import { VaultService } from '../utils/vault.service';
import { AnchorCordService } from 'src/utils/cord.service';
import { ConfigService } from '@nestjs/config';

describe('DidController', () => {
  let controller: DidController;
  let content: any;
  const defaultContent = {
    "content": [
      {
        "alsoKnownAs": [
          "C4GT",
          "https://www.codeforgovtech.in/"
        ],
        "services": [
          {
            "id": "C4GT",
            "type": "IdentityHub",
            "serviceEndpoint": {
              "@context": "schema.c4gt.acknowledgment",
              "@type": "UserServiceEndpoint",
              "instance": [
                "https://www.codeforgovtech.in"
              ]
            }
          }
        ],
        "method": "C4GT"
      }

    ]
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DidController],
      providers: [DidService, PrismaService, ConfigService, VaultService,AnchorCordService]
    }).compile();

    controller = module.get<DidController>(DidController);
  });

  beforeEach(async () => {
    content = JSON.parse(JSON.stringify(defaultContent));
    jest.restoreAllMocks();
  })

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should test DID generation', async () => {
    const dids = await controller.generateDID(content);
    expect(dids).toBeDefined();
    expect(dids).toHaveLength(1);
    expect(dids[0].id).toBeDefined();
    expect(dids[0].verificationMethod).toBeDefined();
  });

  it('should test throw DID generation Exception', async () => {
    jest.spyOn((controller as any).didService, "generateDID")
      .mockRejectedValue(new Error('generate failed'));
    await expect(controller.generateDID(content)).rejects.toThrow(new InternalServerErrorException("generate failed"));
  });

  it('should test resolveDID', async () => {
    jest.spyOn((controller as any).didService, "resolveDID")
      .mockResolvedValue({ id: "1234"});
    const result = await controller.resolveDID("1234");
    expect(result.id).toEqual("1234");
  });

  it('should test resolveWebDID', async () => {
    jest.spyOn((controller as any).didService, "resolveWebDID")
      .mockResolvedValue({ id: "1234"});
    const result = await controller.resolveWebDID("1234");
    expect(result.id).toEqual("1234");
  });

  it('should test bulk DID generation', async () => {
    const toGenerate = content;
    for (let i = 0; i < 10; i++) {
      toGenerate.content.push(content.content[0]);
    }
    try {
      const dids = await controller.generateDID(toGenerate);
      expect(dids).toBeDefined();
      expect(dids).toHaveLength(11);
    } catch (err) {
      expect(err).toBeDefined();
      expect(err).toBeInstanceOf(InternalServerErrorException);
      expect(err.message).toBe('Error generating one or more DIDs')
    }
  });
});
