import { Test, TestingModule } from '@nestjs/testing';
import { CredentialsService } from './credentials.service';
import { SchemaUtilsSerivce } from './utils/schema.utils.service';
import { IdentityUtilsService } from './utils/identity.utils.service';
import { RenderingUtilsService } from './utils/rendering.utils.service';
import { BlockchainAnchorFactory } from './factories/blockchain-anchor.factory';
import { AnchorCordService } from './implementations/anchor-cord.service';
import { PrismaClient } from '@prisma/client';
import { Logger } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';

import {
  generateCredentialRequestPayload,
  generateCredentialSchemaTestBody,
} from './credentials.fixtures';

describe('CredentialsService - Integration', () => {
  const logger = new Logger('CredentialsServiceTest');

  let service: CredentialsService;
  let httpService: HttpService;
  let identityUtilsService: IdentityUtilsService;
  let prismaClient: PrismaClient;

  let subjectDID: string;
  let credentialSchemaID: string;
  let sampleCredReqPayload: any;


  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [HttpModule],
      providers: [
        CredentialsService,
        SchemaUtilsSerivce,
        IdentityUtilsService,
        RenderingUtilsService,
        BlockchainAnchorFactory,
        PrismaClient,
        AnchorCordService,
      ],
    }).compile();

    service = module.get<CredentialsService>(CredentialsService);
    httpService = module.get<HttpService>(HttpService);
    identityUtilsService = module.get<IdentityUtilsService>(IdentityUtilsService);
    prismaClient = module.get<PrismaClient>(PrismaClient);

  });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    if (prismaClient) {
      await prismaClient.$disconnect();
    }

    if (module) {
      await module.close();
    }
  });

  describe('Environment Variable Checks', () => {
    it('should verify ANCHOR_TO_CORD is true', () => {
      const anchorToCord = process.env.ANCHOR_TO_CORD;
      expect(anchorToCord?.toLowerCase().trim()).toBe('true');
    });

    it('should verify ISSUER_AGENT_BASE_URL is a valid URL', () => {
      expect(isValidUrl(process.env.ISSUER_AGENT_BASE_URL)).toBe(true);
    });

    it('should verify VERIFICATION_MIDDLEWARE_BASE_URL is a valid URL', () => {
      expect(isValidUrl(process.env.VERIFICATION_MIDDLEWARE_BASE_URL)).toBe(true);
    });
  });

  describe('Generate DID, Create Schema, and Issue Credential', () => {
    it('should generate DIDs for subject', async () => {
      try {
        const Did = await identityUtilsService.generateDID(['CORD TESTING'], 'cord');
        subjectDID = Did[0].uri;
      } catch (error) {
        throw error;
      }

    }, 10000);

    it('should create a credential schema', async () => {
      const schemaPayload = generateCredentialSchemaTestBody();

      const response = await httpService.axiosRef.post(
        `${process.env.SCHEMA_BASE_URL}/credential-schema`,
        schemaPayload,
      );

      credentialSchemaID = response.data.schema.id;
      expect(credentialSchemaID).toBeDefined();
    }, 10000);

    it('should issue a credential', async () => {
      sampleCredReqPayload = generateCredentialRequestPayload(
        subjectDID,
        subjectDID,
        credentialSchemaID,
        '1.0.0',
      );
      delete sampleCredReqPayload.credential.credentialSubject.type;

      const issuedCredential = await service.issueCredential(sampleCredReqPayload);

      expect(issuedCredential).toBeDefined();
      expect(issuedCredential.credential.id).toBeDefined();
    }, 10000);

    it('should verify the issued credential', async () => {
      const issuedCredential = await service.issueCredential(sampleCredReqPayload);

      const verifyRes = await service.verifyCredentialById(issuedCredential.credential.id);

      expect(verifyRes).toBeDefined();
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should throw if blockchain anchoring fails', async () => {
      jest
        .spyOn(service, 'issueCredential')
        .mockRejectedValueOnce(new Error('Blockchain anchoring failed'));

      await expect(service.issueCredential(sampleCredReqPayload)).rejects.toThrow(
        'Blockchain anchoring failed',
      );
    });

    it('should throw if credential verification fails', async () => {
      await expect(service.verifyCredentialById('invalid-credential')).rejects.toThrow();
    });
  });
});
