import { Test, TestingModule } from '@nestjs/testing';
import { DidService } from './did.service';
import { BlockchainAnchorFactory } from './factories/blockchain-anchor.factory';
import { VaultService } from '../utils/vault.service';
import { PrismaService } from '../utils/prisma.service';
import { GenerateDidDTO } from './dtos/GenerateDidRequest.dto';
import { InternalServerErrorException } from '@nestjs/common';


describe('DidService - generateDID', () => {
    let service: DidService;
    let blockchainFactory: BlockchainAnchorFactory;
    let vaultService: VaultService;
    let prismaService: PrismaService;

    const mockBlockchainService = {
        anchorDid: jest.fn(),
    };

    const mockVaultService = {
        writePvtKey: jest.fn(),
    };

    const mockPrismaService = {
        identity: {
            create: jest.fn(),
        },
    };

    const mockGenerateDidDTO: GenerateDidDTO = {
        "services": [
            {
                "id": "IdentityHub",
                "type": "IdentityHub",
                "serviceEndpoint": {
                    "instance": [
                        "https://cord.network.in"
                    ]
                }
            }
        ]
        , "method": "cord"
    }
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DidService,
                {
                    provide: BlockchainAnchorFactory,
                    useValue: {
                        getAnchorService: jest.fn(() => mockBlockchainService),
                    },
                },
                {
                    provide: VaultService,
                    useValue: mockVaultService,
                },
                {
                    provide: PrismaService,
                    useValue: mockPrismaService,
                },
            ],
        }).compile();

        service = module.get<DidService>(DidService);
        blockchainFactory = module.get<BlockchainAnchorFactory>(BlockchainAnchorFactory);
        vaultService = module.get<VaultService>(VaultService);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await prismaService?.$disconnect?.();
    });

    it('should verify ANCHOR_TO_CORD is true', () => {
        const anchorToCord = process.env.ANCHOR_TO_CORD;
        const isTrue = anchorToCord?.toLowerCase().trim() === 'true';
        expect(isTrue).toBe(true);
    });


    it('should verify the environment variable is a valid URL', () => {
        const ISSUER_AGENT_BASE_URL = process.env.ISSUER_AGENT_BASE_URL;
        function isValidUrl(value: string): boolean {
            try {
                new URL(value);
                return true;
            } catch (err) {
                return false;
            }
        }
        expect(isValidUrl(ISSUER_AGENT_BASE_URL)).toBe(true);
    });

    it('should anchor a DID to the blockchain and validate JSON keys', async () => {
        const mockResponse = {
            document: {
                uri: 'did:cord:test123',
                authentication: ['did:cord:test123#key-1'],
                service: mockGenerateDidDTO.services,
                keyAgreement: ['did:cord:test123#key-2'],
                capabilityDelegation: ['did:cord:test123#key-3'],
                assertionMethod: ['did:cord:test123#key-4'],
            },
            mnemonic: 'mock-mnemonic',
            delegateKeys: ['key1', 'key2'],
        };

        mockBlockchainService.anchorDid.mockResolvedValueOnce(mockResponse);

        const result = await service.generateDID(mockGenerateDidDTO);
        console.log("result", result);
        expect(blockchainFactory.getAnchorService).toHaveBeenCalledWith('cord');
        expect(mockBlockchainService.anchorDid).toHaveBeenCalledWith(mockGenerateDidDTO);


        expect(result).toBeDefined();


        const expectedKeys = [
            'uri',
            'authentication',
            'service',
            'keyAgreement',
            'capabilityDelegation',
            'assertionMethod',
        ];

        expectedKeys.forEach((key) => {
            expect(result).toHaveProperty(key);
        });
    });




    it('should throw an error if blockchain anchoring fails', async () => {
        mockBlockchainService.anchorDid.mockRejectedValueOnce(new Error('Blockchain Error'));

        await expect(service.generateDID(mockGenerateDidDTO)).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw an error if writing to the vault fails', async () => {
        const mockResponse = {
            document: { uri: 'did:cord:test123' },
            mnemonic: 'mock-mnemonic',
            delegateKeys: ['key1', 'key2'],
        };
        mockBlockchainService.anchorDid.mockResolvedValueOnce(mockResponse);
        mockVaultService.writePvtKey.mockRejectedValueOnce(new Error('Vault Error'));

        await expect(service.generateDID(mockGenerateDidDTO)).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw an error if writing to the database fails', async () => {
        const mockResponse = {
            document: { uri: 'did:cord:test123' },
            mnemonic: 'mock-mnemonic',
            delegateKeys: ['key1', 'key2'],
        };
        mockBlockchainService.anchorDid.mockResolvedValueOnce(mockResponse);
        mockPrismaService.identity.create.mockRejectedValueOnce(new Error('Database Error'));

        await expect(service.generateDID(mockGenerateDidDTO)).rejects.toThrow(InternalServerErrorException);
    });
});
