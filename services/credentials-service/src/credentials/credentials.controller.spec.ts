import { Test, TestingModule } from '@nestjs/testing';
import { CredentialsController } from './credentials.controller';
import { CredentialsService } from './credentials.service';
import { GetCredentialsBySubjectOrIssuer } from './dto/getCredentialsBySubjectOrIssuer.dto';
import { IssueCredentialDTO } from './dto/issue-credential.dto';
import { VerifyCredentialDTO } from './dto/verify-credential.dto';
import { Request } from 'express';
import { RENDER_OUTPUT } from './enums/renderOutput.enum';
import { BadRequestException } from '@nestjs/common';
import { string, undefined } from 'zod';
import { HttpModule } from '@nestjs/axios';

describe('CredentialsController', () => {
  let controller: CredentialsController;
  let service: CredentialsService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule],
      controllers: [CredentialsController],
      providers: [
        {
          provide: CredentialsService,
          useValue: {
            getCredentials: jest.fn(),
            getCredentialsBySubjectOrIssuer: jest.fn(),
            getCredentialById: jest.fn(),
            issueCredential: jest.fn(),
            deleteCredential: jest.fn(),
            verifyCredentialById: jest.fn(),
            verifyCredential: jest.fn(),
            getRevocationList: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CredentialsController>(CredentialsController);
    service = module.get<CredentialsService>(CredentialsService);
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
  })

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getCredentials', () => {
    it('should return credentials based on tags, page, and limit', async () => {
      const tags = 'tag1,tag2';
      const page = '1';
      const limit = '10';
      const expectedResult = [];

      jest.spyOn(service, 'getCredentials').mockResolvedValue(expectedResult);

      const result = await controller.getCredentials(tags, page, limit);
      expect(result).toBe(expectedResult);
      expect(service.getCredentials).toHaveBeenCalledWith(
        ['tag1', 'tag2'],
        1,
        10
      );
    });
  });

  describe('getCredentialsBySubject', () => {
    it('should return credentials based on subject or issuer', async () => {
      const getCreds: GetCredentialsBySubjectOrIssuer = { subject: { id: 'subject' } };
      const page = '1';
      const limit = '10';
      const expectedResult = [];

      jest.spyOn(service, 'getCredentialsBySubjectOrIssuer').mockResolvedValue(expectedResult);

      const result = await controller.getCredentialsBySubject(getCreds, page, limit);
      expect(result).toBe(expectedResult);
      expect(service.getCredentialsBySubjectOrIssuer).toHaveBeenCalledWith(
        getCreds,
        1,
        10
      );
    });
  });

  describe('getCredentialById', () => {
    it('should return a credential by id', async () => {
      const id = '1';
      const req = { headers: { accept: 'application/json' } } as Request;
      const template = 'abc';
      const requestedTemplateId: string = req.headers['templateid'] as string;
      req.headers['template'] = template;
      const expectedResult = {};

      jest.spyOn(service, 'getCredentialById').mockResolvedValue(expectedResult);

      const result = await controller.getCredentialById(id, req);
      expect(result).toBe(expectedResult);
      expect(service.getCredentialById).toHaveBeenCalledWith(
        id,
        requestedTemplateId,
        template,
        RENDER_OUTPUT.JSON
      );
    });

    it('should throw BadRequestException when template id is missing and accept is not JSON', async () => {
      const id = '1';
      const req = { headers: { accept: 'application/pdf' } } as Request;

      await expect(async () => controller.getCredentialById(id, req)).rejects.toThrow(new BadRequestException("Template id or template is required"));
    });
  });

  describe('issueCredentials', () => {
    it('should issue credentials', async () => {
      const issueRequest: IssueCredentialDTO = {
        credential: undefined,
        credentialSchemaId: '',
        credentialSchemaVersion: '',
        tags: [] /* ... */ };
      const expectedResult = {};

      jest.spyOn(service, 'issueCredential').mockResolvedValue(expectedResult as any);

      const result = await controller.issueCredentials(issueRequest);
      expect(result).toBe(expectedResult);
      expect(service.issueCredential).toHaveBeenCalledWith(issueRequest);
    });
  });

  describe('deleteCredential', () => {
    it('should delete a credential', async () => {
      const id = '1';
      const expectedResult = {};

      jest.spyOn(service, 'deleteCredential').mockResolvedValue(expectedResult as any);

      const result = await controller.deleteCredential(id);
      expect(result).toBe(expectedResult);
      expect(service.deleteCredential).toHaveBeenCalledWith(id);
    });
  });

  describe('verifyCredentialById', () => {
    it('should verify a credential by id', async () => {
      const id = '1';
      const expectedResult = {};

      jest.spyOn(service, 'verifyCredentialById').mockResolvedValue(expectedResult as any);

      const result = await controller.verifyCredentialById(id);
      expect(result).toBe(expectedResult);
      expect(service.verifyCredentialById).toHaveBeenCalledWith(id);
    });
  });

  describe('verifyCredential', () => {
    it('should verify a credential',
      async () => {
        const verifyRequest: VerifyCredentialDTO = { verifiableCredential: {} } as any;
        const expectedResult = {};

        jest.spyOn(service, 'verifyCredential').mockResolvedValue(expectedResult as any);

        const result = await controller.verifyCredential(verifyRequest);
        expect(result).toBe(expectedResult);
        expect(service.verifyCredential).toHaveBeenCalledWith(verifyRequest.verifiableCredential);
      });
  });

  describe('getRevocationList', () => {
    it('should return a list of revoked credentials', async () => {
      const issuerId = 'issuer';
      const page = '1';
      const limit = '1000';
      const expectedResult = [];

      jest.spyOn(service, 'getRevocationList').mockResolvedValue(expectedResult);

      const result = await controller.getRevocationList(issuerId, page, limit);
      expect(result).toBe(expectedResult);
      expect(service.getRevocationList).toHaveBeenCalledWith(
        issuerId,
        1,
        1000
      );
    });
  });
});
