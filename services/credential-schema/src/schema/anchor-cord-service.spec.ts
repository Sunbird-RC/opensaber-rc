import { Test, TestingModule } from '@nestjs/testing';
import { SchemaService } from './schema.service';
import { BlockchainAnchorFactory } from './factories/blockchain-anchor.factory';
import { PrismaClient } from '@prisma/client';
import { CreateCredentialDTO } from './dto/create-credentials.dto';
import { UtilsService } from '../utils/utils.service';
import { generateCredentialSchemaTestBody } from './schema.fixtures';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';

describe('SchemaService - createCredentialSchema', () => {
  let service: SchemaService;
  let blockchainFactory: BlockchainAnchorFactory;
  let utilsService: UtilsService;

  const mockBlockchainService = {
    anchorSchema: jest.fn(),
  };

  const mockPrismaService = {
    verifiableCredentialSchema: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockUtilsService = {
    generateDID: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchemaService,
        {
          provide: BlockchainAnchorFactory,
          useValue: {
            getAnchorService: jest.fn(() => mockBlockchainService),
          },
        },
        {
          provide: PrismaClient,
          useValue: mockPrismaService,
        },
        {
          provide: UtilsService,
          useValue: mockUtilsService,
        },
      ],
    }).compile();

    service = module.get<SchemaService>(SchemaService);
    blockchainFactory = module.get<BlockchainAnchorFactory>(BlockchainAnchorFactory);
    utilsService = module.get<UtilsService>(UtilsService);
  });

  afterEach(() => {
    jest.clearAllMocks(); // Clear mocks after each test
  });

  afterAll(async () => {
    await mockPrismaService.verifiableCredentialSchema.create.mockClear();
  });

  it('should verify ANCHOR_TO_CORD is true', () => {
    const anchorToCord = process.env.ANCHOR_TO_CORD;
    const isTrue = anchorToCord?.toLowerCase().trim() === 'true';
    expect(isTrue).toBe(true);
  });

  it('should verify ISSUER_AGENT_BASE_URL is a valid URL', () => {
    const isValidUrl = (url: string) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    };
    expect(isValidUrl(process.env.ISSUER_AGENT_BASE_URL)).toBe(true);
  });

  it('should successfully anchor a credential schema to the blockchain', async () => {
    const mockRequestBody = generateCredentialSchemaTestBody();
    const mockResponse = { schemaId: 'schema-id-blockchain' };

    mockBlockchainService.anchorSchema.mockResolvedValueOnce(mockResponse);
    mockPrismaService.verifiableCredentialSchema.create.mockResolvedValueOnce({
      ...mockRequestBody.schema,
      blockchainStatus: 'ANCHORED',
    });

    const result = await service.createCredentialSchema(mockRequestBody);

    expect(blockchainFactory.getAnchorService).toHaveBeenCalledWith('cord');
    expect(mockBlockchainService.anchorSchema).toHaveBeenCalledWith(mockRequestBody.schema);
    expect(result).toBeDefined();
    expect(result.schema.id).toEqual(mockResponse.schemaId);
    expect(result.blockchainStatus).toEqual('ANCHORED');
  });

  it('should throw an error if blockchain anchoring fails', async () => {
    const mockRequestBody = generateCredentialSchemaTestBody();

    mockBlockchainService.anchorSchema.mockRejectedValueOnce(
      new InternalServerErrorException('Blockchain anchoring failed')
    );
    await expect(service.createCredentialSchema(mockRequestBody)).rejects.toThrow(
      InternalServerErrorException
    );
  });



});
